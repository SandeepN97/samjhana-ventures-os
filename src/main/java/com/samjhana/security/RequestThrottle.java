package com.samjhana.security;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Keeps public forms from being hammered: allows at most {@code max} actions per key within a window.
 * Keys are things the caller can't fake for free (a phone number, an order number, "all"), not an IP address:
 * behind Render's proxy every visitor shares one.
 *
 * <p>The memory it uses is bounded whatever a stranger sends, because this one JVM also serves the admin app and
 * the charger connections: a key is kept as a fixed-length fingerprint, a key longer than {@link #MAX_KEY_LENGTH}
 * is refused, the table never holds more than {@link #MAX_KEYS} keys (the least recently used one is dropped when
 * it is full), and a sweep once a minute forgets keys whose window has passed. A request never scans the table.
 * In memory is fine for a single instance.
 */
@Component
public class RequestThrottle {

    /** The most keys kept at once. Callers check their shared "all" bucket first, which limits how fast new keys appear. */
    static final int MAX_KEYS = 10_000;
    /** The longest key accepted. Callers build keys from short, checked values; anything longer is refused. */
    static final int MAX_KEY_LENGTH = 256;

    /** The recent hits for one key, and when the newest of them stops counting. */
    private static final class Hits {
        final Deque<Instant> times = new ArrayDeque<>();
        Instant expiresAt = Instant.MIN;
    }

    /** Access-ordered, so the first entry is the least recently used key: the one dropped when the table is full. */
    private final Map<String, Hits> table = new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Hits> eldest) {
            return size() > MAX_KEYS;
        }
    };
    private final Clock clock;

    public RequestThrottle() {
        this(Clock.systemUTC());
    }

    RequestThrottle(Clock clock) {
        this.clock = clock;
    }

    /** Records one action and returns true, or returns false (recording nothing) when the key is over its limit. */
    public boolean tryAcquire(String key, int max, Duration window) {
        if (key == null || key.length() > MAX_KEY_LENGTH) return false;
        String id = fingerprint(key);                       // outside the lock: the hashing is the slow part
        Instant now = clock.instant();
        synchronized (table) {
            Hits hits = table.get(id);                      // reading it counts as using it, for the eviction order
            if (hits == null) hits = new Hits();
            Instant cutoff = now.minus(window);
            while (!hits.times.isEmpty() && hits.times.peekFirst().isBefore(cutoff)) hits.times.pollFirst();
            if (hits.times.size() >= max) {
                if (hits.times.isEmpty()) table.remove(id);  // nothing left worth remembering
                return false;
            }
            hits.times.addLast(now);
            hits.expiresAt = now.plus(window);
            table.put(id, hits);
            return true;
        }
    }

    /** Forgets every key whose window has passed. Runs once a minute, so no request has to scan the table. */
    @Scheduled(fixedDelayString = "PT1M")
    void forgetExpired() {
        Instant now = clock.instant();
        synchronized (table) {
            table.values().removeIf(hits -> !hits.expiresAt.isAfter(now));
        }
    }

    /** How many keys are currently on record. */
    int trackedKeys() {
        synchronized (table) {
            return table.size();
        }
    }

    private static String fingerprint(String key) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is missing from this JVM", e);   // every Java runtime has it
        }
    }
}

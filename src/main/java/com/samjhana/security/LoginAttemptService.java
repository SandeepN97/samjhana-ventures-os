package com.samjhana.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Slows down password guessing. Wrong passwords are counted for {@link #WINDOW}, then forgotten.
 *
 * <p>With the address limits OFF (the default) one counter applies: {@link #MAX_FAILURES} wrong passwords for
 * one username and further attempts for that username are refused until the oldest failure ages out.
 *
 * <p>With the address limits ON, and the visitor's address known, three counters apply:
 * <ul>
 *   <li>{@link #MAX_PAIR_FAILURES} wrong passwords for one username from one address blocks that address for
 *       that username, so someone guessing at "admin" no longer locks the real admin out on another address;</li>
 *   <li>{@link #MAX_ADDRESS_FAILURES} wrong passwords from one address, for any usernames, blocks that address
 *       (password spraying), kept generous because many people in Nepal share one internet address;</li>
 *   <li>{@link #MAX_FAILURES_WITH_ADDRESS_LIMITS} wrong passwords for one username from anywhere is a last resort.</li>
 * </ul>
 * A correct login clears the username and the username+address counters, not the address total.
 *
 * <p>Everything is held in memory only: no address is saved to the database or written to a log, and a
 * restart forgets it all. In memory is fine for a single instance. The address tables are capped at
 * {@link #MAX_TRACKED_KEYS} entries so invented addresses cannot grow memory without limit.
 */
@Component
public class LoginAttemptService {

    static final int MAX_FAILURES = 10;
    static final int MAX_FAILURES_WITH_ADDRESS_LIMITS = 50;
    static final int MAX_PAIR_FAILURES = 5;
    static final int MAX_ADDRESS_FAILURES = 30;
    static final int MAX_TRACKED_KEYS = 20_000;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> pairFailures = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> addressFailures = new ConcurrentHashMap<>();
    private final Clock clock;
    private final boolean addressLimits;

    @Autowired
    public LoginAttemptService(@Value("${samjhana.security.login.ip-limits-enabled:false}") boolean addressLimits) {
        this(Clock.systemUTC(), addressLimits);
    }

    LoginAttemptService(Clock clock) {
        this(clock, false);
    }

    LoginAttemptService(Clock clock, boolean addressLimits) {
        this.clock = clock;
        this.addressLimits = addressLimits;
    }

    public boolean addressLimitsEnabled() {
        return addressLimits;
    }

    /** Username-only check, with the original limit. */
    public boolean isBlocked(String username) {
        return isOver(failures, key(username), MAX_FAILURES);
    }

    /** True when this username, or this address, has made too many wrong passwords. The address may be null. */
    public boolean isBlocked(String username, String address) {
        boolean byAddress = usesAddress(address);
        if (isOver(failures, key(username), byAddress ? MAX_FAILURES_WITH_ADDRESS_LIMITS : MAX_FAILURES)) {
            return true;
        }
        return byAddress
                && (isOver(pairFailures, pairKey(username, address), MAX_PAIR_FAILURES)
                    || isOver(addressFailures, address, MAX_ADDRESS_FAILURES));
    }

    public void recordFailure(String username) {
        record(failures, key(username), MAX_FAILURES_WITH_ADDRESS_LIMITS, false);
    }

    public void recordFailure(String username, String address) {
        recordFailure(username);
        if (usesAddress(address)) {
            record(pairFailures, pairKey(username, address), MAX_PAIR_FAILURES, true);
            record(addressFailures, address, MAX_ADDRESS_FAILURES, true);
        }
    }

    public void recordSuccess(String username) {
        failures.remove(key(username));
    }

    public void recordSuccess(String username, String address) {
        recordSuccess(username);
        if (usesAddress(address)) {
            pairFailures.remove(pairKey(username, address));
        }
    }

    /**
     * Forgets entries whose failures have all aged out. Without this, every made-up username or address
     * someone tried would be kept for as long as the server runs; with it, memory is bounded by what was
     * tried in the last {@link #WINDOW}.
     */
    @Scheduled(fixedDelayString = "PT5M")
    public void forgetExpired() {
        forgetExpired(failures);
        forgetExpired(pairFailures);
        forgetExpired(addressFailures);
    }

    /** How many usernames currently have failures on record. */
    int trackedUsernames() {
        return failures.size();
    }

    int trackedAddresses() {
        return addressFailures.size();
    }

    int trackedPairs() {
        return pairFailures.size();
    }

    private boolean usesAddress(String address) {
        return addressLimits && address != null && !address.isBlank();
    }

    private boolean isOver(Map<String, Deque<Instant>> map, String key, int max) {
        boolean[] blocked = {false};
        map.computeIfPresent(key, (name, recent) -> {
            dropExpired(recent);
            blocked[0] = recent.size() >= max;
            return recent.isEmpty() ? null : recent;
        });
        return blocked[0];
    }

    /**
     * Notes one wrong password. Only the latest {@code keep} matter for the limit, so one key can't hold more.
     * Address-based tables are capped: when full, new keys are not recorded (the username counter still is).
     */
    private void record(Map<String, Deque<Instant>> map, String key, int keep, boolean capped) {
        if (capped && map.size() >= MAX_TRACKED_KEYS && !map.containsKey(key)) {
            return;
        }
        map.compute(key, (name, recent) -> {
            Deque<Instant> updated = recent != null ? recent : new ArrayDeque<>();
            dropExpired(updated);
            updated.addLast(clock.instant());
            while (updated.size() > keep) updated.pollFirst();
            return updated;
        });
    }

    private void forgetExpired(Map<String, Deque<Instant>> map) {
        for (String name : map.keySet()) {
            map.computeIfPresent(name, (key, recent) -> {
                dropExpired(recent);
                return recent.isEmpty() ? null : recent;
            });
        }
    }

    // Every read or change of a key's failures happens inside the map's per-key compute, so a
    // clean-up running at the same time as a login attempt can never lose a recorded failure.
    private void dropExpired(Deque<Instant> recent) {
        Instant cutoff = clock.instant().minus(WINDOW);
        while (!recent.isEmpty() && recent.peekFirst().isBefore(cutoff)) {
            recent.pollFirst();
        }
    }

    private static String key(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    private static String pairKey(String username, String address) {
        return key(username) + "|" + address;
    }
}

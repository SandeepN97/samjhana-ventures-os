package com.samjhana.security;

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
 * Slows down password guessing: after {@link #MAX_FAILURES} wrong passwords for one username within
 * {@link #WINDOW}, further attempts for that username are refused until the oldest failure ages out.
 *
 * <p>Counted per username rather than per IP: behind Render's proxy every request comes from the
 * same address, and a per-IP limit would lock out the whole family at once. The trade-off is that
 * someone guessing at "admin" can keep the real admin out for up to 15 minutes; that's far better
 * than letting them guess without limit. In memory is fine for a single instance.
 */
@Component
public class LoginAttemptService {

    static final int MAX_FAILURES = 10;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginAttemptService() {
        this(Clock.systemUTC());
    }

    LoginAttemptService(Clock clock) {
        this.clock = clock;
    }

    public boolean isBlocked(String username) {
        Deque<Instant> recent = failures.get(key(username));
        if (recent == null) return false;
        synchronized (recent) {
            dropExpired(recent);
            return recent.size() >= MAX_FAILURES;
        }
    }

    public void recordFailure(String username) {
        Deque<Instant> recent = failures.computeIfAbsent(key(username), k -> new ArrayDeque<>());
        synchronized (recent) {
            dropExpired(recent);
            recent.addLast(clock.instant());
        }
    }

    public void recordSuccess(String username) {
        failures.remove(key(username));
    }

    private void dropExpired(Deque<Instant> recent) {
        Instant cutoff = clock.instant().minus(WINDOW);
        while (!recent.isEmpty() && recent.peekFirst().isBefore(cutoff)) {
            recent.pollFirst();
        }
    }

    private static String key(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }
}

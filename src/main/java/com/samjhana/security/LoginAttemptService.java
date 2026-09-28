package com.samjhana.security;

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
        boolean[] blocked = {false};
        failures.computeIfPresent(key(username), (name, recent) -> {
            dropExpired(recent);
            blocked[0] = recent.size() >= MAX_FAILURES;
            return recent.isEmpty() ? null : recent;
        });
        return blocked[0];
    }

    public void recordFailure(String username) {
        failures.compute(key(username), (name, recent) -> {
            Deque<Instant> updated = recent != null ? recent : new ArrayDeque<>();
            dropExpired(updated);
            updated.addLast(clock.instant());
            // Only the latest MAX_FAILURES matter for the limit, so one name can't hold more than that.
            while (updated.size() > MAX_FAILURES) updated.pollFirst();
            return updated;
        });
    }

    public void recordSuccess(String username) {
        failures.remove(key(username));
    }

    /**
     * Forgets usernames whose failures have all aged out. Without this, every made-up username
     * someone tried would be kept for as long as the server runs; with it, memory is bounded by
     * the names tried in the last {@link #WINDOW}.
     */
    @Scheduled(fixedDelayString = "PT5M")
    public void forgetExpired() {
        for (String name : failures.keySet()) {
            failures.computeIfPresent(name, (key, recent) -> {
                dropExpired(recent);
                return recent.isEmpty() ? null : recent;
            });
        }
    }

    /** How many usernames currently have failures on record. */
    int trackedUsernames() {
        return failures.size();
    }

    // Every read or change of a username's failures happens inside the map's per-key compute, so a
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
}

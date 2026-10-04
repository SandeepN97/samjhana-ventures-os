package com.samjhana.security;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Keeps public forms from being hammered: allows at most {@code max} actions per key within a window.
 * Keys are things the caller can't fake for free (a phone number, an order number, "all"), not an IP address:
 * behind Render's proxy every visitor shares one. In memory is fine for a single instance.
 */
@Component
public class RequestThrottle {

    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();
    private final Clock clock;

    public RequestThrottle() {
        this(Clock.systemUTC());
    }

    RequestThrottle(Clock clock) {
        this.clock = clock;
    }

    /** Records one action and returns true, or returns false (recording nothing) when the key is over its limit. */
    public boolean tryAcquire(String key, int max, Duration window) {
        boolean[] allowed = {false};
        Instant now = clock.instant();
        hits.compute(key, (k, recent) -> {
            Deque<Instant> queue = recent == null ? new ArrayDeque<>() : recent;
            Instant cutoff = now.minus(window);
            while (!queue.isEmpty() && queue.peekFirst().isBefore(cutoff)) queue.pollFirst();
            if (queue.size() < max) {
                queue.addLast(now);
                allowed[0] = true;
            }
            return queue.isEmpty() ? null : queue;
        });
        if (hits.size() > 5000) prune(now.minus(Duration.ofHours(2)));
        return allowed[0];
    }

    private void prune(Instant cutoff) {
        hits.entrySet().removeIf(e -> e.getValue().isEmpty() || e.getValue().peekLast().isBefore(cutoff));
    }
}

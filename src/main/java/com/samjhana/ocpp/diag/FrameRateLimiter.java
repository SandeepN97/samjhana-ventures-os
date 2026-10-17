package com.samjhana.ocpp.diag;

import java.util.function.LongSupplier;

/**
 * How many messages one charger connection may send (finding D-04): up to {@code burst} at once, then {@code perSecond} more
 * every second (a token bucket). A charger's normal traffic, even the burst of status messages it sends when it connects, stays
 * far below it. A connection that keeps going is flooding the database and every open screen, and is closed.
 *
 * <p>A rate of zero or less means no limit. One instance belongs to one connection and may be used from several threads.
 */
public final class FrameRateLimiter {

    private static final double NANOS_PER_SECOND = 1_000_000_000.0;

    private final double perSecond;
    private final int burst;
    private final LongSupplier nanoClock;
    private double tokens;
    private long lastRefillNanos;

    public FrameRateLimiter(double perSecond, int burst) {
        this(perSecond, burst, System::nanoTime);
    }

    /** The clock is a parameter so a test can move time by hand. */
    public FrameRateLimiter(double perSecond, int burst, LongSupplier nanoClock) {
        this.perSecond = perSecond;
        this.burst = Math.max(1, burst);
        this.nanoClock = nanoClock;
        this.tokens = this.burst;
        this.lastRefillNanos = nanoClock.getAsLong();
    }

    /** Whether one more frame may be handled now. Takes the frame's share from the allowance when it may. */
    public synchronized boolean tryAcquire() {
        if (perSecond <= 0) return true;
        long now = nanoClock.getAsLong();
        long elapsed = now - lastRefillNanos;
        if (elapsed > 0) { // a clock that stands still or goes back adds nothing
            tokens = Math.min(burst, tokens + elapsed * perSecond / NANOS_PER_SECOND);
            lastRefillNanos = now;
        }
        if (tokens < 1.0) return false;
        tokens -= 1.0;
        return true;
    }

    public double perSecond() {
        return perSecond;
    }

    public int burst() {
        return burst;
    }
}

package com.samjhana.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RequestThrottleTest {

    /** A clock the test can move forward. */
    static class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-10-03T00:00:00Z");
        void advance(Duration d) { now = now.plus(d); }
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test
    void shouldAllowUpToTheLimit_thenRefuse() {
        RequestThrottle throttle = new RequestThrottle(new MovableClock());
        for (int i = 0; i < 3; i++) assertThat(throttle.tryAcquire("k", 3, Duration.ofMinutes(10))).isTrue();
        assertThat(throttle.tryAcquire("k", 3, Duration.ofMinutes(10))).isFalse();
    }

    @Test
    void shouldCountEachKeySeparately() {
        RequestThrottle throttle = new RequestThrottle(new MovableClock());
        assertThat(throttle.tryAcquire("a", 1, Duration.ofMinutes(10))).isTrue();
        assertThat(throttle.tryAcquire("a", 1, Duration.ofMinutes(10))).isFalse();
        assertThat(throttle.tryAcquire("b", 1, Duration.ofMinutes(10))).isTrue();
    }

    @Test
    void shouldAllowAgain_onceTheWindowHasPassed() {
        MovableClock clock = new MovableClock();
        RequestThrottle throttle = new RequestThrottle(clock);
        assertThat(throttle.tryAcquire("k", 1, Duration.ofMinutes(10))).isTrue();
        assertThat(throttle.tryAcquire("k", 1, Duration.ofMinutes(10))).isFalse();
        clock.advance(Duration.ofMinutes(11));
        assertThat(throttle.tryAcquire("k", 1, Duration.ofMinutes(10))).isTrue();
    }

    @Test
    void shouldNotCountARefusedAttempt() {
        MovableClock clock = new MovableClock();
        RequestThrottle throttle = new RequestThrottle(clock);
        throttle.tryAcquire("k", 1, Duration.ofMinutes(10));
        clock.advance(Duration.ofMinutes(5));
        assertThat(throttle.tryAcquire("k", 1, Duration.ofMinutes(10))).isFalse();   // refused, not recorded
        clock.advance(Duration.ofMinutes(6));                                        // first hit now 11 min old
        assertThat(throttle.tryAcquire("k", 1, Duration.ofMinutes(10))).isTrue();
    }
}

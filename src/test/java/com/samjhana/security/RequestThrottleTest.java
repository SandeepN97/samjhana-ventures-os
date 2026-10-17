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

    // ---- finding P0-16: a stranger must not be able to make the table grow without limit ----

    @Test
    void shouldHoldAtMostMaxKeys_whenFloodedWithUniqueKeys() {
        RequestThrottle throttle = new RequestThrottle(new MovableClock());
        for (int i = 0; i < 100_000; i++) throttle.tryAcquire("flood:" + i, 1, Duration.ofHours(2));
        assertThat(throttle.trackedKeys()).isLessThanOrEqualTo(RequestThrottle.MAX_KEYS);
    }

    @Test
    void shouldForgetTheLeastRecentlyUsedKey_whenTheTableIsFull() {
        RequestThrottle throttle = new RequestThrottle(new MovableClock());
        assertThat(throttle.tryAcquire("victim", 1, Duration.ofHours(2))).isTrue();
        for (int i = 0; i < RequestThrottle.MAX_KEYS; i++) throttle.tryAcquire("other:" + i, 1, Duration.ofHours(2));
        assertThat(throttle.tryAcquire("victim", 1, Duration.ofHours(2))).isTrue();   // its count was dropped to make room
    }

    @Test
    void shouldKeepAKeyThatIsStillBeingUsed_whenTheTableFills() {
        RequestThrottle throttle = new RequestThrottle(new MovableClock());
        assertThat(throttle.tryAcquire("busy", 1, Duration.ofHours(2))).isTrue();
        for (int batch = 0; batch < 11; batch++) {                                    // 11,000 other keys in all
            for (int i = 0; i < 1_000; i++) throttle.tryAcquire("other:" + batch + ":" + i, 1, Duration.ofHours(2));
            assertThat(throttle.tryAcquire("busy", 1, Duration.ofHours(2))).isFalse();   // refused, and so used again
        }
    }

    @Test
    void shouldRefuseAKey_whenItIsLongerThanTheLimit_andRecordNothing() {
        RequestThrottle throttle = new RequestThrottle(new MovableClock());
        assertThat(throttle.tryAcquire("k".repeat(RequestThrottle.MAX_KEY_LENGTH + 1), 5, Duration.ofMinutes(10))).isFalse();
        assertThat(throttle.trackedKeys()).isZero();
        assertThat(throttle.tryAcquire("k".repeat(RequestThrottle.MAX_KEY_LENGTH), 5, Duration.ofMinutes(10))).isTrue();
    }

    @Test
    void shouldCountLongKeysSeparately_whenTheyDifferOnlyAtTheEnd() {
        RequestThrottle throttle = new RequestThrottle(new MovableClock());
        String stem = "a".repeat(RequestThrottle.MAX_KEY_LENGTH - 1);
        assertThat(throttle.tryAcquire(stem + "1", 1, Duration.ofMinutes(10))).isTrue();
        assertThat(throttle.tryAcquire(stem + "2", 1, Duration.ofMinutes(10))).isTrue();
        assertThat(throttle.tryAcquire(stem + "1", 1, Duration.ofMinutes(10))).isFalse();
    }

    @Test
    void shouldForgetKeysWhoseWindowHasPassed_whenTheSweepRuns() {
        MovableClock clock = new MovableClock();
        RequestThrottle throttle = new RequestThrottle(clock);
        for (int i = 0; i < 50; i++) throttle.tryAcquire("old:" + i, 1, Duration.ofMinutes(10));
        clock.advance(Duration.ofMinutes(11));
        throttle.forgetExpired();
        assertThat(throttle.trackedKeys()).isZero();
    }

    @Test
    void shouldKeepKeysThatAreStillCounting_whenTheSweepRuns() {
        MovableClock clock = new MovableClock();
        RequestThrottle throttle = new RequestThrottle(clock);
        assertThat(throttle.tryAcquire("long", 1, Duration.ofHours(2))).isTrue();
        clock.advance(Duration.ofHours(1));
        throttle.forgetExpired();
        assertThat(throttle.trackedKeys()).isEqualTo(1);
        assertThat(throttle.tryAcquire("long", 1, Duration.ofHours(2))).isFalse();     // still limited
    }

    // ---- finding P1a-10: refuse before expensive work, record only the failures ----

    @Test
    void shouldReportRoomWithoutRecordingAnything() {
        RequestThrottle throttle = new RequestThrottle(new MovableClock());
        for (int i = 0; i < 5; i++) assertThat(throttle.hasRoom("k", 2, Duration.ofMinutes(10))).isTrue();
        assertThat(throttle.trackedKeys()).isZero();
    }

    @Test
    void shouldReportNoRoom_onceTheLimitIsReached() {
        RequestThrottle throttle = new RequestThrottle(new MovableClock());
        throttle.tryAcquire("k", 2, Duration.ofMinutes(10));
        assertThat(throttle.hasRoom("k", 2, Duration.ofMinutes(10))).isTrue();
        throttle.tryAcquire("k", 2, Duration.ofMinutes(10));
        assertThat(throttle.hasRoom("k", 2, Duration.ofMinutes(10))).isFalse();
        assertThat(throttle.hasRoom("another", 2, Duration.ofMinutes(10))).isTrue();
    }

    @Test
    void shouldReportRoomAgain_onceTheHitsAreOutsideTheWindow() {
        MovableClock clock = new MovableClock();
        RequestThrottle throttle = new RequestThrottle(clock);
        throttle.tryAcquire("k", 1, Duration.ofMinutes(10));
        assertThat(throttle.hasRoom("k", 1, Duration.ofMinutes(10))).isFalse();
        clock.advance(Duration.ofMinutes(11));
        assertThat(throttle.hasRoom("k", 1, Duration.ofMinutes(10))).isTrue();
    }

    @Test
    void shouldReportNoRoom_forAMissingOrOverlongKey() {
        RequestThrottle throttle = new RequestThrottle(new MovableClock());
        assertThat(throttle.hasRoom(null, 5, Duration.ofMinutes(10))).isFalse();
        assertThat(throttle.hasRoom("x".repeat(RequestThrottle.MAX_KEY_LENGTH + 1), 5, Duration.ofMinutes(10))).isFalse();
    }
}

package com.samjhana.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class LoginAttemptServiceTest {

    /** A clock the test can move forward. */
    private static final class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-09-27T10:00:00Z");
        void advance(Duration d) { now = now.plus(d); }
        @Override public Instant instant() { return now; }
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    }

    private final MovableClock clock = new MovableClock();
    private final LoginAttemptService attempts = new LoginAttemptService(clock);

    private void fail(String username, int times) {
        for (int i = 0; i < times; i++) attempts.recordFailure(username);
    }

    @Test
    void shouldNotBlock_belowTheLimit() {
        fail("dad", LoginAttemptService.MAX_FAILURES - 1);
        assertThat(attempts.isBlocked("dad")).isFalse();
    }

    @Test
    void shouldBlock_atTheLimit() {
        fail("dad", LoginAttemptService.MAX_FAILURES);
        assertThat(attempts.isBlocked("dad")).isTrue();
    }

    @Test
    void shouldUnblock_onceTheFailuresAreOlderThanTheWindow() {
        fail("dad", LoginAttemptService.MAX_FAILURES);
        clock.advance(LoginAttemptService.WINDOW.plusSeconds(1));
        assertThat(attempts.isBlocked("dad")).isFalse();
    }

    @Test
    void shouldForgetFailures_afterASuccessfulLogin() {
        fail("dad", LoginAttemptService.MAX_FAILURES - 1);
        attempts.recordSuccess("dad");
        fail("dad", 1);
        assertThat(attempts.isBlocked("dad")).isFalse();
    }

    @Test
    void shouldCountUsernamesCaseInsensitively_andSeparately() {
        fail("Dad ", LoginAttemptService.MAX_FAILURES);
        assertThat(attempts.isBlocked("dad")).isTrue();
        assertThat(attempts.isBlocked("staff")).isFalse();
    }

    @Test
    void shouldCopeWithAMissingUsername() {
        fail(null, 1);
        assertThat(attempts.isBlocked(null)).isFalse();
    }
}

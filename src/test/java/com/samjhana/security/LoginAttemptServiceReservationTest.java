package com.samjhana.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static com.samjhana.security.LoginAttemptService.Decision.ALLOWED;
import static com.samjhana.security.LoginAttemptService.Decision.BUSY;
import static com.samjhana.security.LoginAttemptService.Decision.TOO_MANY_WRONG_PASSWORDS;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Findings P1B2-01 and A-01: an attempt is counted the moment it starts, not after the (slow) password check finishes,
 * so a burst of guesses that arrive together cannot all be admitted before the first failure is written down; and the
 * whole login endpoint has a ceiling per minute, so a stream of made-up usernames cannot keep every CPU busy with BCrypt.
 */
class LoginAttemptServiceReservationTest {

    private static final class MovableClock extends Clock {
        private volatile Instant now = Instant.parse("2026-09-27T10:00:00Z");
        void advance(Duration d) { now = now.plus(d); }
        @Override public Instant instant() { return now; }
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    }

    private final MovableClock clock = new MovableClock();
    private final LoginAttemptService attempts = new LoginAttemptService(clock);
    private final LoginAttemptService withAddresses = new LoginAttemptService(clock, true);

    // ---- one counter per username ----

    @Test
    void shouldAdmitTenAttempts_thenRefuse_withoutAnyFailureBeingWrittenDown() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) {
            assertThat(attempts.tryBegin("admin", null)).isEqualTo(ALLOWED);
        }
        assertThat(attempts.tryBegin("admin", null)).isEqualTo(TOO_MANY_WRONG_PASSWORDS);
    }

    @Test
    void shouldAdmitOnlyTenOfFiftyAttemptsThatArriveAtTheSameTime() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(50);
        try {
            CountDownLatch go = new CountDownLatch(1);
            AtomicInteger admitted = new AtomicInteger();
            List<Future<?>> done = new ArrayList<>();
            for (int i = 0; i < 50; i++) {
                done.add(pool.submit((Callable<Void>) () -> {
                    go.await();
                    if (attempts.tryBegin("admin", null) == ALLOWED) admitted.incrementAndGet();
                    return null;
                }));
            }
            go.countDown();
            for (Future<?> f : done) f.get(10, TimeUnit.SECONDS);

            assertThat(admitted.get()).isEqualTo(LoginAttemptService.MAX_FAILURES);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void shouldForgetTheAdvanceCount_whenThePasswordWasRight() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES - 1; i++) attempts.tryBegin("dad", null);
        attempts.attemptSucceeded("dad", null);

        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) {
            assertThat(attempts.tryBegin("dad", null)).isEqualTo(ALLOWED);
        }
    }

    @Test
    void shouldHoldWrongPasswordsAgainstTheUsernameUntilTheWindowPasses() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) attempts.tryBegin("dad", null);
        assertThat(attempts.tryBegin("dad", null)).isEqualTo(TOO_MANY_WRONG_PASSWORDS);

        clock.advance(LoginAttemptService.WINDOW.plusSeconds(1));

        assertThat(attempts.tryBegin("dad", null)).isEqualTo(ALLOWED);
    }

    @Test
    void shouldGiveBackAnAttemptThatFailedForAReasonOtherThanTheWrongPassword() {
        for (int i = 0; i < 40; i++) {
            assertThat(attempts.tryBegin("dad", null)).isEqualTo(ALLOWED);
            attempts.attemptNotCounted("dad", null);   // e.g. the database was down
        }
        assertThat(attempts.isBlocked("dad")).isFalse();
    }

    @Test
    void shouldCountOneUsernameWhateverItsCaseAndSpaces_andNotOthers() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) attempts.tryBegin(" Dad ", null);

        assertThat(attempts.tryBegin("dad", null)).isEqualTo(TOO_MANY_WRONG_PASSWORDS);
        assertThat(attempts.tryBegin("staff", null)).isEqualTo(ALLOWED);
    }

    // ---- the limits per address (when they are switched on) ----

    @Test
    void shouldRefuseTheSixthAttemptOnOneUsernameFromOneAddress() {
        for (int i = 0; i < LoginAttemptService.MAX_PAIR_FAILURES; i++) {
            assertThat(withAddresses.tryBegin("admin", "10.0.0.1")).isEqualTo(ALLOWED);
        }
        assertThat(withAddresses.tryBegin("admin", "10.0.0.1")).isEqualTo(TOO_MANY_WRONG_PASSWORDS);
        assertThat(withAddresses.tryBegin("admin", "10.0.0.2")).isEqualTo(ALLOWED);   // another address is not held back
    }

    @Test
    void shouldNotLeaveARefusedAttemptCountedAgainstTheUsername() {
        for (int i = 0; i < LoginAttemptService.MAX_PAIR_FAILURES; i++) withAddresses.tryBegin("admin", "10.0.0.1");
        assertThat(withAddresses.tryBegin("admin", "10.0.0.1")).isEqualTo(TOO_MANY_WRONG_PASSWORDS);   // refused by the pair limit

        // the username may be tried 50 times in all from different addresses; 5 are already used and the refused one is not counted
        int admitted = 0;
        for (int i = 0; i < 100; i++) {
            if (withAddresses.tryBegin("admin", "10.1.0." + i) == ALLOWED) admitted++;
        }
        assertThat(admitted).isEqualTo(LoginAttemptService.MAX_FAILURES_WITH_ADDRESS_LIMITS - LoginAttemptService.MAX_PAIR_FAILURES);
    }

    @Test
    void shouldBlockAnAddressAfter30AttemptsOnAnyUsernames() {
        for (int i = 0; i < LoginAttemptService.MAX_ADDRESS_FAILURES; i++) {
            assertThat(withAddresses.tryBegin("user-" + i, "10.0.0.9")).isEqualTo(ALLOWED);
        }
        assertThat(withAddresses.tryBegin("another", "10.0.0.9")).isEqualTo(TOO_MANY_WRONG_PASSWORDS);
    }

    @Test
    void shouldGiveBackTheAddressCount_whenThePasswordWasRight() {
        for (int i = 0; i < 100; i++) {
            assertThat(withAddresses.tryBegin("user-" + i, "10.0.0.9")).isEqualTo(ALLOWED);
            withAddresses.attemptSucceeded("user-" + i, "10.0.0.9");   // many people share one internet address
        }
    }

    // ---- the ceiling on the whole login endpoint ----

    @Test
    void shouldRefuseEveryAttemptOverTheCeilingInAMinute_whoeverMakesThem() {
        LoginAttemptService limited = new LoginAttemptService(clock, false, 5);
        for (int i = 0; i < 5; i++) assertThat(limited.tryBegin("user-" + i, null)).isEqualTo(ALLOWED);

        assertThat(limited.tryBegin("user-5", null)).isEqualTo(BUSY);
        assertThat(limited.tryBegin("user-6", null)).isEqualTo(BUSY);
    }

    @Test
    void shouldAdmitAgainWhenTheMinuteHasPassed() {
        LoginAttemptService limited = new LoginAttemptService(clock, false, 5);
        for (int i = 0; i < 5; i++) limited.tryBegin("user-" + i, null);
        assertThat(limited.tryBegin("late", null)).isEqualTo(BUSY);

        clock.advance(Duration.ofSeconds(61));

        assertThat(limited.tryBegin("late", null)).isEqualTo(ALLOWED);
    }

    @Test
    void shouldNotCountARefusedAttemptTowardsTheCeiling_norTowardsTheUsername() {
        LoginAttemptService limited = new LoginAttemptService(clock, false, 3);
        for (int i = 0; i < 3; i++) limited.tryBegin("a-" + i, null);
        for (int i = 0; i < 50; i++) assertThat(limited.tryBegin("victim", null)).isEqualTo(BUSY);

        clock.advance(Duration.ofSeconds(61));

        assertThat(limited.isBlocked("victim")).isFalse();
        assertThat(limited.tryBegin("victim", null)).isEqualTo(ALLOWED);
    }

    @Test
    void shouldNotUseUpTheCeiling_forAnAttemptThatIsNotEndpointWide() {
        LoginAttemptService limited = new LoginAttemptService(clock, false, 2);
        for (int i = 0; i < 50; i++) assertThat(limited.tryBegin("signed-in-" + i, null, false)).isEqualTo(ALLOWED);

        assertThat(limited.tryBegin("anonymous-1", null)).isEqualTo(ALLOWED);
        assertThat(limited.tryBegin("anonymous-2", null)).isEqualTo(ALLOWED);
        assertThat(limited.tryBegin("anonymous-3", null)).isEqualTo(BUSY);
    }

    @Test
    void shouldStillApplyTheUsernameLimit_toAnAttemptThatIsNotEndpointWide() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) assertThat(attempts.tryBegin("dad", null, false)).isEqualTo(ALLOWED);

        assertThat(attempts.tryBegin("dad", null, false)).isEqualTo(TOO_MANY_WRONG_PASSWORDS);
    }

    @Test
    void shouldHaveNoCeiling_whenItIsSetToZero() {
        LoginAttemptService unlimited = new LoginAttemptService(clock, false, 0);
        for (int i = 0; i < 1_000; i++) assertThat(unlimited.tryBegin("user-" + i, null)).isEqualTo(ALLOWED);
    }
}

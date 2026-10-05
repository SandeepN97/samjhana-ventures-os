package com.samjhana.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/** The per-address limits: username+address, address alone, and a high backstop per username. */
class LoginAttemptServiceAddressLimitsTest {

    private static final class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-10-05T10:00:00Z");
        void advance(Duration d) { now = now.plus(d); }
        @Override public Instant instant() { return now; }
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    }

    private static final String THIEF = "198.51.100.4";
    private static final String OFFICE = "203.0.113.9";

    private final MovableClock clock = new MovableClock();
    private final LoginAttemptService on = new LoginAttemptService(clock, true);
    private final LoginAttemptService off = new LoginAttemptService(clock, false);

    private void fail(LoginAttemptService service, String username, String address, int times) {
        for (int i = 0; i < times; i++) service.recordFailure(username, address);
    }

    @Test
    void shouldBlockThatAddressForThatUsername_afterFiveWrongTries() {
        fail(on, "admin", THIEF, LoginAttemptService.MAX_PAIR_FAILURES);
        assertThat(on.isBlocked("admin", THIEF)).isTrue();
    }

    @Test
    void shouldNotBlockTheSameUsernameFromAnotherAddress() {
        fail(on, "admin", THIEF, LoginAttemptService.MAX_PAIR_FAILURES);
        assertThat(on.isBlocked("admin", OFFICE)).isFalse();
    }

    @Test
    void shouldNotBlock_belowTheFiveTryLimit() {
        fail(on, "admin", THIEF, LoginAttemptService.MAX_PAIR_FAILURES - 1);
        assertThat(on.isBlocked("admin", THIEF)).isFalse();
    }

    @Test
    void shouldBlockAnAddress_thatGuessesManyDifferentUsernames() {
        for (int i = 0; i < LoginAttemptService.MAX_ADDRESS_FAILURES; i++) {
            on.recordFailure("user-" + i, THIEF);
        }
        assertThat(on.isBlocked("brand-new-user", THIEF)).isTrue();
        assertThat(on.isBlocked("brand-new-user", OFFICE)).isFalse();
    }

    @Test
    void shouldBlockAUsernameFromEverywhere_atTheHighBackstop() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES_WITH_ADDRESS_LIMITS; i++) {
            on.recordFailure("admin", "198.51.100." + (i % 250 + 1));
        }
        assertThat(on.isBlocked("admin", OFFICE)).isTrue();
    }

    @Test
    void shouldNotTripTheBackstop_atTheOldTenTryLimit_whenAddressesAreChecked() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) {
            on.recordFailure("admin", "198.51.100." + (i + 1));
        }
        assertThat(on.isBlocked("admin", OFFICE)).isFalse();
    }

    @Test
    void shouldClearTheUsernameAndAddressPairOnSuccess_butNotTheAddressTotal() {
        fail(on, "admin", THIEF, LoginAttemptService.MAX_PAIR_FAILURES - 1);
        for (int i = 0; i < LoginAttemptService.MAX_ADDRESS_FAILURES - (LoginAttemptService.MAX_PAIR_FAILURES - 1); i++) {
            on.recordFailure("spray-" + i, THIEF);
        }
        on.recordSuccess("admin", THIEF);

        // the pair counter was cleared, but the address has still made 30 wrong tries
        assertThat(on.isBlocked("admin", THIEF)).isTrue();
        assertThat(on.isBlocked("admin", OFFICE)).isFalse();
    }

    @Test
    void shouldForgetAPairFailure_afterTheWindow() {
        fail(on, "admin", THIEF, LoginAttemptService.MAX_PAIR_FAILURES);
        clock.advance(LoginAttemptService.WINDOW.plusSeconds(1));
        assertThat(on.isBlocked("admin", THIEF)).isFalse();
    }

    @Test
    void shouldIgnoreTheAddress_andKeepTheOldTenTryLimit_whenAddressLimitsAreOff() {
        fail(off, "admin", THIEF, LoginAttemptService.MAX_FAILURES - 1);
        assertThat(off.isBlocked("admin", OFFICE)).isFalse();
        fail(off, "admin", THIEF, 1);
        assertThat(off.isBlocked("admin", OFFICE)).isTrue();
        assertThat(off.isBlocked("other", THIEF)).isFalse();
    }

    @Test
    void shouldBehaveLikeBefore_whenThereIsNoAddress() {
        fail(on, "admin", null, LoginAttemptService.MAX_PAIR_FAILURES);
        assertThat(on.isBlocked("admin", null)).isFalse();
        assertThat(on.trackedAddresses()).isZero();
    }

    @Test
    void shouldForgetAddressesAndPairs_whoseFailuresHaveAgedOut() {
        for (int i = 0; i < 200; i++) on.recordFailure("u-" + i, "198.51.100." + (i % 250 + 1));
        clock.advance(LoginAttemptService.WINDOW.plusSeconds(1));

        on.forgetExpired();

        assertThat(on.trackedAddresses()).isZero();
        assertThat(on.trackedPairs()).isZero();
        assertThat(on.trackedUsernames()).isZero();
    }

    @Test
    void shouldNotGrowWithoutLimit_whenAnAttackerInventsAddressesAndUsernames() {
        for (int i = 0; i < LoginAttemptService.MAX_TRACKED_KEYS + 500; i++) {
            on.recordFailure("u-" + i, "10.1." + (i / 250) + "." + (i % 250));
        }
        assertThat(on.trackedAddresses()).isLessThanOrEqualTo(LoginAttemptService.MAX_TRACKED_KEYS);
        assertThat(on.trackedPairs()).isLessThanOrEqualTo(LoginAttemptService.MAX_TRACKED_KEYS);
    }

    @Test
    void shouldStillCountTheUsername_whenTheAddressTablesAreFull() {
        for (int i = 0; i < LoginAttemptService.MAX_TRACKED_KEYS + 10; i++) {
            on.recordFailure("u-" + i, "10.2." + (i / 250) + "." + (i % 250));
        }
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES_WITH_ADDRESS_LIMITS; i++) {
            on.recordFailure("target", "172.16." + (i / 250) + "." + (i % 250));
        }
        assertThat(on.isBlocked("target", OFFICE)).isTrue();
    }
}

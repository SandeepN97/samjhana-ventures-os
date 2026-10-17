package com.samjhana.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding P0-17: the wrong-password counter kept the whole username an unknown visitor typed, with no limit on its
 * length and no limit on how many were kept. Now a username is cut to the length of a real one (50), the table never
 * holds more than {@link LoginAttemptService#MAX_TRACKED_KEYS} names, and a name that is being guessed at stays in it.
 */
class LoginAttemptServiceBoundsTest {

    private static final Clock FIXED = new Clock() {
        @Override public Instant instant() { return Instant.parse("2026-09-27T10:00:00Z"); }
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    };

    private final LoginAttemptService attempts = new LoginAttemptService(FIXED);

    @Test
    void shouldKeepAHugeUsernameAsOneShortEntry() {
        attempts.recordFailure("x".repeat(100_000));

        assertThat(attempts.trackedUsernames()).isEqualTo(1);
    }

    @Test
    void shouldTreatLongNamesThatAreTheSameInTheirFirst50Characters_asOneName() {
        String start = "y".repeat(60);

        attempts.recordFailure(start + "a");
        attempts.recordFailure(start + "b");

        assertThat(attempts.trackedUsernames()).isEqualTo(1);
    }

    @Test
    void shouldStillBlockALongNameAfterTenWrongPasswords() {
        String longName = "z".repeat(5_000);
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) attempts.recordFailure(longName);

        assertThat(attempts.isBlocked(longName)).isTrue();
        assertThat(attempts.isBlocked("z".repeat(50))).isTrue();   // the cut-down name is the one that is counted
    }

    @Test
    void shouldNeverTrackMoreNamesThanTheCap() {
        for (int i = 0; i < LoginAttemptService.MAX_TRACKED_KEYS + 5_000; i++) attempts.recordFailure("made-up-" + i);

        assertThat(attempts.trackedUsernames()).isLessThanOrEqualTo(LoginAttemptService.MAX_TRACKED_KEYS);
    }

    @Test
    void shouldStillCountAndBlockARealUsername_whenMadeUpNamesHaveFilledTheTable() {
        for (int i = 0; i < LoginAttemptService.MAX_TRACKED_KEYS + 100; i++) attempts.recordFailure("made-up-" + i);

        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) {
            attempts.recordFailure("victim");
            attempts.recordFailure("more-" + i);   // the flood goes on while the real name is being guessed
        }

        assertThat(attempts.isBlocked("victim")).isTrue();
        assertThat(attempts.trackedUsernames()).isLessThanOrEqualTo(LoginAttemptService.MAX_TRACKED_KEYS);
    }

    @Test
    void shouldKeepTheFailuresOfAUsernameThatIsStillBeingGuessedAt_whileTheFloodPassesTheCap() {
        attempts.recordFailure("victim");
        int victimFailures = 1;
        for (int i = 0; i < LoginAttemptService.MAX_TRACKED_KEYS + 5_000; i++) {
            attempts.recordFailure("made-up-" + i);
            if (i % 2_500 == 0 && victimFailures < LoginAttemptService.MAX_FAILURES - 1) {
                attempts.recordFailure("victim");   // the guesser comes back now and then
                victimFailures++;
            }
        }

        attempts.recordFailure("victim");   // the 10th wrong password, after the flood has passed the cap

        assertThat(attempts.isBlocked("victim")).isTrue();
    }
}

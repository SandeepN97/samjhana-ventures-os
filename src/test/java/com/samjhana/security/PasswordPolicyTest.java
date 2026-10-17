package com.samjhana.security;

import com.samjhana.security.PasswordPolicy.Problem;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Finding A-02: one rule for every new password, with a reason the person can read. */
class PasswordPolicyTest {

    private static Optional<Problem> check(String password) {
        return PasswordPolicy.check(password, "rahul");
    }

    @ParameterizedTest
    @ValueSource(strings = {"Tamghas#2026rent", "correct horse battery staple", "Ab3$xyz9", "पासवर्ड१२३४५६७८"})
    void shouldAcceptAnOrdinaryPassword(String password) {
        assertThat(check(password)).isEmpty();
    }

    @Test
    void shouldRefuseAPasswordShorterThanEight_andAcceptExactlyEight() {
        assertThat(check("Ab3$xyz")).contains(Problem.TOO_SHORT);
        assertThat(check("Ab3$xyz9")).isEmpty();
    }

    @Test
    void shouldRefuseNothingAtAll_asTooShort() {
        assertThat(check(null)).contains(Problem.TOO_SHORT);
        assertThat(check("")).contains(Problem.TOO_SHORT);
    }

    @Test
    void shouldRefuseAPasswordOfOnlySpaces_asTooEasyToGuess_notAsTooShort() {
        assertThat(check("          ")).contains(Problem.TOO_COMMON);
        assertThat(check(" \t \t \t \t \t")).contains(Problem.TOO_COMMON);
    }

    @Test
    void shouldCountLettersAsPeopleSeeThem_notAsUtf16Units() {
        String fourEmoji = "\uD83D\uDE00".repeat(4);   // 8 UTF-16 units, 4 characters
        assertThat(check(fourEmoji + "ab")).contains(Problem.TOO_SHORT);
        assertThat(check(fourEmoji + "Qx7!")).isEmpty();
    }

    @Test
    void shouldCountBytes_notLetters_forTheLongestAllowed() {
        String seventyTwoBytes = "Qx7!".repeat(18);
        assertThat(seventyTwoBytes.getBytes(StandardCharsets.UTF_8)).hasSize(72);
        assertThat(check(seventyTwoBytes)).isEmpty();
        assertThat(check(seventyTwoBytes + "z")).contains(Problem.TOO_LONG);
    }

    @Test
    void shouldCountEachNepaliLetterAsThreeBytes() {
        String twentyFourLetters = "कखगघङचछजझञटठडढणतथदधनपफबभ";   // 24 letters, 72 bytes
        assertThat(twentyFourLetters.getBytes(StandardCharsets.UTF_8)).hasSize(72);

        assertThat(check(twentyFourLetters)).isEmpty();
        assertThat(check(twentyFourLetters + "म")).contains(Problem.TOO_LONG);
    }

    @ParameterizedTest
    @ValueSource(strings = {"password", "Password", "PASSWORD123", "password123", "Qwerty123", "12345678", "iloveyou",
            "manager123", "staff123", "Admin123", "samjhana"})
    void shouldRefuseCommonPasswords_whateverTheCase(String password) {
        assertThat(check(password)).contains(Problem.TOO_COMMON);
    }

    @Test
    void shouldRefuseOneCharacterRepeated() {
        assertThat(check("zzzzzzzzzz")).contains(Problem.TOO_COMMON);
        assertThat(check("७७७७७७७७")).contains(Problem.TOO_COMMON);
    }

    @Test
    void shouldRefuseAPasswordThatContainsTheUsername_ignoringCase() {
        assertThat(PasswordPolicy.check("Rahul#7731", "rahul")).contains(Problem.CONTAINS_USERNAME);
        assertThat(PasswordPolicy.check("xRAHULx9!", "Rahul")).contains(Problem.CONTAINS_USERNAME);
        assertThat(PasswordPolicy.check("Admin@Rahul1", "  rahul ")).contains(Problem.CONTAINS_USERNAME);
    }

    @Test
    void shouldNotCompareAgainstAVeryShortUsername_orNoUsername() {
        assertThat(PasswordPolicy.check("Tam#7731xx", "tam")).isEmpty();
        assertThat(PasswordPolicy.check("Tam#7731xx", "")).isEmpty();
        assertThat(PasswordPolicy.check("Tam#7731xx", null)).isEmpty();
    }

    @Test
    void shouldReportTheLengthProblemBeforeTheOthers() {
        assertThat(PasswordPolicy.check("rahul", "rahul")).contains(Problem.TOO_SHORT);
        assertThat(PasswordPolicy.check("password", "password")).contains(Problem.TOO_COMMON);   // common comes before username
    }

    @Test
    void shouldGiveEachProblemItsOwnCode() {
        assertThat(Problem.values()).extracting(Problem::code)
                .containsExactly("PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG", "PASSWORD_TOO_COMMON", "PASSWORD_HAS_USERNAME");
    }

    @Test
    void shouldNameTheProblemInAnEnglishSentenceThatStartsWithTheLabel() {
        assertThat(PasswordPolicy.message(Problem.TOO_SHORT, "New password")).isEqualTo("New password must be at least 8 characters");
        assertThat(PasswordPolicy.message(Problem.TOO_SHORT, "Password")).isEqualTo("Password must be at least 8 characters");
        assertThat(PasswordPolicy.message(Problem.TOO_LONG, "New password")).startsWith("New password").contains("72");
        assertThat(PasswordPolicy.message(Problem.TOO_COMMON, "Password")).startsWith("Password").contains("common");
        assertThat(PasswordPolicy.message(Problem.CONTAINS_USERNAME, "Password")).startsWith("Password").contains("username");
    }

    @Test
    void shouldReadTheList_skippingCommentsAndBlankLines_trimmingAndLowercasing() {
        assertThat(PasswordPolicy.loadCommonPasswords("/security/passwords-for-loader-test.txt"))
                .containsExactlyInAnyOrder("letmein123", "trailing-space-1");
    }

    @Test
    void shouldRefuseToStart_whenTheListOfCommonPasswordsIsMissing() {
        assertThatThrownBy(() -> PasswordPolicy.loadCommonPasswords("/security/no-such-list.txt"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("missing");
    }

    @Test
    void shouldKeepAListOfCommonPasswords_thatIsLowercase_trimmed_andOnlyHoldsPasswordsThatWouldOtherwisePass() throws Exception {
        List<String> entries = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                PasswordPolicyTest.class.getResourceAsStream("/security/common-passwords.txt"), StandardCharsets.UTF_8))) {
            for (String line = reader.readLine(); line != null; line = reader.readLine()) {
                if (!line.isBlank() && !line.startsWith("#")) entries.add(line);
            }
        }

        assertThat(entries).hasSizeGreaterThan(100);
        assertThat(entries).allSatisfy(entry -> {
            assertThat(entry).isEqualTo(entry.trim().toLowerCase());
            assertThat(entry.length()).as("shorter ones are refused by the length rule anyway: " + entry).isGreaterThanOrEqualTo(PasswordPolicy.MIN_LENGTH);
        });
        assertThat(entries).doesNotHaveDuplicates();
        assertThat(entries).contains("password", "12345678", "manager123", "staff123", "admin123");
    }
}

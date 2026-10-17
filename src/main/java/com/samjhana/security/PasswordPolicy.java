package com.samjhana.security;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * The one rule for a new password, used when a person changes theirs, when an admin creates an account and for the
 * first admin (finding A-02). Before this each place had its own length check and nothing else: "12345678" and
 * "password" were fine, and a password over BCrypt's 72-byte limit was only refused by the library's own technical message.
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    /** BCrypt only uses the first 72 bytes of a password; a longer one is refused instead of being quietly cut. */
    public static final int MAX_BYTES = 72;
    /** A shorter username would match too many ordinary passwords to be worth refusing them for. */
    public static final int MIN_USERNAME_LENGTH_CHECKED = 4;

    private static final String COMMON_PASSWORDS_FILE = "/security/common-passwords.txt";
    private static final Set<String> COMMON_PASSWORDS = loadCommonPasswords(COMMON_PASSWORDS_FILE);

    public enum Problem {
        TOO_SHORT("PASSWORD_TOO_SHORT"),
        TOO_LONG("PASSWORD_TOO_LONG"),
        TOO_COMMON("PASSWORD_TOO_COMMON"),
        CONTAINS_USERNAME("PASSWORD_HAS_USERNAME");

        private final String code;

        Problem(String code) {
            this.code = code;
        }

        /** What the screens use to show the message in the person's own language. */
        public String code() {
            return code;
        }
    }

    private PasswordPolicy() {
    }

    /** The first reason this password cannot be used for this username, or empty when it can. */
    public static Optional<Problem> check(String password, String username) {
        if (password == null || password.codePointCount(0, password.length()) < MIN_LENGTH) {
            return Optional.of(Problem.TOO_SHORT);
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            return Optional.of(Problem.TOO_LONG);
        }
        if (isTooEasyToGuess(password)) {
            return Optional.of(Problem.TOO_COMMON);
        }
        if (containsUsername(password, username)) {
            return Optional.of(Problem.CONTAINS_USERNAME);
        }
        return Optional.empty();
    }

    /** The sentence shown to the person typing, for example "New password must be at least 8 characters". */
    public static String message(Problem problem, String label) {
        return switch (problem) {
            case TOO_SHORT -> label + " must be at least " + MIN_LENGTH + " characters";
            case TOO_LONG -> label + " is too long. Use at most " + MAX_BYTES + " characters (a Nepali letter counts as 3)";
            case TOO_COMMON -> label + " is too common or too easy to guess. Choose something less obvious";
            case CONTAINS_USERNAME -> label + " must not contain the username";
        };
    }

    /** Spaces only, one character repeated, or on the list of passwords everyone tries first (in any capitals). */
    private static boolean isTooEasyToGuess(String password) {
        return password.isBlank()
                || password.codePoints().distinct().count() == 1
                || COMMON_PASSWORDS.contains(password.toLowerCase(Locale.ROOT));
    }

    private static boolean containsUsername(String password, String username) {
        if (username == null) return false;
        String name = username.trim().toLowerCase(Locale.ROOT);
        return name.codePointCount(0, name.length()) >= MIN_USERNAME_LENGTH_CHECKED
                && password.toLowerCase(Locale.ROOT).contains(name);
    }

    /** Fails loudly when the list is missing: a policy that silently allows everything would look like it works. */
    static Set<String> loadCommonPasswords(String file) {
        try (InputStream stream = PasswordPolicy.class.getResourceAsStream(file)) {
            if (stream == null) {
                throw new IllegalStateException("The list of common passwords is missing: " + file);
            }
            Set<String> found = new HashSet<>();
            BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
            for (String line = reader.readLine(); line != null; line = reader.readLine()) {
                String entry = line.trim();
                if (!entry.isEmpty() && !entry.startsWith("#")) found.add(entry.toLowerCase(Locale.ROOT));
            }
            return Set.copyOf(found);
        } catch (IOException e) {
            throw new UncheckedIOException("The list of common passwords could not be read", e);
        }
    }
}

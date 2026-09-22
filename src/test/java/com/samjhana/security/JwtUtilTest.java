package com.samjhana.security;

import io.jsonwebtoken.security.WeakKeyException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The JWT-secret guard. The published development fallback must be refused because of the secret's
 * value, whatever Spring profile happens to be active: an internet-reachable staging, preview or
 * unlabeled deployment must not be able to sign sessions with a secret that is public in the repo.
 */
class JwtUtilTest {

    private static final String DEV_FALLBACK_SECRET = "dev-only-insecure-jwt-secret-CHANGE-IN-PRODUCTION";
    private static final String STRONG_SECRET = "0123456789-a-real-production-secret-value-abcdef";
    private static final String OTHER_STRONG_SECRET = "zyxwvutsrq-a-different-production-secret-value";

    private static MockEnvironment profiles(String... active) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(active);
        return environment;
    }

    /** "none" stands for no explicit profile (Spring's default profile); a comma separates several. */
    private static MockEnvironment profilesFrom(String csv) {
        return "none".equals(csv) ? profiles() : profiles(csv.split(","));
    }

    // ---- the fix: value-based, in every profile ----------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {"none", "dev", "test", "staging", "preview", "render", "prod", "render,prod"})
    void shouldRefuseTheDevFallbackSecret_whateverProfileIsActive(String activeProfiles) {
        IllegalStateException failure = assertThrows(IllegalStateException.class,
                () -> new JwtUtil(DEV_FALLBACK_SECRET, 1, profilesFrom(activeProfiles)),
                "the dev fallback secret must never be accepted, profile(s): " + activeProfiles);

        assertTrue(failure.getMessage().contains("JWT_SECRET"), "the error must tell the operator which variable to set");
    }

    @Test
    void shouldNameTheActiveProfilesInTheError_soTheOperatorCanSeeWhatWasDeployed() {
        IllegalStateException failure = assertThrows(IllegalStateException.class,
                () -> new JwtUtil(DEV_FALLBACK_SECRET, 1, profiles("staging")));

        assertTrue(failure.getMessage().contains("staging"), failure.getMessage());
    }

    @Test
    void shouldRefuseTheDefaultThatApplicationYmlShips_inANonProdProfile() {
        // The shipped default is the value an operator gets when JWT_SECRET is simply not set.
        String shippedDefault = shippedJwtSecretDefault();

        assertThrows(IllegalStateException.class, () -> new JwtUtil(shippedDefault, 1, profiles("staging")));
        assertThrows(IllegalStateException.class, () -> new JwtUtil(shippedDefault, 1, profiles()));
    }

    @Test
    void shouldRefuseAnyVariantOfTheDevFallback_notOnlyTheExactPublishedString() {
        assertThrows(IllegalStateException.class,
                () -> new JwtUtil("dev-only-insecure-" + "x".repeat(40), 1, profiles("staging")));
    }

    @Test
    void shouldRefuseTheEnvExamplePlaceholder_whenSomeoneShipsItUnedited() {
        // .env.example is a template to copy and fill in; someone who copies it without editing it
        // must be refused too, not just someone who never sets JWT_SECRET at all.
        String placeholder = envExamplePlaceholderValue();

        assertThrows(IllegalStateException.class, () -> new JwtUtil(placeholder, 1, profiles("staging")));
        assertThrows(IllegalStateException.class, () -> new JwtUtil(placeholder, 1, profiles()));
    }

    // ---- no over-blocking ---------------------------------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {"none", "dev", "test", "staging", "prod"})
    void shouldAcceptARealSecret_inEveryProfile(String activeProfiles) {
        JwtUtil jwt = new JwtUtil(STRONG_SECRET, 1, profilesFrom(activeProfiles));

        String token = jwt.generateToken("admin");

        assertTrue(jwt.isTokenValid(token));
        assertEquals("admin", jwt.extractUsername(token));
    }

    @Test
    void shouldOnlyRejectASecretThatStartsWithTheFallbackPrefix_notOneThatMerelyContainsIt() {
        JwtUtil jwt = new JwtUtil("abcdefghijklmnopqrstuvwxyz-dev-only-insecure-0123456789", 1, profiles("staging"));

        assertTrue(jwt.isTokenValid(jwt.generateToken("admin")));
    }

    // ---- unchanged behaviour ------------------------------------------------------------------------

    @Test
    void shouldFailFast_whenTheSecretIsShorterThan32Bytes() {
        // The "shorter than 32 bytes" warning is followed by key construction, which rejects a weak HS256 key.
        assertThrows(WeakKeyException.class, () -> new JwtUtil("too-short-secret", 1, profiles("dev")));
    }

    @Test
    void shouldRejectATokenSignedWithADifferentSecret() {
        JwtUtil issuer = new JwtUtil(STRONG_SECRET, 1, profiles("prod"));
        JwtUtil verifier = new JwtUtil(OTHER_STRONG_SECRET, 1, profiles("prod"));

        assertFalse(verifier.isTokenValid(issuer.generateToken("admin")));
    }

    @Test
    void shouldRejectAMalformedToken() {
        JwtUtil jwt = new JwtUtil(STRONG_SECRET, 1, profiles("prod"));

        assertFalse(jwt.isTokenValid("not-a-jwt"));
    }

    // ---- helpers ------------------------------------------------------------------------------------

    private static String shippedJwtSecretDefault() {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        Properties properties = yaml.getObject();
        assertNotNull(properties);
        String configured = properties.getProperty("samjhana.security.jwt.secret");
        assertNotNull(configured, "samjhana.security.jwt.secret must be defined in application.yml");

        Matcher placeholder = Pattern.compile("^\\$\\{JWT_SECRET:(.+)}$").matcher(configured);
        assertTrue(placeholder.matches(), "expected a ${JWT_SECRET:<default>} placeholder, was: " + configured);
        return placeholder.group(1);
    }

    /** .env.example lives at the repo root, not on the classpath — Maven's test working directory. */
    private static String envExamplePlaceholderValue() {
        Path envExample = Path.of(".env.example");
        assertTrue(Files.isRegularFile(envExample),
                ".env.example must exist at the repo root (looked in " + envExample.toAbsolutePath() + ")");

        String jwtLine;
        try {
            jwtLine = Files.readAllLines(envExample).stream()
                    .filter(line -> line.startsWith("JWT_SECRET="))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError(".env.example has no JWT_SECRET= line"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return jwtLine.substring("JWT_SECRET=".length());
    }
}

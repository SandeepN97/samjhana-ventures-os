package com.samjhana.security;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.jsonwebtoken.security.WeakKeyException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The production JWT-secret guard: a prod boot must never sign tokens with the published dev fallback. */
class JwtUtilTest {

    private static final String DEV_FALLBACK_SECRET = "dev-only-insecure-jwt-secret-CHANGE-IN-PRODUCTION";
    private static final String STRONG_SECRET = "0123456789-a-real-production-secret-value-abcdef";
    private static final String OTHER_STRONG_SECRET = "zyxwvutsrq-a-different-production-secret-value";

    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private final Logger jwtLogger = (Logger) LoggerFactory.getLogger(JwtUtil.class);

    @BeforeEach
    void captureLogs() {
        logs.start();
        jwtLogger.addAppender(logs);
    }

    @AfterEach
    void releaseLogs() {
        jwtLogger.detachAppender(logs);
    }

    private static MockEnvironment profiles(String... active) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(active);
        return environment;
    }

    private boolean warned(String fragment) {
        return logs.list.stream().anyMatch(e -> e.getLevel() == Level.WARN && e.getFormattedMessage().contains(fragment));
    }

    @Test
    void shouldRefuseToStart_whenProdProfileUsesTheDevFallbackSecret() {
        IllegalStateException failure = assertThrows(IllegalStateException.class,
                () -> new JwtUtil(DEV_FALLBACK_SECRET, 1, profiles("prod")));

        assertTrue(failure.getMessage().contains("JWT_SECRET"), "the error must tell the operator which variable to set");
    }

    @Test
    void shouldRefuseToStart_whenProdIsOneOfSeveralActiveProfiles() {
        assertThrows(IllegalStateException.class,
                () -> new JwtUtil(DEV_FALLBACK_SECRET, 1, profiles("render", "prod")));
    }

    @Test
    void shouldStartAndSignTokens_whenProdProfileUsesARealSecret() {
        JwtUtil jwt = new JwtUtil(STRONG_SECRET, 1, profiles("prod"));

        String token = jwt.generateToken("admin");

        assertTrue(jwt.isTokenValid(token));
        assertEquals("admin", jwt.extractUsername(token));
        assertFalse(warned("dev fallback"), "a real secret must not trigger the dev-fallback warning");
    }

    @Test
    void shouldStartWithAWarning_whenTheDevFallbackIsUsedOutsideProd() {
        for (String[] active : List.of(new String[] {}, new String[] {"dev"}, new String[] {"test"})) {
            logs.list.clear();

            JwtUtil jwt = new JwtUtil(DEV_FALLBACK_SECRET, 1, profiles(active));

            assertTrue(jwt.isTokenValid(jwt.generateToken("admin")));
            assertTrue(warned("dev fallback"), "expected a dev-fallback warning for profiles " + List.of(active));
        }
    }

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

    @Test
    void shouldShipADevFallbackDefaultThatTheProdGuardRecognises() {
        // If someone edits the default in application.yml, the guard would silently stop matching it.
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        Properties properties = yaml.getObject();

        assertNotNull(properties);
        String configured = properties.getProperty("samjhana.security.jwt.secret");
        assertNotNull(configured, "samjhana.security.jwt.secret must be defined in application.yml");
        assertTrue(configured.contains(":dev-only-insecure"),
                "the JWT_SECRET fallback must start with the prefix JwtUtil refuses in prod, was: " + configured);
    }
}

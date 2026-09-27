package com.samjhana.config;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OcppPropertiesTest {

    private static final Map<String, String> PUBLISHED = Map.of("HD-D180-CC-01", "dev-HD-D180-CC-01-change-me");
    private static final Map<String, String> REAL = Map.of("HD-D180-CC-01", "q8Zt1r0vF0mJb2sW3xYk6aPn");

    private OcppProperties properties(Map<String, String> secrets, String... profiles) {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles(profiles);
        OcppProperties props = new OcppProperties(env);
        props.setStationSecrets(new LinkedHashMap<>(secrets));
        return props;
    }

    @ParameterizedTest
    @ValueSource(strings = {"staging", "prod"})
    void shouldRefuseThePublishedDevSecrets_onAnInternetFacingProfile(String profile) {
        assertThatThrownBy(() -> properties(PUBLISHED, profile).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("OCPP_SECRET_");
    }

    @ParameterizedTest
    @ValueSource(strings = {"staging", "prod"})
    void shouldRefuseMissingSecrets_onAnInternetFacingProfile(String profile) {
        assertThatThrownBy(() -> properties(Map.of(), profile).validate()).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> properties(Map.of("HD-D180-CC-01", " "), profile).validate())
                .isInstanceOf(IllegalStateException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"staging", "prod"})
    void shouldAcceptRealSecrets_onAnInternetFacingProfile(String profile) {
        assertThatCode(() -> properties(REAL, profile).validate()).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"dev", "test"})
    void shouldAllowTheDevSecrets_onADevelopersMachineOrInTests(String profile) {
        assertThatCode(() -> properties(PUBLISHED, profile).validate()).doesNotThrowAnyException();
    }

    @Test
    void shouldAllowTheDevSecrets_whenNoProfileIsActive() {
        assertThatCode(() -> properties(PUBLISHED).validate()).doesNotThrowAnyException();
    }
}

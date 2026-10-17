package com.samjhana.config;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
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

    // ---- finding P1B1-01 ----

    @Test
    void shouldNameThePublishedDevSecretOfACharger() {
        assertThat(OcppProperties.publishedDevSecretFor("HD-D180-CC-01")).isEqualTo("dev-HD-D180-CC-01-change-me");
    }

    @ParameterizedTest
    @ValueSource(strings = {"HD-D180-CC-01", "HQC23-80-01", "HD-D140-E-01"})
    void shouldStayInStepWithTheDefaultsPublishedInApplicationYml(String code) throws Exception {
        List<PropertySource<?>> documents = new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"));
        Object raw = documents.stream()
                .map(source -> source.getProperty("samjhana.ocpp.station-secrets." + code))
                .filter(java.util.Objects::nonNull)
                .findFirst().orElseThrow();

        assertThat(raw.toString()).endsWith(":" + OcppProperties.publishedDevSecretFor(code) + "}");
    }

    @Test
    void shouldReturnTheConfiguredSecretOnlyWhenThereIsOne() {
        OcppProperties props = properties(Map.of("HD-D180-CC-01", "q8Zt1r0vF0mJb2sW3xYk6aPn", "HQC23-80-01", " "));

        assertThat(props.configuredSecretFor("HD-D180-CC-01")).contains("q8Zt1r0vF0mJb2sW3xYk6aPn");
        assertThat(props.configuredSecretFor("HQC23-80-01")).isEqualTo(Optional.empty());
        assertThat(props.configuredSecretFor("HD-D140-E-01")).isEqualTo(Optional.empty());
    }
}

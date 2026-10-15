package com.samjhana.ocpp.diag;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mockito;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggerConfiguration;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;

import java.io.IOException;
import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class ForbiddenLogSettingsTest {

    private static final Function<String, LogLevel> ALL_INFO = name -> LogLevel.INFO;

    // ---------------------------------------------------------------- the checked-in configuration

    /** Fails the build if the repository's own configuration ever turns a forbidden setting on. */
    @ParameterizedTest
    @ValueSource(strings = {"default", "dev", "staging", "prod", "test"})
    void shouldHaveNoForbiddenLogSetting_inTheCheckedInConfigurationOfEveryProfile(String profile) throws IOException {
        MockEnvironment env = new MockEnvironment();
        if (!profile.equals("default")) env.setActiveProfiles(profile);
        loadInto(env, "application.yml", profile);
        if (profile.equals("test")) loadInto(env, "application-test.yml", profile);

        List<ForbiddenLogSettings.Violation> violations = ForbiddenLogSettings.check(env, levelsFrom(env));

        assertThat(violations).as("forbidden log settings active in profile '%s'", profile).isEmpty();
    }

    @Test
    void shouldKeepDevBindLoggingButFlagItInAHostedProfile() throws IOException {
        MockEnvironment dev = new MockEnvironment();
        dev.setActiveProfiles("dev");
        loadInto(dev, "application.yml", "dev");
        // The dev profile does print bound SQL values (documented in the runbook): allowed locally...
        assertThat(levelsFrom(dev).apply("org.hibernate.type.descriptor.sql.BasicBinder")).isEqualTo(LogLevel.TRACE);
        assertThat(ForbiddenLogSettings.check(dev, levelsFrom(dev))).isEmpty();

        // ...but the same setting under staging or prod is a violation.
        MockEnvironment staging = new MockEnvironment();
        staging.setActiveProfiles("staging");
        List<ForbiddenLogSettings.Violation> violations = ForbiddenLogSettings.check(staging,
                name -> name.endsWith("BasicBinder") ? LogLevel.TRACE : LogLevel.INFO);
        assertThat(violations).extracting(ForbiddenLogSettings.Violation::setting)
                .anyMatch(setting -> setting.contains("BasicBinder"));
    }

    // ---------------------------------------------------------------- the detector

    @Test
    void shouldFlagRequestDetailLogging() {
        MockEnvironment env = new MockEnvironment().withProperty("spring.mvc.log-request-details", "true");

        assertThat(ForbiddenLogSettings.check(env, ALL_INFO)).extracting(ForbiddenLogSettings.Violation::setting)
                .containsExactly("spring.mvc.log-request-details=true");
    }

    @Test
    void shouldFlagTraceOnWebAndDebugOnWebSocket() {
        MockEnvironment env = new MockEnvironment();
        Function<String, LogLevel> levels = name -> switch (name) {
            case "org.springframework.web" -> LogLevel.TRACE;
            case "org.springframework.web.socket" -> LogLevel.DEBUG;
            default -> LogLevel.INFO;
        };

        assertThat(ForbiddenLogSettings.check(env, levels)).extracting(ForbiddenLogSettings.Violation::setting)
                .containsExactly("TRACE on org.springframework.web", "DEBUG on org.springframework.web.socket");
        assertThat(ForbiddenLogSettings.check(env, name -> name.equals("_org.springframework.web") ? LogLevel.TRACE : LogLevel.INFO))
                .extracting(ForbiddenLogSettings.Violation::setting).containsExactly("TRACE on _org.springframework.web");
    }

    @Test
    void shouldFlagTomcatRequestLogging_includingARootLoggerSetToDebug() {
        MockEnvironment env = new MockEnvironment();

        assertThat(ForbiddenLogSettings.check(env, name -> name.equals("org.apache.coyote") ? LogLevel.DEBUG : LogLevel.INFO))
                .extracting(ForbiddenLogSettings.Violation::setting).singleElement().asString().contains("org.apache.coyote");
        // a DEBUG root logger reaches every child logger, so every rule above fires
        assertThat(ForbiddenLogSettings.check(env, name -> LogLevel.DEBUG)).hasSizeGreaterThanOrEqualTo(2);
    }

    @Test
    void shouldAllowDebugOnWeb_butNotOnWebSocket() {
        MockEnvironment env = new MockEnvironment();

        assertThat(ForbiddenLogSettings.check(env,
                name -> name.equals("org.springframework.web") ? LogLevel.DEBUG : LogLevel.INFO)).isEmpty();
    }

    @Test
    void shouldWarnAtStartup_whenAForbiddenSettingIsActive() {
        LoggingSystem loggingSystem = Mockito.mock(LoggingSystem.class);
        LoggerConfiguration trace = new LoggerConfiguration("x", LogLevel.TRACE, LogLevel.TRACE);
        when(loggingSystem.getLoggerConfiguration(anyString())).thenReturn(trace);
        MockEnvironment env = new MockEnvironment().withProperty("spring.mvc.log-request-details", "true");
        OcppStartupReporter reporter = new OcppStartupReporter(env, loggingSystem, new OcppLoggingProperties());

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            List<ForbiddenLogSettings.Violation> violations = reporter.warnForbidden();

            assertThat(violations).isNotEmpty();
            assertThat(capture.matching("FORBIDDEN LOG SETTING")).hasSize(violations.size());
        }
    }

    @Test
    void shouldReportBlindSpotAndServerTimesAtStartup() {
        LoggingSystem loggingSystem = Mockito.mock(LoggingSystem.class);
        when(loggingSystem.getLoggerConfiguration(anyString()))
                .thenReturn(new LoggerConfiguration("x", LogLevel.INFO, LogLevel.INFO));
        OcppStartupReporter reporter = new OcppStartupReporter(new MockEnvironment(), loggingSystem,
                new OcppLoggingProperties());

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            reporter.report();

            assertThat(capture.matching("BLIND SPOT")).hasSize(1);
            assertThat(capture.matching("host's HTTP request log")).hasSize(1);
            assertThat(capture.matching("Server time UTC=")).hasSize(1).first().asString().contains("Nepal=");
            assertThat(capture.matching("FORBIDDEN")).isEmpty();
        }
    }

    // ---------------------------------------------------------------- helpers

    /** Applies the YAML documents that belong to the profile, later documents overriding earlier ones. */
    private static void loadInto(MockEnvironment env, String resource, String profile) throws IOException {
        List<PropertySource<?>> documents = new YamlPropertySourceLoader().load(resource, new ClassPathResource(resource));
        for (PropertySource<?> document : documents) {
            Object activate = document.getProperty("spring.config.activate.on-profile");
            if (activate != null && !activate.toString().equals(profile)) continue;
            env.getPropertySources().addFirst(new MapPropertySource(resource + "#" + env.getPropertySources().size(),
                    flatten(document)));
        }
    }

    private static java.util.Map<String, Object> flatten(PropertySource<?> document) {
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        for (String name : ((org.springframework.core.env.EnumerablePropertySource<?>) document).getPropertyNames()) {
            map.put(name, document.getProperty(name));
        }
        return map;
    }

    /** Effective level for a logger name from logging.level.* properties, walking up to the parent loggers. */
    private static Function<String, LogLevel> levelsFrom(MockEnvironment env) {
        return name -> {
            String candidate = name;
            while (true) {
                String value = env.getProperty("logging.level." + candidate);
                if (value != null) return LogLevel.valueOf(value.toUpperCase());
                int dot = candidate.lastIndexOf('.');
                if (dot < 0) break;
                candidate = candidate.substring(0, dot);
            }
            String root = env.getProperty("logging.level.root");
            return root == null ? LogLevel.INFO : LogLevel.valueOf(root.toUpperCase());
        };
    }
}

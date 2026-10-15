package com.samjhana.ocpp.diag;

import org.slf4j.Logger;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggerConfiguration;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

/** Startup notes for the operator: server time, settings, the blind spot before our code, forbidden log settings. */
@Component
public class OcppStartupReporter {

    private static final Logger LIFECYCLE = OcppLoggers.LIFECYCLE;

    private final Environment environment;
    private final LoggingSystem loggingSystem;
    private final OcppLoggingProperties properties;

    public OcppStartupReporter(Environment environment, LoggingSystem loggingSystem, OcppLoggingProperties properties) {
        this.environment = environment;
        this.loggingSystem = loggingSystem;
        this.properties = properties;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void report() {
        Instant now = Instant.now();
        LIFECYCLE.info("OCPP diagnostics ready. Server time UTC={} Nepal={}. Frames, handshakes, commands and lock "
                        + "evidence are logged on com.samjhana.ocpp.{frames,handshake,lifecycle,commands,lockevidence} "
                        + "and stored in ocpp_* tables (persistence enabled={}, retention {} days, heartbeat frames "
                        + "logged in full: first {}, then 1 summary per {}, command timeout {}s, server ping {}).",
                now.atZone(ZoneOffset.UTC), now.atZone(ZoneId.of("Asia/Kathmandu")),
                properties.getPersistence().isEnabled(), properties.getPersistence().getRetentionDays(),
                properties.getHeartbeatFullFrames(), properties.getHeartbeatSummaryEvery(),
                properties.getCommandTimeout().toSeconds(),
                properties.getPingInterval().isZero() ? "off" : properties.getPingInterval());
        LIFECYCLE.info("BLIND SPOT: failures before a request reaches this application (TLS handshake, DNS, the hosting "
                + "provider's proxy or any edge/CDN in front) are invisible to these logs. If a charger cannot connect "
                + "and no HANDSHAKE or REQUEST line appears here, check the host's HTTP request log.");
        warnForbidden();
    }

    /** WARNs for each forbidden setting; returns them (also used by tests). */
    public List<ForbiddenLogSettings.Violation> warnForbidden() {
        List<ForbiddenLogSettings.Violation> violations = ForbiddenLogSettings.check(environment, this::effective);
        for (ForbiddenLogSettings.Violation violation : violations) {
            LIFECYCLE.warn("FORBIDDEN LOG SETTING while OCPP endpoints are active: {} ({}). Turn it off: the "
                    + "Authorization header and secrets could reach the log.", violation.setting(), violation.why());
        }
        return violations;
    }

    private LogLevel effective(String loggerName) {
        LoggerConfiguration configuration = loggingSystem.getLoggerConfiguration(loggerName);
        return configuration == null ? null : configuration.getEffectiveLevel();
    }
}

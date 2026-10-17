package com.samjhana.ocpp.diag;

import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.ocpp.OcppConnectionRegistry;
import org.slf4j.Logger;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.PingMessage;

import java.time.Duration;
import java.time.Instant;

/**
 * Periodic OCPP checks, driven by one 5-second tick so the intervals come straight from
 * {@code ocpp.logging.*}: command timeouts, idle-connection detection and (optionally) server pings.
 * None of them closes a connection or changes business state; they only log and record. (A connection that stays silent
 * for longer than the idle warning is closed, and a charger left ONLINE without a connection is corrected, by
 * {@code OcppLivenessSweep}.)
 */
@Component
public class OcppHousekeeping {

    private static final Logger LIFECYCLE = OcppLoggers.LIFECYCLE;
    private static final Duration IDLE_REPEAT = Duration.ofMinutes(5);

    private final OcppConnectionRegistry registry;
    private final OcppCommandAudit commandAudit;
    private final OcppAuditWriter auditWriter;
    private final OcppLoggingProperties properties;

    private Instant lastCommandSweep = Instant.EPOCH;
    private Instant lastIdleCheck = Instant.EPOCH;

    public OcppHousekeeping(OcppConnectionRegistry registry, OcppCommandAudit commandAudit,
                            OcppAuditWriter auditWriter, OcppLoggingProperties properties) {
        this.registry = registry;
        this.commandAudit = commandAudit;
        this.auditWriter = auditWriter;
        this.properties = properties;
    }

    @Scheduled(fixedDelay = 5_000, initialDelay = 5_000)
    void tick() {
        Instant now = Instant.now();
        if (Duration.between(lastCommandSweep, now).compareTo(properties.getCommandSweepInterval()) >= 0) {
            lastCommandSweep = now;
            sweepCommands();
        }
        if (Duration.between(lastIdleCheck, now).compareTo(properties.getIdleCheckInterval()) >= 0) {
            lastIdleCheck = now;
            checkIdle();
        }
        sendPings();
    }

    /** Commands with no reply after the timeout: WARN and record TIMED_OUT. */
    public void sweepCommands() {
        for (OcppConnectionRegistry.PendingCommand command : registry.expire(properties.getCommandTimeout())) {
            commandAudit.timedOut(command, properties.getCommandTimeout());
        }
    }

    /** WARN when no frame has arrived for more than idleFactor x the heartbeat interval. */
    public void checkIdle() {
        Instant now = Instant.now();
        for (OcppConnectionRegistry.Connection connection : registry.connections()) {
            OcppConnectionState state = connection.state();
            Duration idle = Duration.between(state.lastFrameAt(), now);
            long thresholdMs = (long) (state.heartbeatIntervalSeconds() * 1000 * properties.getIdleFactor());
            if (idle.toMillis() <= thresholdMs) {
                state.idleWarnedAt(null);
                continue;
            }
            Instant warned = state.idleWarnedAt();
            if (warned != null && Duration.between(warned, now).compareTo(IDLE_REPEAT) < 0) continue;
            state.idleWarnedAt(now);
            String code = state.chargePointCode();
            try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(state.wsSessionId())) {
                LIFECYCLE.warn("IDLE chargePointId={} sessionId={}: no frame for {}s (threshold {}s = {} x heartbeat "
                                + "interval {}s); last pong={}. The link may be half-open or the charger stopped talking.",
                        code, state.wsSessionId(), idle.toSeconds(), thresholdMs / 1000, properties.getIdleFactor(),
                        state.heartbeatIntervalSeconds(), state.lastPongAt());
                auditWriter.enqueue(OcppConnectionLog.builder()
                        .chargePointId(code)
                        .wsSessionId(state.wsSessionId())
                        .event(OcppConnectionLog.Event.IDLE_WARNING)
                        .reason("NO_FRAME_" + idle.toSeconds() + "S")
                        .remoteAddr(state.remoteAddress())
                        .createdAt(now)
                        .build());
            }
        }
    }

    /** Server-sent WebSocket pings; off unless ocpp.logging.ping-interval is above zero. */
    public void sendPings() {
        Duration interval = properties.getPingInterval();
        if (interval == null || interval.isZero() || interval.isNegative()) return;
        Instant now = Instant.now();
        for (OcppConnectionRegistry.Connection connection : registry.connections()) {
            OcppConnectionState state = connection.state();
            if (state.lastPingAt() != null && Duration.between(state.lastPingAt(), now).compareTo(interval) < 0) continue;
            try (OcppMdc mdc = OcppMdc.open().chargePoint(state.chargePointCode()).session(state.wsSessionId())) {
                connection.session().sendMessage(new PingMessage());
                state.lastPingAt(now);
                LIFECYCLE.debug("PING sent to {}", state.chargePointCode());
            } catch (Exception ex) {
                LIFECYCLE.warn("PING to {} failed: {}", state.chargePointCode(), ex.toString());
            }
        }
    }
}

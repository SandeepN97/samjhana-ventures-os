package com.samjhana.ocpp.diag;

import com.fasterxml.jackson.databind.JsonNode;
import com.samjhana.entity.OcppCommandLog;
import com.samjhana.ocpp.OcppConnectionRegistry.PendingCommand;
import org.slf4j.Logger;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * Logs and records the life of every command we send to a charger: sent, answered (CALLRESULT or
 * CALLERROR, matched by messageId, with latency), timed out, lost to a disconnect, or unmatched.
 */
@Component
public class OcppCommandAudit {

    private static final Logger COMMANDS = OcppLoggers.COMMANDS;

    private final OcppAuditWriter writer;
    private final LockEvidenceTracker lockEvidence;

    public OcppCommandAudit(OcppAuditWriter writer, LockEvidenceTracker lockEvidence) {
        this.writer = writer;
        this.lockEvidence = lockEvidence;
    }

    public void sent(PendingCommand c) {
        try (OcppMdc mdc = context(c)) {
            COMMANDS.info("COMMAND SENT {} messageId={} chargeSessionId={} evse={} connector={} idToken={} reason=\"{}\"",
                    c.action(), c.messageId(), c.chargeSessionId(), c.evseId(), c.connectorId(),
                    c.maskedIdToken(), c.reason());
        }
        lockEvidence.commandSent(c);
    }

    public void sendFailed(PendingCommand c, Exception ex) {
        try (OcppMdc mdc = context(c)) {
            COMMANDS.error("COMMAND SEND FAILED {} messageId={} chargeSessionId={}: {}",
                    c.action(), c.messageId(), c.chargeSessionId(), ex.toString(), ex);
            record(c, OcppCommandLog.Outcome.SEND_FAILED, null, null, null, null, ex.toString());
        }
    }

    /** CALLRESULT matched to a command. */
    public void answered(PendingCommand c, JsonNode payload) {
        String status = payload == null ? null : payload.path("status").asText(null);
        JsonNode statusInfo = payload == null ? null : payload.path("statusInfo");
        String reasonCode = statusInfo == null ? null : statusInfo.path("reasonCode").asText(null);
        String additional = statusInfo == null ? null : statusInfo.path("additionalInfo").asText(null);
        long latency = latencyMs(c);
        try (OcppMdc mdc = context(c)) {
            COMMANDS.info("COMMAND RESULT {} messageId={} chargeSessionId={} latency={}ms status={} reasonCode={} additionalInfo={}",
                    c.action(), c.messageId(), c.chargeSessionId(), latency, status, reasonCode,
                    LogSafe.clean(additional, 200));
            record(c, OcppCommandLog.Outcome.RESULT, status, reasonCode, null, null, additional);
        }
        lockEvidence.commandAnswered(c, status == null ? "no status" : status);
    }

    /** CALLERROR matched to a command: errorCode (index 2), errorDescription (3), errorDetails (4). */
    public void errored(PendingCommand c, String errorCode, String description, JsonNode details) {
        long latency = latencyMs(c);
        String detailText = details == null ? null : details.toString();
        try (OcppMdc mdc = context(c)) {
            COMMANDS.warn("COMMAND ERROR {} messageId={} chargeSessionId={} latency={}ms errorCode={} errorDescription=\"{}\" errorDetails={}",
                    c.action(), c.messageId(), c.chargeSessionId(), latency, errorCode,
                    LogSafe.clean(description, 300), LogSafe.clean(detailText, 500));
            record(c, OcppCommandLog.Outcome.ERROR, null, null, errorCode, description, detailText);
        }
        lockEvidence.commandAnswered(c, "CALLERROR " + errorCode);
    }

    public void timedOut(PendingCommand c, Duration timeout) {
        try (OcppMdc mdc = context(c)) {
            COMMANDS.warn("COMMAND TIMEOUT {} messageId={} chargeSessionId={}: no reply after {}s",
                    c.action(), c.messageId(), c.chargeSessionId(), timeout.toSeconds());
            record(c, OcppCommandLog.Outcome.TIMED_OUT, null, null, null, null,
                    "no reply after " + timeout.toSeconds() + "s");
        }
        lockEvidence.commandAnswered(c, "TIMED OUT");
    }

    public void lostToDisconnect(PendingCommand c) {
        try (OcppMdc mdc = context(c)) {
            COMMANDS.warn("COMMAND LOST {} messageId={} chargeSessionId={}: charger disconnected before replying",
                    c.action(), c.messageId(), c.chargeSessionId());
            record(c, OcppCommandLog.Outcome.DISCONNECTED, null, null, null, null, "charger disconnected before replying");
        }
        lockEvidence.commandAnswered(c, "DISCONNECTED");
    }

    /** A CALLRESULT/CALLERROR whose messageId matches no pending command. */
    public void unmatched(String chargePointCode, String wsSessionId, String messageId, int messageType,
                          String maskedPayload, PendingCommand expired) {
        try (OcppMdc mdc = OcppMdc.open().chargePoint(chargePointCode).session(wsSessionId).message(messageId)) {
            if (expired != null) {
                COMMANDS.warn("LATE REPLY to {} messageId={} chargeSessionId={}: arrived {}ms after send, "
                                + "after the command had already timed out. payload={}",
                        expired.action(), messageId, expired.chargeSessionId(), latencyMs(expired), maskedPayload);
            } else {
                COMMANDS.warn("UNMATCHED {} messageId={}: no command with this id is pending (stale, duplicate or "
                                + "unsolicited). payload={}",
                        messageType == 3 ? "CALLRESULT" : "CALLERROR", messageId, maskedPayload);
            }
        }
    }

    private OcppMdc context(PendingCommand c) {
        return OcppMdc.open().chargePoint(c.chargePointCode()).session(c.wsSessionId())
                .message(c.messageId()).action(c.action()).chargeSession(c.chargeSessionId());
    }

    private long latencyMs(PendingCommand c) {
        return Duration.between(c.sentInstant(), Instant.now()).toMillis();
    }

    private void record(PendingCommand c, OcppCommandLog.Outcome outcome, String status, String reasonCode,
                        String errorCode, String errorDescription, String detail) {
        Instant now = Instant.now();
        writer.enqueue(OcppCommandLog.builder()
                .chargePointId(c.chargePointCode() == null ? "unknown" : c.chargePointCode())
                .wsSessionId(c.wsSessionId())
                .messageId(c.messageId())
                .action(c.action())
                .chargeSessionId(c.chargeSessionId())
                .evseId(c.evseId())
                .connectorId(c.connectorId())
                .reason(LogSafe.clean(c.reason(), 255))
                .sentAt(c.sentInstant())
                .completedAt(now)
                .latencyMs(Duration.between(c.sentInstant(), now).toMillis())
                .outcome(outcome)
                .responseStatus(status)
                .reasonCode(reasonCode)
                .errorCode(errorCode)
                .errorDescription(errorDescription == null ? null : LogSafe.clean(errorDescription, 500))
                .detail(detail)
                .build());
    }
}

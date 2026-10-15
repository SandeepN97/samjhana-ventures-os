package com.samjhana.ocpp.diag;

import com.fasterxml.jackson.databind.JsonNode;
import com.samjhana.entity.OcppMessageLog;
import org.slf4j.Logger;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * Logs and records every OCPP frame, in full, with chargePointId and direction. This is the single place
 * frames are written to the log and the database; {@link OcppFrameSender} (outbound) and the handler
 * (inbound, before any parsing) are its only callers.
 */
@Component
public class OcppFrameLogger {

    private static final Logger FRAMES = OcppLoggers.FRAMES;

    private final OcppLoggingProperties properties;
    private final JsonMasker masker;
    private final OcppAuditWriter writer;

    public OcppFrameLogger(OcppLoggingProperties properties, JsonMasker masker, OcppAuditWriter writer) {
        this.properties = properties;
        this.masker = masker;
        this.writer = writer;
    }

    public void inbound(OcppConnectionState state, String payload) {
        log("IN", state, payload);
    }

    public void outbound(OcppConnectionState state, String payload) {
        log("OUT", state, payload);
    }

    public void binary(OcppConnectionState state, byte[] bytes) {
        state.framesIn().incrementAndGet();
        state.lastFrameAt(Instant.now());
        StringBuilder hex = new StringBuilder();
        for (int i = 0; i < Math.min(bytes.length, 64); i++) hex.append(String.format("%02x", bytes[i]));
        String summary = "<binary frame, " + bytes.length + " bytes> first64=" + hex;
        try (OcppMdc mdc = OcppMdc.open().chargePoint(state.chargePointCode()).session(state.wsSessionId())) {
            FRAMES.warn("FRAME IN  BINARY size={}B {}", bytes.length, summary);
            persist("IN", state, null, null, null, summary, bytes.length);
        }
    }

    private void log(String direction, OcppConnectionState state, String payload) {
        boolean inbound = "IN".equals(direction);
        (inbound ? state.framesIn() : state.framesOut()).incrementAndGet();
        if (inbound) state.lastFrameAt(Instant.now());

        int size = payload == null ? 0 : payload.getBytes(StandardCharsets.UTF_8).length;
        JsonMasker.Masked masked = masker.mask(payload);
        JsonNode tree = masked.tree();

        Integer type = null;
        String messageId = null;
        String action = null;
        if (tree != null && tree.isArray() && tree.size() >= 2 && tree.get(0).canConvertToInt()) {
            type = tree.get(0).asInt();
            messageId = tree.get(1).asText();
            if (type == 2 && tree.size() > 2) {
                action = tree.get(2).asText();
                state.rememberAction(direction, messageId, action);
            } else if (type == 3 || type == 4) {
                action = state.actionForResponse(direction, messageId);
            }
        }

        try (OcppMdc mdc = OcppMdc.open().chargePoint(state.chargePointCode()).session(state.wsSessionId())
                .message(messageId).action(action)) {
            if (inbound && type != null && type == 2 && "Heartbeat".equals(action)) {
                if (!heartbeatDecision(state, messageId)) return;
            } else if (!inbound && type != null && type == 3 && Boolean.FALSE.equals(state.heartbeatWasLogged(messageId))) {
                return; // response to a Heartbeat whose request was sampled out
            }

            String text = masked.text();
            // The database keeps the frame byte for byte; the log line shows line breaks as \n / \r so that one
            // frame is always one line and a charger cannot forge log entries.
            if (size > properties.getMaxFrameBytes()) {
                String head = text.substring(0, Math.min(text.length(), properties.getOversizedLogChars()));
                FRAMES.warn("FRAME {} OVERSIZED size={}B (limit {}B), first {} chars: {}",
                        pad(direction), size, properties.getMaxFrameBytes(), head.length(), oneLine(head));
            } else {
                FRAMES.info("FRAME {} size={}B {}", pad(direction), size, oneLine(text));
            }
            persist(direction, state, action, type, messageId, text, size);
        }
    }

    /** True when this Heartbeat frame is to be logged in full; also emits the periodic summary line. */
    private boolean heartbeatDecision(OcppConnectionState state, String messageId) {
        int count = state.heartbeats().incrementAndGet();
        int full = properties.getHeartbeatFullFrames();
        boolean logged = count <= full;
        state.rememberHeartbeat(messageId, logged);
        if (!logged) {
            int every = Math.max(1, properties.getHeartbeatSummaryEvery());
            if ((count - full) % every == 0) {
                FRAMES.info("HEARTBEAT summary: {} Heartbeats on this connection so far; {} of them not logged "
                        + "individually (the first {} were)", count, count - full, full);
            }
        }
        return logged;
    }

    static String oneLine(String text) {
        if (text.indexOf('\n') < 0 && text.indexOf('\r') < 0) return text;
        return text.replace("\r", "\\r").replace("\n", "\\n");
    }

    private static String pad(String direction) {
        return String.format("%-3s", direction);
    }

    private void persist(String direction, OcppConnectionState state, String action, Integer type,
                         String messageId, String text, int size) {
        String stored = text.length() > properties.getMaxStoredPayloadChars()
                ? text.substring(0, properties.getMaxStoredPayloadChars()) + "...[truncated]" : text;
        writer.enqueue(OcppMessageLog.builder()
                .chargePointId(state.chargePointCode() == null ? "unknown" : state.chargePointCode())
                .wsSessionId(state.wsSessionId())
                .direction(direction)
                .action(action)
                .messageType(type)
                .messageId(messageId)
                .payload(stored)
                .payloadSize(size)
                .receivedAt(Instant.now())
                .build());
    }
}

package com.samjhana.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.ocpp.OcppConnectionRegistry;
import com.samjhana.ocpp.OcppFieldChecks;
import com.samjhana.ocpp.diag.JsonMasker;
import com.samjhana.ocpp.diag.LogSafe;
import com.samjhana.ocpp.diag.OcppAuditWriter;
import com.samjhana.ocpp.diag.OcppCommandAudit;
import com.samjhana.ocpp.diag.OcppConnectionState;
import com.samjhana.ocpp.diag.OcppFrameLogger;
import com.samjhana.ocpp.diag.OcppFrameSender;
import com.samjhana.ocpp.diag.OcppLoggers;
import com.samjhana.ocpp.diag.OcppLoggingProperties;
import com.samjhana.ocpp.diag.OcppMdc;
import com.samjhana.ocpp.diag.OcppMessageLogger;
import com.samjhana.service.ChargePointService;
import com.samjhana.service.ChargeSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.SubProtocolCapable;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class OcppWebSocketHandler extends TextWebSocketHandler implements SubProtocolCapable {

    private static final Logger LIFECYCLE = OcppLoggers.LIFECYCLE;
    private static final ZoneId NEPAL = ZoneId.of("Asia/Kathmandu");
    /** Close code used when a newer connection from the same charger replaces this one (private-use range). */
    static final int REPLACED_CLOSE_CODE = 4001;

    private final ObjectMapper objectMapper;
    private final OcppConnectionRegistry connectionRegistry;
    private final ChargePointService chargePointService;
    private final ChargeSessionService chargeSessionService;
    private final OcppFrameLogger frameLogger;
    private final OcppFrameSender frameSender;
    private final OcppMessageLogger messageLogger;
    private final OcppCommandAudit commandAudit;
    private final OcppAuditWriter auditWriter;
    private final OcppLoggingProperties properties;
    private final JsonMasker masker;

    @Override
    public List<String> getSubProtocols() {
        return List.of("ocpp2.0.1");
    }

    // ------------------------------------------------------------------ lifecycle

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String code = chargePointCode(session);
        OcppConnectionState state = new OcppConnectionState(session.getId(), code, remote(session),
                session.getAcceptedProtocol(), Instant.now(), properties.getHeartbeatInterval().toSeconds());
        session.getAttributes().put(OcppConnectionState.ATTRIBUTE, state);
        try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(session.getId())) {
            OcppConnectionRegistry.Connection previous = connectionRegistry.register(code, session, state);
            if (previous != null) replaced(code, previous, session);
            chargePointService.markConnected(code);
            Instant now = Instant.now();
            LIFECYCLE.info("CONNECTED chargePointId={} sessionId={} remote={} negotiatedSubprotocol={} "
                            + "serverTimeUtc={} serverTimeNepal={}", code, session.getId(), state.remoteAddress(),
                    session.getAcceptedProtocol(), now.atZone(ZoneOffset.UTC), now.atZone(NEPAL));
            auditWriter.enqueue(connectionRow(session, code, OcppConnectionLog.Event.CONNECTED, "negotiated "
                    + session.getAcceptedProtocol(), null));
        }
    }

    /** A newer connection took over the registration: log both sessions and the gap, close the old one. */
    private void replaced(String code, OcppConnectionRegistry.Connection previous, WebSocketSession fresh) {
        OcppConnectionState old = previous.state();
        long gapMs = Duration.between(old.lastFrameAt(), Instant.now()).toMillis();
        boolean oldOpen = previous.raw().isOpen();
        LIFECYCLE.warn("RECONNECT chargePointId={} newSessionId={} replaces oldSessionId={} (old connected {}, last frame "
                        + "{}ms before the new connect, old socket still open={}). Closing the old session.",
                code, fresh.getId(), previous.rawSessionId(), old.connectedAt(), gapMs, oldOpen);
        auditWriter.enqueue(connectionRow(fresh, code, OcppConnectionLog.Event.RECONNECT, "replaced session "
                + previous.rawSessionId(), null));
        if (oldOpen) {
            try {
                previous.raw().close(new CloseStatus(REPLACED_CLOSE_CODE, "replaced by a newer connection"));
            } catch (IOException | RuntimeException ex) {
                LIFECYCLE.warn("Could not close replaced session {} of {}: {}", previous.rawSessionId(), code, ex.toString());
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String code = chargePointCode(session);
        OcppConnectionState state = OcppConnectionState.of(session, code);
        try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(session.getId())) {
            OcppConnectionRegistry.Unregistered result = connectionRegistry.unregister(code, session.getId());
            Instant now = Instant.now();
            String line = "DISCONNECTED chargePointId={} sessionId={} closeCode={} ({}) reason=\"{}\" duration={}s "
                    + "framesIn={} framesOut={} sinceLastFrame={}s lastPong={} wasCurrentSession={}";
            Object[] args = {code, session.getId(), status.getCode(), describe(status.getCode()),
                    LogSafe.clean(status.getReason(), 120), Duration.between(state.connectedAt(), now).toSeconds(),
                    state.framesIn().get(), state.framesOut().get(),
                    Duration.between(state.lastFrameAt(), now).toSeconds(), state.lastPongAt(), result.wasCurrent()};
            if (status.getCode() == 1000 || status.getCode() == 1001 || status.getCode() == REPLACED_CLOSE_CODE) {
                LIFECYCLE.info(line, args);
            } else {
                LIFECYCLE.warn(line, args);
            }
            auditWriter.enqueue(connectionRow(session, code, OcppConnectionLog.Event.DISCONNECTED,
                    "framesIn=" + state.framesIn().get() + " framesOut=" + state.framesOut().get()
                            + " durationSeconds=" + Duration.between(state.connectedAt(), now).toSeconds(),
                    status));

            for (OcppConnectionRegistry.PendingCommand orphan : result.orphanedCommands()) {
                commandAudit.lostToDisconnect(orphan);
            }
            if (result.wasCurrent()) {
                chargePointService.markDisconnected(code);
            } else {
                LIFECYCLE.warn("STALE session {} of {} closed after a newer connection took over: charger stays ONLINE "
                        + "and its pending commands are untouched", session.getId(), code);
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String code = chargePointCode(session);
        try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(session.getId())) {
            LIFECYCLE.warn("TRANSPORT ERROR chargePointId={} sessionId={} open={}: {}", code, session.getId(),
                    session.isOpen(), exception.toString(), exception);
        }
        if (session.isOpen()) session.close(CloseStatus.SERVER_ERROR);
    }

    @Override
    protected void handlePongMessage(WebSocketSession session, PongMessage message) {
        String code = chargePointCode(session);
        OcppConnectionState state = OcppConnectionState.of(session, code);
        Instant now = Instant.now();
        Instant ping = state.lastPingAt();
        state.lastPongAt(now);
        try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(session.getId())) {
            LIFECYCLE.debug("PONG received from {} ({}ms after our last ping)", code,
                    ping == null ? "-" : String.valueOf(Duration.between(ping, now).toMillis()));
        }
    }

    // ------------------------------------------------------------------ inbound frames

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        String code = chargePointCode(session);
        OcppConnectionState state = OcppConnectionState.of(session, code);
        byte[] bytes = new byte[message.getPayloadLength()];
        message.getPayload().duplicate().get(bytes);
        frameLogger.binary(state, bytes);
        try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(session.getId())) {
            LIFECYCLE.warn("BINARY FRAME from {} ({} bytes): OCPP-J is text only; closing the session", code, bytes.length);
        }
        super.handleBinaryMessage(session, message);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String code = chargePointCode(session);
        OcppConnectionState state = OcppConnectionState.of(session, code);
        String payload = message.getPayload();
        try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(session.getId())) {
            frameLogger.inbound(state, payload); // first, before any parsing, so malformed frames are captured
            process(session, state, code, payload);
        }
    }

    private void process(WebSocketSession session, OcppConnectionState state, String code, String payload)
            throws IOException {
        JsonNode frame;
        try {
            frame = objectMapper.readTree(payload);
        } catch (Exception ex) {
            LIFECYCLE.warn("MALFORMED JSON from {} ({} bytes): {} payload={}", code, payload.length(), ex.getMessage(),
                    masker.maskText(LogSafe.clean(payload, 8192)), ex);
            sendCallError(session, code, "unknown", "FormationViolation", "Invalid JSON");
            return;
        }
        if (frame == null || !frame.isArray() || frame.size() < 3 || !frame.get(0).canConvertToInt()) {
            LIFECYCLE.warn("INVALID OCPP-J FRAME from {} (expected a JSON array [type, id, ...]): payload={}", code,
                    masker.mask(LogSafe.clean(payload, 8192)).text());
            sendCallError(session, code, "unknown", "FormationViolation", "Invalid OCPP-J frame");
            return;
        }

        int messageType = frame.get(0).asInt();
        String messageId = frame.get(1).asText();
        try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(session.getId()).message(messageId)) {
            if (messageType == 2) {
                handleCall(session, state, code, messageId, frame);
            } else if (messageType == 3 || messageType == 4) {
                handleResponse(state, code, messageType, messageId, frame);
            } else {
                LIFECYCLE.warn("UNKNOWN MESSAGE TYPE {} from {} (expected 2, 3 or 4; no reply sent): payload={}",
                        messageType, code, masker.mask(payload).text());
            }
        }
    }

    private void handleResponse(OcppConnectionState state, String code, int messageType, String messageId,
                                JsonNode frame) {
        OcppConnectionRegistry.PendingCommand command = connectionRegistry.consumePending(code, messageId);
        if (command == null) {
            commandAudit.unmatched(code, state.wsSessionId(), messageId, messageType,
                    masker.mask(frame.toString()).text(), connectionRegistry.findRecentlyExpired(code, messageId));
            return;
        }
        try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(state.wsSessionId()).message(messageId)
                .action(command.action()).chargeSession(command.chargeSessionId())) {
            if (messageType == 3) {
                commandAudit.answered(command, frame.get(2));
                chargeSessionService.handleCommandResult(command, frame.get(2), null);
            } else {
                // The code and text are the charger's own words: cut to what the stored columns hold (finding D-05), so a long
                // one cannot make the write fail and leave the command's outcome unrecorded.
                String errorCode = OcppFieldChecks.errorCode(frame.get(2).asText());
                String description = frame.size() > 3 ? OcppFieldChecks.errorText(frame.get(3).asText()) : null;
                commandAudit.errored(command, errorCode, description, frame.size() > 4 ? frame.get(4) : null);
                String detail = description != null ? description : "OCPP command failed";
                chargeSessionService.handleCommandResult(command, null, detail);
            }
        } catch (Exception ex) {
            log.error("Failed to apply the {} reply to {} for {} (chargeSessionId={}, messageId={})",
                    messageType == 3 ? "CALLRESULT" : "CALLERROR", command.action(), code,
                    command.chargeSessionId(), messageId, ex);
        }
    }

    private void handleCall(WebSocketSession session, OcppConnectionState state, String code, String messageId,
                            JsonNode frame) throws IOException {
        if (frame.size() < 4) {
            LIFECYCLE.warn("CALL from {} without a payload (messageId={}): frame has only {} elements", code, messageId,
                    frame.size());
            sendCallError(session, code, messageId, "FormationViolation", "CALL payload is missing");
            return;
        }
        String action = frame.get(2).asText();
        JsonNode payload = frame.get(3);
        try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(state.wsSessionId()).message(messageId).action(action)) {
            try {
                messageLogger.checkRequired(code, action, payload);
                messageLogger.logUnreadKeys(code, action, payload);
                ObjectNode response = objectMapper.createObjectNode();
                switch (action) {
                    case "BootNotification" -> {
                        messageLogger.boot(state, payload);
                        JsonNode sentSerial = payload.path("chargingStation").path("serialNumber");
                        String serial = OcppFieldChecks.serialToStore(sentSerial);
                        if (serial == null && OcppFieldChecks.wasSent(sentSerial)) {
                            // Only a label: the boot is accepted, the serial is just not stored (finding D-05).
                            LIFECYCLE.warn("BOOT from {}: the serial number does not fit (1 to 25 letters, digits, '.', '_' or '-'), "
                                    + "so it is not stored and the boot is accepted anyway. value={}", code,
                                    LogSafe.clean(sentSerial.isTextual() ? sentSerial.asText() : sentSerial.toString(), 60));
                        }
                        chargePointService.recordBoot(code, serial);
                        long interval = properties.getHeartbeatInterval().toSeconds();
                        state.heartbeatIntervalSeconds(interval);
                        response.put("currentTime", Instant.now().toString());
                        response.put("interval", (int) interval);
                        response.put("status", "Accepted");
                    }
                    case "Heartbeat" -> {
                        messageLogger.heartbeat(state);
                        chargePointService.recordHeartbeat(code);
                        response.put("currentTime", Instant.now().toString());
                    }
                    case "StatusNotification" -> {
                        // Checked before anything is logged or tracked, so a refused value never shows up as a connector change.
                        String connectorStatus = OcppFieldChecks.requireConnectorStatus(payload);
                        messageLogger.status(state, payload);
                        chargePointService.recordStatus(code, connectorStatus);
                    }
                    case "TransactionEvent" -> {
                        OcppFieldChecks.requireTransactionIdFits(payload);
                        messageLogger.transactionEvent(state, payload);
                        chargeSessionService.handleTransactionEvent(code, payload);
                    }
                    default -> {
                        messageLogger.otherAction(state, action, payload);
                        sendCallError(session, code, messageId, "NotSupported", "Unsupported action: " + action);
                        return;
                    }
                }
                sendCallResult(session, code, messageId, response);
            } catch (OcppFieldChecks.Violation violation) {
                // The charger sent a value the standard (or the stored column) does not allow: say so with the standard code,
                // store nothing, and keep the connection open (finding D-05).
                LIFECYCLE.warn("REJECTED {} from {} (messageId={}): {} [{}] value={}", action, code, messageId,
                        violation.getMessage(), violation.errorCode(), violation.value());
                try {
                    sendCallError(session, code, messageId, violation.errorCode(), violation.getMessage());
                } catch (Exception sendFailure) {
                    log.error("Could not send the {} CALLERROR for {} to {} (messageId={})", violation.errorCode(), action, code,
                            messageId, sendFailure);
                }
            } catch (Exception ex) {
                log.error("Handler failed for action {} from {} (messageId={}, sessionId={}): {}", action, code,
                        messageId, session.getId(), ex.toString(), ex);
                try {
                    sendCallError(session, code, messageId, "InternalError", "Internal error handling " + action);
                } catch (Exception sendFailure) {
                    log.error("Could not send the InternalError CALLERROR for {} to {} (messageId={})", action, code,
                            messageId, sendFailure);
                }
            }
        }
    }

    // ------------------------------------------------------------------ outbound frames (all via OcppFrameSender)

    private void sendCallResult(WebSocketSession session, String code, String messageId, JsonNode payload)
            throws IOException {
        ArrayNode response = objectMapper.createArrayNode();
        response.add(3);
        response.add(messageId);
        response.add(payload);
        frameSender.send(safe(session), code, response.toString());
    }

    private void sendCallError(WebSocketSession session, String code, String messageId, String errorCode,
                               String description) throws IOException {
        ArrayNode response = objectMapper.createArrayNode();
        response.add(4);
        response.add(messageId);
        response.add(errorCode);
        response.add(description);
        response.add(objectMapper.createObjectNode());
        frameSender.send(safe(session), code, response.toString());
    }

    /** Sends go through the registry's thread-safe wrapper when there is one (commands are sent from other threads). */
    private WebSocketSession safe(WebSocketSession session) {
        Object wrapped = session.getAttributes().get(OcppConnectionRegistry.SAFE_SESSION_ATTRIBUTE);
        return wrapped instanceof WebSocketSession safeSession ? safeSession : session;
    }

    // ------------------------------------------------------------------ helpers

    private OcppConnectionLog connectionRow(WebSocketSession session, String code, OcppConnectionLog.Event event,
                                            String reason, CloseStatus status) {
        Object remote = session.getAttributes().get(OcppHandshakeInterceptor.ATTR_REMOTE);
        Object forwarded = session.getAttributes().get(OcppHandshakeInterceptor.ATTR_FORWARDED_FOR);
        Object agent = session.getAttributes().get(OcppHandshakeInterceptor.ATTR_USER_AGENT);
        Object offered = session.getAttributes().get(OcppHandshakeInterceptor.ATTR_OFFERED);
        return OcppConnectionLog.builder()
                .chargePointId(code)
                .wsSessionId(session.getId())
                .event(event)
                .reason(LogSafe.clean(reason, 64))
                .closeCode(status == null ? null : status.getCode())
                .detail(status == null ? reason : reason + (status.getReason() == null ? "" : " closeReason=" + status.getReason()))
                .remoteAddr(remote == null ? null : remote.toString())
                .forwardedFor(forwarded == null ? null : LogSafe.clean(forwarded.toString(), 255))
                .userAgent(agent == null ? null : LogSafe.clean(agent.toString(), 255))
                .offeredProtocols(offered == null ? null : LogSafe.clean(offered.toString(), 255))
                .createdAt(Instant.now())
                .build();
    }

    private String remote(WebSocketSession session) {
        Object remote = session.getAttributes().get(OcppHandshakeInterceptor.ATTR_REMOTE);
        if (remote != null) return remote.toString();
        return session.getRemoteAddress() == null ? null : session.getRemoteAddress().toString();
    }

    static String describe(int code) {
        return switch (code) {
            case 1000 -> "normal closure";
            case 1001 -> "going away";
            case 1002 -> "protocol error";
            case 1003 -> "unsupported data";
            case 1006 -> "abnormal closure: connection dropped without a close frame (network, proxy or power)";
            case 1007 -> "invalid payload data";
            case 1008 -> "policy violation";
            case 1009 -> "message too big";
            case 1011 -> "server error";
            case REPLACED_CLOSE_CODE -> "replaced by a newer connection from the same charger";
            default -> "other";
        };
    }

    private String chargePointCode(WebSocketSession session) {
        return (String) session.getAttributes().get(OcppHandshakeInterceptor.CHARGE_POINT_CODE);
    }
}

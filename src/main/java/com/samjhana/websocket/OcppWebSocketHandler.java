package com.samjhana.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.samjhana.ocpp.OcppConnectionRegistry;
import com.samjhana.service.ChargePointService;
import com.samjhana.service.ChargeSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.SubProtocolCapable;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class OcppWebSocketHandler extends TextWebSocketHandler implements SubProtocolCapable {

    private final ObjectMapper objectMapper;
    private final OcppConnectionRegistry connectionRegistry;
    private final ChargePointService chargePointService;
    private final ChargeSessionService chargeSessionService;

    @Override
    public List<String> getSubProtocols() {
        return List.of("ocpp2.0.1");
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String code = chargePointCode(session);
        connectionRegistry.register(code, session);
        chargePointService.markConnected(code);
        log.info("OCPP charge point connected: {}", code);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String code = chargePointCode(session);
        JsonNode frame;
        try {
            frame = objectMapper.readTree(message.getPayload());
        } catch (Exception ex) {
            sendCallError(session, "unknown", "FormationViolation", "Invalid JSON");
            return;
        }
        if (!frame.isArray() || frame.size() < 3 || !frame.get(0).canConvertToInt()) {
            sendCallError(session, "unknown", "FormationViolation", "Invalid OCPP-J frame");
            return;
        }

        int messageType = frame.get(0).asInt();
        String messageId = frame.get(1).asText();
        if (messageType == 2) {
            handleCall(session, code, messageId, frame);
        } else if (messageType == 3) {
            OcppConnectionRegistry.PendingCommand command = connectionRegistry.consumePending(code, messageId);
            if (command != null) {
                chargeSessionService.handleCommandResult(command, frame.get(2), null);
            }
        } else if (messageType == 4) {
            OcppConnectionRegistry.PendingCommand command = connectionRegistry.consumePending(code, messageId);
            if (command != null) {
                String detail = frame.size() > 3 ? frame.get(3).asText() : "OCPP command failed";
                chargeSessionService.handleCommandResult(command, null, detail);
            }
        }
    }

    private void handleCall(WebSocketSession session, String code, String messageId, JsonNode frame) throws IOException {
        if (frame.size() < 4) {
            sendCallError(session, messageId, "FormationViolation", "CALL payload is missing");
            return;
        }
        String action = frame.get(2).asText();
        JsonNode payload = frame.get(3);
        ObjectNode response = objectMapper.createObjectNode();
        switch (action) {
            case "BootNotification" -> {
                String serial = payload.path("chargingStation").path("serialNumber").asText(null);
                chargePointService.recordBoot(code, serial);
                response.put("currentTime", Instant.now().toString());
                response.put("interval", 30);
                response.put("status", "Accepted");
            }
            case "Heartbeat" -> {
                chargePointService.recordHeartbeat(code);
                response.put("currentTime", Instant.now().toString());
            }
            case "StatusNotification" -> {
                chargePointService.recordStatus(code, payload.path("connectorStatus").asText("Unknown"));
            }
            case "TransactionEvent" -> chargeSessionService.handleTransactionEvent(code, payload);
            default -> {
                sendCallError(session, messageId, "NotSupported", "Unsupported action: " + action);
                return;
            }
        }
        sendCallResult(session, messageId, response);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String code = chargePointCode(session);
        connectionRegistry.unregister(code, session.getId());
        chargePointService.markDisconnected(code);
        log.info("OCPP charge point disconnected: {} ({})", code, status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.warn("OCPP transport error for {}: {}", chargePointCode(session), exception.getMessage());
        if (session.isOpen()) session.close(CloseStatus.SERVER_ERROR);
    }

    private void sendCallResult(WebSocketSession session, String messageId, JsonNode payload) throws IOException {
        ArrayNode response = objectMapper.createArrayNode();
        response.add(3);
        response.add(messageId);
        response.add(payload);
        session.sendMessage(new TextMessage(response.toString()));
    }

    private void sendCallError(WebSocketSession session, String messageId, String code, String description)
            throws IOException {
        ArrayNode response = objectMapper.createArrayNode();
        response.add(4);
        response.add(messageId);
        response.add(code);
        response.add(description);
        response.add(objectMapper.createObjectNode());
        session.sendMessage(new TextMessage(response.toString()));
    }

    private String chargePointCode(WebSocketSession session) {
        return (String) session.getAttributes().get(OcppHandshakeInterceptor.CHARGE_POINT_CODE);
    }
}

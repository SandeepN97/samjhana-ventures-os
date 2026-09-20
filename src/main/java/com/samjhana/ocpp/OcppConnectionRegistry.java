package com.samjhana.ocpp;

import com.samjhana.exception.EvSessionStateException;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class OcppConnectionRegistry {

    private final Map<String, Connection> connections = new ConcurrentHashMap<>();
    private final Map<String, PendingCommand> pendingCommands = new ConcurrentHashMap<>();

    public void register(String chargePointCode, WebSocketSession session) {
        WebSocketSession safeSession = new ConcurrentWebSocketSessionDecorator(session, 10_000, 512 * 1024);
        connections.put(chargePointCode, new Connection(session.getId(), safeSession));
    }

    public void unregister(String chargePointCode, String sessionId) {
        connections.computeIfPresent(chargePointCode,
                (code, connection) -> connection.rawSessionId().equals(sessionId) ? null : connection);
        pendingCommands.entrySet().removeIf(entry -> entry.getKey().startsWith(chargePointCode + ":"));
    }

    public boolean isConnected(String chargePointCode) {
        Connection connection = connections.get(chargePointCode);
        return connection != null && connection.session().isOpen();
    }

    public String send(String chargePointCode, String action, UUID chargeSessionId, String json) {
        Connection connection = connections.get(chargePointCode);
        if (connection == null || !connection.session().isOpen()) {
            throw new EvSessionStateException("Charger " + chargePointCode + " is offline");
        }
        String messageId = UUID.randomUUID().toString();
        pendingCommands.put(key(chargePointCode, messageId),
                new PendingCommand(messageId, action, chargeSessionId, LocalDateTime.now()));
        try {
            connection.session().sendMessage(new TextMessage(json.replace("__MESSAGE_ID__", messageId)));
            return messageId;
        } catch (IOException ex) {
            pendingCommands.remove(key(chargePointCode, messageId));
            throw new EvSessionStateException("Could not send " + action + " to charger " + chargePointCode);
        }
    }

    public PendingCommand consumePending(String chargePointCode, String messageId) {
        return pendingCommands.remove(key(chargePointCode, messageId));
    }

    private String key(String chargePointCode, String messageId) {
        return chargePointCode + ":" + messageId;
    }

    private record Connection(String rawSessionId, WebSocketSession session) {}

    public record PendingCommand(
            String messageId,
            String action,
            UUID chargeSessionId,
            LocalDateTime sentAt) {}
}

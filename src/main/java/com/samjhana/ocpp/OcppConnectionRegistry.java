package com.samjhana.ocpp;

import com.samjhana.exception.EvSessionStateException;
import com.samjhana.ocpp.diag.OcppCommandAudit;
import com.samjhana.ocpp.diag.OcppConnectionState;
import com.samjhana.ocpp.diag.OcppFrameSender;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class OcppConnectionRegistry {

    /** Session attribute holding the thread-safe sending wrapper, for the handler's own replies. */
    public static final String SAFE_SESSION_ATTRIBUTE = "ocppSafeSession";
    private static final int EXPIRED_MEMORY = 200;

    private final OcppFrameSender frameSender;
    private final OcppCommandAudit commandAudit;

    private final Map<String, Connection> connections = new ConcurrentHashMap<>();
    private final Map<String, PendingCommand> pendingCommands = new ConcurrentHashMap<>();
    /** Commands that timed out, remembered briefly so a late reply can be recognised as such. */
    private final Map<String, PendingCommand> recentlyExpired = Collections.synchronizedMap(
            new LinkedHashMap<>() {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, PendingCommand> eldest) {
                    return size() > EXPIRED_MEMORY;
                }
            });

    public OcppConnectionRegistry(OcppFrameSender frameSender, OcppCommandAudit commandAudit) {
        this.frameSender = frameSender;
        this.commandAudit = commandAudit;
    }

    /** Registers the session as the charger's current connection; returns the one it replaced, if any. */
    public Connection register(String chargePointCode, WebSocketSession session, OcppConnectionState state) {
        WebSocketSession safeSession = new ConcurrentWebSocketSessionDecorator(session, 10_000, 512 * 1024);
        session.getAttributes().put(SAFE_SESSION_ATTRIBUTE, safeSession);
        return connections.put(chargePointCode, new Connection(session.getId(), session, safeSession, state));
    }

    /**
     * Removes the session only if it is still the registered one. A stale session closing after the
     * charger has already reconnected must neither mark the charger offline nor drop the new connection's
     * pending commands.
     */
    public Unregistered unregister(String chargePointCode, String sessionId) {
        boolean[] current = {false};
        connections.computeIfPresent(chargePointCode, (code, connection) -> {
            if (connection.rawSessionId().equals(sessionId)) {
                current[0] = true;
                return null;
            }
            return connection;
        });
        List<PendingCommand> orphaned = new ArrayList<>();
        if (current[0]) {
            pendingCommands.entrySet().removeIf(entry -> {
                if (!entry.getKey().startsWith(chargePointCode + ":")) return false;
                orphaned.add(entry.getValue());
                return true;
            });
        }
        return new Unregistered(current[0], orphaned);
    }

    /**
     * Closes the charger's live connection, if it has one (finding P1a-03: a connection opened with a secret that
     * has since been changed must not outlive it). The registration is left in place on purpose: the container
     * reports the close back to the handler, which unregisters the session, fails its pending commands and marks
     * the charger offline like for any other disconnect.
     *
     * @return whether the charger had a connection
     */
    public boolean disconnect(String chargePointCode, CloseStatus status) {
        Connection connection = connections.get(chargePointCode);
        if (connection == null) return false;
        try {
            connection.raw().close(status);
        } catch (IOException | RuntimeException ex) {
            // already closing or gone; the container reports it through the usual close handling
        }
        return true;
    }

    public boolean isConnected(String chargePointCode) {
        Connection connection = connections.get(chargePointCode);
        return connection != null && connection.session().isOpen();
    }

    public List<Connection> connections() {
        return List.copyOf(connections.values());
    }

    public String send(String chargePointCode, String action, UUID chargeSessionId, String json) {
        return send(chargePointCode, action, chargeSessionId, json, CommandInfo.NONE);
    }

    public String send(String chargePointCode, String action, UUID chargeSessionId, String json, CommandInfo info) {
        Connection connection = connections.get(chargePointCode);
        if (connection == null || !connection.session().isOpen()) {
            throw new EvSessionStateException("Charger " + chargePointCode + " is offline");
        }
        String messageId = UUID.randomUUID().toString();
        PendingCommand pending = new PendingCommand(messageId, action, chargeSessionId, LocalDateTime.now(),
                Instant.now(), chargePointCode, connection.rawSessionId(), info.evseId(), info.connectorId(),
                info.maskedIdToken(), info.reason(), info.transactionId());
        pendingCommands.put(key(chargePointCode, messageId), pending);
        try {
            frameSender.send(connection.session(), chargePointCode, json.replace("__MESSAGE_ID__", messageId));
        } catch (IOException | RuntimeException ex) {
            pendingCommands.remove(key(chargePointCode, messageId));
            commandAudit.sendFailed(pending, ex);
            throw new EvSessionStateException("Could not send " + action + " to charger " + chargePointCode);
        }
        commandAudit.sent(pending);
        return messageId;
    }

    public PendingCommand consumePending(String chargePointCode, String messageId) {
        return pendingCommands.remove(key(chargePointCode, messageId));
    }

    /** A command that already timed out, if this reply is a late answer to one. */
    public PendingCommand findRecentlyExpired(String chargePointCode, String messageId) {
        return recentlyExpired.get(key(chargePointCode, messageId));
    }

    public int pendingCount(String chargePointCode) {
        return (int) pendingCommands.keySet().stream().filter(k -> k.startsWith(chargePointCode + ":")).count();
    }

    public List<PendingCommand> pending(String chargePointCode) {
        return pendingCommands.entrySet().stream()
                .filter(entry -> entry.getKey().startsWith(chargePointCode + ":"))
                .map(Map.Entry::getValue).toList();
    }

    /** Removes and returns every command that has waited longer than the timeout. */
    public List<PendingCommand> expire(Duration timeout) {
        Instant cutoff = Instant.now().minus(timeout);
        List<PendingCommand> expired = new ArrayList<>();
        pendingCommands.entrySet().removeIf(entry -> {
            if (!entry.getValue().sentInstant().isBefore(cutoff)) return false;
            expired.add(entry.getValue());
            recentlyExpired.put(entry.getKey(), entry.getValue());
            return true;
        });
        return expired;
    }

    private String key(String chargePointCode, String messageId) {
        return chargePointCode + ":" + messageId;
    }

    /** {@code raw} is the container's session; {@code session} is the thread-safe wrapper used for sending. */
    public record Connection(String rawSessionId, WebSocketSession raw, WebSocketSession session,
                             OcppConnectionState state) {}

    public record Unregistered(boolean wasCurrent, List<PendingCommand> orphanedCommands) {}

    /** Context for the command log: which connector, which (masked) token, and why it was sent. */
    public record CommandInfo(Integer evseId, Integer connectorId, String maskedIdToken, String reason,
                              String transactionId) {
        public static final CommandInfo NONE = new CommandInfo(null, null, null, null, null);
    }

    public record PendingCommand(
            String messageId,
            String action,
            UUID chargeSessionId,
            LocalDateTime sentAt,
            Instant sentInstant,
            String chargePointCode,
            String wsSessionId,
            Integer evseId,
            Integer connectorId,
            String maskedIdToken,
            String reason,
            String transactionId) {

        public PendingCommand(String messageId, String action, UUID chargeSessionId, LocalDateTime sentAt) {
            this(messageId, action, chargeSessionId, sentAt, Instant.now(), null, null, null, null, null, null, null);
        }
    }
}

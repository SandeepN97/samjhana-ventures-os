package com.samjhana.ocpp.diag;

import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Per-WebSocket-session diagnostics: counters, timestamps and the small lookup tables that let a
 * CALLRESULT be tied back to the action it answers. Lives in the session attributes, so a stale
 * session keeps its own state even after a newer connection has replaced it in the registry.
 */
public class OcppConnectionState {

    public static final String ATTRIBUTE = "ocppConnectionState";
    private static final int LOOKUP_LIMIT = 64;

    private final String wsSessionId;
    private final String chargePointCode;
    private final String remoteAddress;
    private final String subprotocol;
    private final Instant connectedAt;

    private final AtomicLong framesIn = new AtomicLong();
    private final AtomicLong framesOut = new AtomicLong();
    private final AtomicInteger heartbeats = new AtomicInteger();
    private volatile Instant lastFrameAt;
    private volatile Instant lastPongAt;
    private volatile Instant lastPingAt;
    private volatile Instant lastHeartbeatAt;
    private volatile Instant idleWarnedAt;
    private volatile long heartbeatIntervalSeconds;

    private final Map<String, String> actionByMessage = boundedMap();
    private final Map<String, Boolean> heartbeatLogged = boundedMap();

    public OcppConnectionState(String wsSessionId, String chargePointCode, String remoteAddress,
                               String subprotocol, Instant connectedAt, long heartbeatIntervalSeconds) {
        this.wsSessionId = wsSessionId;
        this.chargePointCode = chargePointCode;
        this.remoteAddress = remoteAddress;
        this.subprotocol = subprotocol;
        this.connectedAt = connectedAt;
        this.lastFrameAt = connectedAt;
        this.heartbeatIntervalSeconds = heartbeatIntervalSeconds;
    }

    /** The state attached to this session, or a detached placeholder if it has none yet. */
    public static OcppConnectionState of(WebSocketSession session, String chargePointCode) {
        Object state = session.getAttributes().get(ATTRIBUTE);
        if (state instanceof OcppConnectionState existing) return existing;
        OcppConnectionState created = new OcppConnectionState(session.getId(), chargePointCode,
                session.getRemoteAddress() == null ? null : session.getRemoteAddress().toString(),
                session.getAcceptedProtocol(), Instant.now(), 30);
        session.getAttributes().put(ATTRIBUTE, created);
        return created;
    }

    private static <V> Map<String, V> boundedMap() {
        return java.util.Collections.synchronizedMap(new LinkedHashMap<>(16, 0.75f, false) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, V> eldest) {
                return size() > LOOKUP_LIMIT;
            }
        });
    }

    public void rememberAction(String direction, String messageId, String action) {
        if (messageId != null && action != null) actionByMessage.put(direction + ":" + messageId, action);
    }

    /** The action of the CALL a response answers: responses IN answer our OUT calls and vice versa. */
    public String actionForResponse(String responseDirection, String messageId) {
        String callDirection = "IN".equals(responseDirection) ? "OUT" : "IN";
        return messageId == null ? null : actionByMessage.get(callDirection + ":" + messageId);
    }

    public void rememberHeartbeat(String messageId, boolean logged) {
        if (messageId != null) heartbeatLogged.put(messageId, logged);
    }

    /** Null when the id is not a Heartbeat we have seen. */
    public Boolean heartbeatWasLogged(String messageId) {
        return messageId == null ? null : heartbeatLogged.get(messageId);
    }

    public String wsSessionId() { return wsSessionId; }
    public String chargePointCode() { return chargePointCode; }
    public String remoteAddress() { return remoteAddress; }
    public String subprotocol() { return subprotocol; }
    public Instant connectedAt() { return connectedAt; }
    public AtomicLong framesIn() { return framesIn; }
    public AtomicLong framesOut() { return framesOut; }
    public AtomicInteger heartbeats() { return heartbeats; }
    public Instant lastFrameAt() { return lastFrameAt; }
    public void lastFrameAt(Instant value) { this.lastFrameAt = value; }
    public Instant lastPongAt() { return lastPongAt; }
    public void lastPongAt(Instant value) { this.lastPongAt = value; }
    public Instant lastPingAt() { return lastPingAt; }
    public void lastPingAt(Instant value) { this.lastPingAt = value; }
    public Instant lastHeartbeatAt() { return lastHeartbeatAt; }
    public void lastHeartbeatAt(Instant value) { this.lastHeartbeatAt = value; }
    public Instant idleWarnedAt() { return idleWarnedAt; }
    public void idleWarnedAt(Instant value) { this.idleWarnedAt = value; }
    public long heartbeatIntervalSeconds() { return heartbeatIntervalSeconds; }
    public void heartbeatIntervalSeconds(long value) { this.heartbeatIntervalSeconds = value; }
}

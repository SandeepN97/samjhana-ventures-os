package com.samjhana.ocpp.diag;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.samjhana.entity.OcppSessionEvidence;
import com.samjhana.ocpp.OcppConnectionRegistry.PendingCommand;
import com.samjhana.repository.ChargeSessionRepository;
import org.slf4j.Logger;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Collects, per charge session, the timestamped sequence that decides whether a connector released by
 * itself or only after our UnlockConnector: stop sent / answered, TransactionEvent Ended, connector status
 * changes, unlock sent / answered and the status after. One summary line per session goes to the
 * {@code lockevidence} logger and a row to {@code ocpp_session_evidence}.
 *
 * <p>The "released" verdict is a hint, not a fact: in OCPP 2.0.1 a connector reporting Available after
 * Occupied means the cable was released (or unplugged), which is what we look for.
 */
@Component
public class LockEvidenceTracker {

    private static final Logger LOCK = OcppLoggers.LOCK_EVIDENCE;

    public record Event(Instant at, String kind, String detail) {}

    private static final class Evidence {
        final UUID sessionId;
        final String code;
        String transactionId;
        Integer evseId;
        Integer connectorId;
        final List<Event> events = new ArrayList<>();
        Instant lastEventAt = Instant.now();
        boolean unlockAnswered;
        boolean statusAfterUnlock;

        Evidence(UUID sessionId, String code) {
            this.sessionId = sessionId;
            this.code = code;
        }
    }

    private final Map<String, Evidence> open = new ConcurrentHashMap<>();
    private final OcppAuditWriter writer;
    private final ChargeSessionRepository sessions;
    private final OcppLoggingProperties properties;
    private final ObjectMapper mapper;

    public LockEvidenceTracker(OcppAuditWriter writer, ChargeSessionRepository sessions,
                               OcppLoggingProperties properties, ObjectMapper mapper) {
        this.writer = writer;
        this.sessions = sessions;
        this.properties = properties;
        this.mapper = mapper;
    }

    public void commandSent(PendingCommand c) {
        if (c.action().equals("RequestStartTransaction")) {
            // A new session is starting on this charger: earlier stop/unlock sequences are over, and later
            // connector status changes belong to the new session, not to them.
            closeAllFor(c.chargePointCode());
            return;
        }
        if (c.chargeSessionId() == null) return;
        if (c.action().equals("RequestStopTransaction") || c.action().equals("UnlockConnector")) {
            Evidence evidence = open.computeIfAbsent(key(c.chargePointCode(), c.chargeSessionId()),
                    k -> new Evidence(c.chargeSessionId(), c.chargePointCode()));
            synchronized (evidence) {
                if (c.transactionId() != null) evidence.transactionId = c.transactionId();
                if (c.evseId() != null) evidence.evseId = c.evseId();
                if (c.connectorId() != null) evidence.connectorId = c.connectorId();
                add(evidence, c.action().equals("UnlockConnector") ? "UNLOCK_SENT" : "STOP_SENT",
                        "messageId=" + c.messageId());
            }
        }
    }

    public void commandAnswered(PendingCommand c, String outcome) {
        if (c.chargeSessionId() == null) return;
        Evidence evidence = open.get(key(c.chargePointCode(), c.chargeSessionId()));
        if (evidence == null) return;
        synchronized (evidence) {
            if (c.action().equals("UnlockConnector")) {
                add(evidence, "UNLOCK_REPLY", outcome);
                evidence.unlockAnswered = true;
            } else if (c.action().equals("RequestStopTransaction")) {
                add(evidence, "STOP_REPLY", outcome);
            }
        }
    }

    /** TransactionEvent Ended for a transaction: attached to the session's evidence, started if none yet. */
    public void transactionEnded(String code, String transactionId, String stoppedReason, String triggerReason) {
        if (transactionId == null) return;
        Evidence evidence = open.values().stream()
                .filter(e -> e.code.equals(code) && transactionId.equals(e.transactionId))
                .findFirst().orElse(null);
        if (evidence == null) {
            UUID sessionId = resolveSession(code, transactionId);
            evidence = open.computeIfAbsent(key(code, sessionId), k -> new Evidence(sessionId, code));
            synchronized (evidence) {
                evidence.transactionId = transactionId;
            }
        }
        synchronized (evidence) {
            add(evidence, "TX_ENDED", "stoppedReason=" + stoppedReason + " triggerReason=" + triggerReason);
        }
    }

    /** A connector status change belongs to the most recently active sequence on that charger. */
    public void connectorStatus(String code, Integer evseId, Integer connectorId, String oldStatus, String newStatus) {
        Evidence latest = null;
        for (Evidence evidence : open.values()) {
            if (!evidence.code.equals(code)) continue;
            synchronized (evidence) {
                if (evidence.evseId != null && evseId != null && !evidence.evseId.equals(evseId)) continue;
                if (evidence.connectorId != null && connectorId != null && !evidence.connectorId.equals(connectorId)) continue;
            }
            if (latest == null || evidence.lastEventAt.isAfter(latest.lastEventAt)) latest = evidence;
        }
        if (latest == null) return;
        synchronized (latest) {
            boolean afterUnlock = latest.unlockAnswered;
            add(latest, afterUnlock ? "STATUS_AFTER_UNLOCK" : "CONNECTOR_STATUS",
                    "evse=" + evseId + " connector=" + connectorId + " " + oldStatus + "->" + newStatus);
            if (afterUnlock) latest.statusAfterUnlock = true;
        }
    }

    private void closeAllFor(String code) {
        for (Map.Entry<String, Evidence> entry : open.entrySet()) {
            if (entry.getValue().code.equals(code) && open.remove(entry.getKey(), entry.getValue())) {
                emit(entry.getValue());
            }
        }
    }

    @Scheduled(fixedDelayString = "PT15S")
    void emitQuietSessions() {
        Instant cutoff = Instant.now().minus(properties.getLockEvidenceQuiet());
        for (Map.Entry<String, Evidence> entry : open.entrySet()) {
            Evidence evidence = entry.getValue();
            if (evidence.lastEventAt.isBefore(cutoff) && open.remove(entry.getKey(), evidence)) {
                emit(evidence);
            }
        }
    }

    /** Emits everything still open now (used on shutdown and by tests). */
    public void emitAll() {
        for (Map.Entry<String, Evidence> entry : open.entrySet()) {
            if (open.remove(entry.getKey(), entry.getValue())) emit(entry.getValue());
        }
    }

    private void emit(Evidence evidence) {
        String summary;
        ArrayNode events = mapper.createArrayNode();
        synchronized (evidence) {
            summary = summarise(evidence);
            for (Event event : evidence.events) {
                events.addObject().put("at", event.at().toString()).put("kind", event.kind()).put("detail", event.detail());
            }
        }
        String eventsJson = events.toString();
        try (OcppMdc mdc = OcppMdc.open().chargePoint(evidence.code).chargeSession(evidence.sessionId)) {
            LOCK.info("{}", summary);
        }
        writer.enqueue(OcppSessionEvidence.builder()
                .chargeSessionId(evidence.sessionId)
                .chargePointId(evidence.code)
                .ocppTransactionId(evidence.transactionId)
                .summary(summary)
                .events(eventsJson)
                .createdAt(Instant.now())
                .build());
    }

    private String summarise(Evidence e) {
        StringBuilder out = new StringBuilder("LOCK EVIDENCE session=").append(e.sessionId)
                .append(" cp=").append(e.code).append(" tx=").append(e.transactionId);
        for (Event event : e.events) {
            out.append(" | ").append(event.at()).append(' ').append(event.kind()).append(' ').append(event.detail());
        }
        out.append(" | verdict=").append(verdict(e));
        return out.toString();
    }

    /** See the class comment: Available after the stop is a hint that the connector released. */
    static String verdict(Evidence e) {
        Instant unlockSent = e.events.stream().filter(x -> x.kind().equals("UNLOCK_SENT"))
                .map(Event::at).findFirst().orElse(null);
        Event released = e.events.stream()
                .filter(x -> x.kind().startsWith("CONNECTOR_STATUS") || x.kind().equals("STATUS_AFTER_UNLOCK"))
                .filter(x -> x.detail().endsWith("->Available")).findFirst().orElse(null);
        if (released == null) return "RELEASE_NOT_OBSERVED";
        if (unlockSent == null || released.at().isBefore(unlockSent)) return "RELEASED_BEFORE_OUR_UNLOCK";
        return "RELEASED_AFTER_OUR_UNLOCK";
    }

    private void add(Evidence evidence, String kind, String detail) {
        Instant now = Instant.now();
        evidence.events.add(new Event(now, kind, detail));
        evidence.lastEventAt = now;
    }

    private UUID resolveSession(String code, String transactionId) {
        try {
            return sessions.findFirstByOcppTransactionIdAndChargePointCodeOrderByRequestedAtDesc(transactionId, code)
                    .map(s -> s.getId()).orElse(null);
        } catch (RuntimeException ex) {
            LOCK.warn("Could not look up the charge session for transaction {} on {} (lock evidence will have no "
                    + "session id): {}", transactionId, code, ex.toString());
            return null;
        }
    }

    private static String key(String code, UUID sessionId) {
        return code + ":" + (sessionId == null ? "no-session" : sessionId);
    }
}

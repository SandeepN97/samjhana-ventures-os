package com.samjhana.entity;

import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostUpdate;
import jakarta.persistence.PreUpdate;
import org.hibernate.Hibernate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.WeakHashMap;
import java.util.Collections;

/**
 * Logs every charge-session state transition as {@code old -> new} with the charge session id (logger
 * {@code com.samjhana.ocpp.lifecycle}). A JPA listener, so it covers every place that changes the status
 * without those places having to remember to log.
 */
public class ChargeSessionTransitionLogger {

    private static final Logger LIFECYCLE = LoggerFactory.getLogger("com.samjhana.ocpp.lifecycle");

    /** Last status each entity instance was loaded or written with; weak so it never leaks entities. */
    private static final Map<ChargeSession, ChargeSession.Status> KNOWN =
            Collections.synchronizedMap(new WeakHashMap<>());

    @PostLoad
    public void loaded(ChargeSession session) {
        KNOWN.put(session, session.getStatus());
    }

    @PostPersist
    public void created(ChargeSession session) {
        KNOWN.put(session, session.getStatus());
        LIFECYCLE.info("CHARGE SESSION {} on {}: (new) -> {} {}", session.getId(), code(session),
                session.getStatus(), message(session));
    }

    @PreUpdate
    public void updating(ChargeSession session) {
        ChargeSession.Status previous = KNOWN.get(session);
        if (previous != null && previous != session.getStatus()) {
            LIFECYCLE.info("CHARGE SESSION {} on {}: {} -> {} {}", session.getId(), code(session), previous,
                    session.getStatus(), message(session));
        }
    }

    @PostUpdate
    public void updated(ChargeSession session) {
        KNOWN.put(session, session.getStatus());
    }

    private String code(ChargeSession session) {
        ChargePoint point = session.getChargePoint();
        return point != null && Hibernate.isInitialized(point) ? point.getCode() : "?";
    }

    private String message(ChargeSession session) {
        return session.getStatusMessage() == null ? "" : "(" + session.getStatusMessage() + ")";
    }
}

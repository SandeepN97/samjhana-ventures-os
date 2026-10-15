package com.samjhana.ocpp.diag;

import org.slf4j.MDC;

/**
 * Puts OCPP context on every log line written while it is open (chargePointId, sessionId, messageId,
 * action, chargeSessionId). Always use try-with-resources: close() restores what was there before,
 * so a pooled thread never carries one charger's context into the next request.
 */
public final class OcppMdc implements AutoCloseable {

    public static final String CHARGE_POINT = "chargePointId";
    public static final String SESSION = "sessionId";
    public static final String MESSAGE = "messageId";
    public static final String ACTION = "action";
    public static final String CHARGE_SESSION = "chargeSessionId";

    private static final String[] KEYS = {CHARGE_POINT, SESSION, MESSAGE, ACTION, CHARGE_SESSION};

    private final String[] previous = new String[KEYS.length];

    private OcppMdc() {
        for (int i = 0; i < KEYS.length; i++) previous[i] = MDC.get(KEYS[i]);
    }

    public static OcppMdc open() {
        return new OcppMdc();
    }

    public OcppMdc chargePoint(String value) { return put(CHARGE_POINT, value); }
    public OcppMdc session(String value) { return put(SESSION, value); }
    public OcppMdc message(String value) { return put(MESSAGE, value); }
    public OcppMdc action(String value) { return put(ACTION, value); }
    public OcppMdc chargeSession(Object value) { return put(CHARGE_SESSION, value == null ? null : value.toString()); }

    public OcppMdc put(String key, String value) {
        if (value == null) MDC.remove(key);
        else MDC.put(key, LogSafe.clean(value, 80));
        return this;
    }

    @Override
    public void close() {
        for (int i = 0; i < KEYS.length; i++) {
            if (previous[i] == null) MDC.remove(KEYS[i]);
            else MDC.put(KEYS[i], previous[i]);
        }
    }
}

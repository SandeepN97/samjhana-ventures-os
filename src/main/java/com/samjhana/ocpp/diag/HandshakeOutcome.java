package com.samjhana.ocpp.diag;

/** Why a charger's WebSocket handshake was accepted or rejected. Logged and stored; the client only sees 401/426. */
public enum HandshakeOutcome {
    ACCEPTED,
    NO_SUBPROTOCOL,
    UNSUPPORTED_SUBPROTOCOL,
    UNKNOWN_CHARGER,
    INACTIVE_CHARGER,
    NO_SECRET_HASH,
    NO_AUTH_HEADER,
    MALFORMED_BASIC,
    USER_MISMATCH,
    BAD_PASSWORD,
    /** Too many wrong passwords from this address for this charger lately: refused before any password is checked. */
    TOO_MANY_FAILURES,
    /** Decided by Spring before our interceptor runs; detected by the request filter (403 with an Origin header). */
    ORIGIN_REJECTED
}

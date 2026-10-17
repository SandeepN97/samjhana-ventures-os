package com.samjhana.ocpp;

import com.fasterxml.jackson.databind.JsonNode;
import com.samjhana.ocpp.diag.LogSafe;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * Checks the few things a charger sends that the app stores: the connector status, the serial number, the transaction id and
 * the text of an error it answers a command with (finding D-05).
 *
 * <p>Each of them ends up in a database column of a fixed size, and the standard limits what a charger may send. A value that
 * does not fit used to be found out by the database, which refused the write halfway through the message and left the charger
 * with a bare "InternalError" (or, for the text of an error answer, left the session waiting for ever). The checks here run
 * first, at the edge of the message handler: a wrong value is answered with the standard OCPP error code for it, nothing is
 * stored, and the connection stays open.
 *
 * <p>Two choices keep this from locking out a real charger. A serial number that does not fit is never a reason to refuse the
 * charger's boot (the serial is only a label, the charger is identified by its secret): it is simply not stored. And a
 * transaction id is only refused when it is too long; a missing or non-text one is left to the handling it already had.
 */
public final class OcppFieldChecks {

    /** The connector statuses OCPP 2.0.1 defines ({@code ConnectorStatusEnumType}). */
    private static final Set<String> CONNECTOR_STATUSES = Set.of("Available", "Occupied", "Reserved", "Unavailable", "Faulted");

    /** The standard allows 25 characters; the character set keeps odd text out of logs and screens. */
    private static final Pattern SERIAL = Pattern.compile("[A-Za-z0-9._-]{1,25}");

    /** The standard's limit for a transaction id (the column holds 100). */
    static final int MAX_TRANSACTION_ID = 36;

    /** The size of the stored error code column. */
    static final int MAX_ERROR_CODE = 64;

    /** How much of a charger's error text is kept (the column holds 500; the rest of it helps nobody). */
    static final int MAX_ERROR_TEXT = 200;

    private OcppFieldChecks() {}

    /**
     * A charger field that cannot be accepted. The handler answers it with {@link #errorCode()} and the (fixed) message, and logs
     * {@link #value()}, a short cleaned piece of what was sent. It carries no stack trace: it is an answer, not a failure.
     */
    public static final class Violation extends RuntimeException {
        private final String errorCode;
        private final String value;

        public Violation(String errorCode, String message) {
            this(errorCode, message, null);
        }

        public Violation(String errorCode, String message, String sentValue) {
            super(message, null, false, false);
            this.errorCode = errorCode;
            this.value = LogSafe.clean(sentValue, 60);
        }

        public String errorCode() {
            return errorCode;
        }

        /** A short, cleaned piece of the offending value, for the log only (never sent back to the charger). */
        public String value() {
            return value;
        }
    }

    /**
     * The connector status of a StatusNotification: required, text, and one of the five the standard defines.
     *
     * @throws Violation {@code FormationViolation} when it is missing or not text, {@code PropertyConstraintViolation} when it
     *                   is some other text
     */
    public static String requireConnectorStatus(JsonNode payload) {
        JsonNode status = payload.path("connectorStatus");
        if (status.isMissingNode() || status.isNull()) {
            throw new Violation("FormationViolation", "connectorStatus is required");
        }
        if (!status.isTextual()) {
            throw new Violation("FormationViolation", "connectorStatus must be text", status.toString());
        }
        String text = status.asText();
        if (!CONNECTOR_STATUSES.contains(text)) {
            throw new Violation("PropertyConstraintViolation",
                    "connectorStatus must be one of Available, Occupied, Reserved, Unavailable, Faulted", text);
        }
        return text;
    }

    /**
     * A TransactionEvent whose transaction id is longer than the standard's 36 characters is refused. A missing id or one that is
     * not text is left alone: the event is handled (or ignored) as it always was.
     */
    public static void requireTransactionIdFits(JsonNode payload) {
        JsonNode id = payload.path("transactionInfo").path("transactionId");
        if (id.isValueNode() && id.asText().length() > MAX_TRANSACTION_ID) {
            throw new Violation("PropertyConstraintViolation",
                    "transactionInfo.transactionId must be at most " + MAX_TRANSACTION_ID + " characters", id.asText());
        }
    }

    /** The serial number to store: 1 to 25 letters, digits, dots, underscores or hyphens. Anything else is not stored (null). */
    public static String serialToStore(JsonNode serial) {
        if (serial == null || !serial.isTextual()) return null;
        String text = serial.asText();
        return SERIAL.matcher(text).matches() ? text : null;
    }

    /** Whether the charger sent a serial number at all (a blank one counts as none), so a null from {@link #serialToStore} can be told apart. */
    public static boolean wasSent(JsonNode serial) {
        if (serial == null || serial.isMissingNode() || serial.isNull()) return false;
        return !serial.isTextual() || !serial.asText().isBlank();
    }

    /** An error code from a charger, fit for the 64-character column (cut hard, no suffix) and free of control characters. */
    public static String errorCode(String text) {
        if (text == null) return null;
        String cut = text.length() > MAX_ERROR_CODE ? text.substring(0, MAX_ERROR_CODE) : text;
        StringBuilder out = new StringBuilder(cut.length());
        for (int i = 0; i < cut.length(); i++) {
            char c = cut.charAt(i);
            out.append(Character.isISOControl(c) ? '?' : c);
        }
        return out.toString();
    }

    /** The text of a charger's error answer: control characters replaced, at most 200 characters, and how long it was if cut. */
    public static String errorText(String text) {
        return LogSafe.clean(text, MAX_ERROR_TEXT);
    }
}

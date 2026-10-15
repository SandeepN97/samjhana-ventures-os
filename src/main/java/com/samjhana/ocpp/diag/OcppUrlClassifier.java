package com.samjhana.ocpp.diag;

/**
 * Classifies a request path against the one URL shape the CSMS accepts, {@code /ocpp/<chargePointId>}.
 * Log-only: it never changes which paths are accepted.
 */
public final class OcppUrlClassifier {

    public enum Shape {
        /** Not an /ocpp request at all. */
        NOT_OCPP,
        /** Exactly /ocpp/<id>: the accepted shape. */
        EXPECTED,
        /** /ocpp or /ocpp/ with no charge point id. */
        MISSING_CHARGE_POINT_ID,
        /** /ocpp/<id>/ */
        TRAILING_SLASH,
        /** /ocpp/<id>/<something> (for example a charger appending its own path). */
        EXTRA_SEGMENT,
        /** /ocpp/<id>/<id>: the charger appended its identity to a URL that already contains it. */
        DOUBLED_CHARGE_POINT_ID,
        /** Starts with /ocpp but not /ocpp/ (for example /ocpp2.0.1/<id> or /ocppx). */
        UNKNOWN_PREFIX;

        public boolean isNearMiss() {
            return this != NOT_OCPP && this != EXPECTED;
        }
    }

    private static final String PREFIX = "/ocpp";

    private OcppUrlClassifier() {}

    public static Shape classify(String path) {
        if (path == null || !path.startsWith(PREFIX)) return Shape.NOT_OCPP;
        if (path.equals(PREFIX) || path.equals(PREFIX + "/")) return Shape.MISSING_CHARGE_POINT_ID;
        if (!path.startsWith(PREFIX + "/")) return Shape.UNKNOWN_PREFIX;
        String rest = path.substring(PREFIX.length() + 1);
        if (!rest.contains("/")) return Shape.EXPECTED;
        String[] segments = rest.split("/");
        if (rest.endsWith("/") && segments.length == 1) return Shape.TRAILING_SLASH;
        if (segments.length >= 2 && !segments[0].isEmpty() && segments[0].equals(segments[1])) {
            return Shape.DOUBLED_CHARGE_POINT_ID;
        }
        return Shape.EXTRA_SEGMENT;
    }
}

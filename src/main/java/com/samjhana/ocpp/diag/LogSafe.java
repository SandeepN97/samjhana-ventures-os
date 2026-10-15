package com.samjhana.ocpp.diag;

/** Keeps values taken from a request out of the log's line structure (no CR/LF injection, bounded length). */
public final class LogSafe {

    private LogSafe() {}

    public static String clean(String value) {
        return clean(value, 300);
    }

    public static String clean(String value, int max) {
        if (value == null) return null;
        StringBuilder out = new StringBuilder(Math.min(value.length(), max));
        for (int i = 0; i < value.length() && out.length() < max; i++) {
            char c = value.charAt(i);
            out.append(Character.isISOControl(c) ? '?' : c);
        }
        if (value.length() > max) out.append("...(").append(value.length()).append(" chars)");
        return out.toString();
    }
}

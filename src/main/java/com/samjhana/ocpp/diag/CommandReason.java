package com.samjhana.ocpp.diag;

/**
 * Carries the business reason for an outbound OCPP command ("staff started session", "payment confirmed,
 * unlock") from the caller to the command log without changing any method signature. Scoped to the call.
 */
public final class CommandReason {

    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    private CommandReason() {}

    public static void run(String reason, Runnable action) {
        String previous = CURRENT.get();
        CURRENT.set(reason);
        try {
            action.run();
        } finally {
            if (previous == null) CURRENT.remove();
            else CURRENT.set(previous);
        }
    }

    public static String current() {
        String reason = CURRENT.get();
        return reason == null ? "unspecified" : reason;
    }
}

package com.samjhana.util;

import java.math.BigDecimal;

/**
 * Reads numbers that come from outside (a request, a stored entry, a charger) without letting an extreme one near the
 * arithmetic that follows.
 *
 * <p>{@code new BigDecimal("1e1000000000")} is cheap to build, but adding it to an ordinary number, rescaling it to two
 * places or printing it out makes the JVM build a number with billions of digits (findings G-01 and D-01). Money,
 * litres, kWh and meter readings never need that range, so a number is accepted only when it has at most
 * {@value #MAX_DIGITS} digits, at most {@value #MAX_SCALE} places after the point, and is not written as a power of ten
 * above {@code 10^}{@value #MAX_POWER}.
 */
public final class SafeDecimal {

    /** The most digits a number may have. */
    public static final int MAX_DIGITS = 30;
    /** The most places after the decimal point. */
    public static final int MAX_SCALE = 12;
    /** The largest power of ten a number may be written with (1E+9 is a billion). */
    public static final int MAX_POWER = 9;
    /** The longest text that is even tried. */
    private static final int MAX_TEXT_LENGTH = 64;

    private SafeDecimal() {
    }

    /**
     * The text as a number, or null when it is missing, is not a number, or lies outside the limits. Leading and
     * trailing spaces are ignored.
     */
    public static BigDecimal parse(String text) {
        if (text == null) return null;
        String trimmed = text.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_TEXT_LENGTH) return null;
        try {
            return limited(new BigDecimal(trimmed));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** The number itself when it lies inside the limits, otherwise null (also null for null). */
    public static BigDecimal limited(BigDecimal value) {
        return isSafe(value) ? value : null;
    }

    /** Whether the number lies inside the limits (false for null). */
    public static boolean isSafe(BigDecimal value) {
        return value != null
                && value.precision() <= MAX_DIGITS
                && value.scale() <= MAX_SCALE
                && value.scale() >= -MAX_POWER;
    }
}

package com.samjhana.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Findings G-01 and D-01: a number written with a huge exponent ("1e1000000000") is cheap to read but makes the
 * arithmetic that follows (adding, rescaling, printing it out) build a number with billions of digits. Numbers that come
 * from outside are accepted only inside sensible limits.
 */
class SafeDecimalTest {

    @ParameterizedTest
    @ValueSource(strings = {"0", "12.50", "-3", "1700", "158.5", "0.785", "1E+3", "  42  ", "1.000000000000",
            "123456789012345678901234567890", "-0.000000000001", "1E+9"})
    void shouldAcceptOrdinaryNumbers(String text) {
        assertThat(SafeDecimal.parse(text)).isEqualByComparingTo(new BigDecimal(text.trim()));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "abc", "12abc", "NaN", "Infinity", "0x10", "1,000", "--5", "1e1000000000", "1E+100", "1e-100",
            "1E+10", "0.0000000000001", "1234567890123456789012345678901", "00000000000000000000000000000000000000000000000000000000000000000000001", "99999999999999999999999999999999999999999999999999999999999999999", "1111111111111111111111111111111111111111111111111111111111111111111111.5"})
    void shouldRefuseWhatIsNotAnOrdinaryNumber(String text) {
        assertThat(SafeDecimal.parse(text)).isNull();
    }

    @Test
    void shouldKeepANumberThatIsWithinTheLimits() {
        BigDecimal value = new BigDecimal("12345.678");
        assertThat(SafeDecimal.limited(value)).isSameAs(value);
        assertThat(SafeDecimal.limited(new BigDecimal("1E+9"))).isNotNull();
        assertThat(SafeDecimal.limited(new BigDecimal("1E-12"))).isNotNull();
    }

    @Test
    void shouldDropANumberOutsideTheLimits_andTolerateNull() {
        assertThat(SafeDecimal.limited(null)).isNull();
        assertThat(SafeDecimal.limited(new BigDecimal("1E+1000000000"))).isNull();
        assertThat(SafeDecimal.limited(new BigDecimal("1E+10"))).isNull();
        assertThat(SafeDecimal.limited(new BigDecimal("1E-13"))).isNull();
        assertThat(SafeDecimal.limited(new BigDecimal("1234567890123456789012345678901"))).isNull();
    }

    @Test
    void shouldTellWhetherANumberIsSafe() {
        assertThat(SafeDecimal.isSafe(new BigDecimal("42.5"))).isTrue();
        assertThat(SafeDecimal.isSafe(new BigDecimal("1E+1000000000"))).isFalse();
        assertThat(SafeDecimal.isSafe(null)).isFalse();
    }
}

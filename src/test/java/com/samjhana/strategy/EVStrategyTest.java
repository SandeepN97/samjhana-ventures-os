package com.samjhana.strategy;

import com.samjhana.strategy.impl.EVStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class EVStrategyTest {

    private EVStrategy strategy;

    @BeforeEach
    void setUp() {
        strategy = new EVStrategy();
    }

    @Test
    void shouldReturnCorrectBusinessCode() {
        assertThat(strategy.getBusinessCode()).isEqualTo("ev");
    }

    @Test
    void shouldCalculateAmount_fromMeterReadings() {
        Map<String, Object> fields = Map.of(
            "openingMeter", 15000,
            "closingMeter", 15200,
            "unitRate", 13.50
        );
        BigDecimal amount = strategy.calculateAmount(fields);
        assertThat(amount).isEqualByComparingTo(new BigDecimal("2700.00"));
    }

    @Test
    void shouldFailValidation_whenClosingLessThanOpening() {
        Map<String, Object> fields = Map.of(
            "openingMeter", 15200,
            "closingMeter", 15000,
            "unitRate", 13.50
        );
        BusinessCalculationStrategy.ValidationResult result = strategy.validate(fields);
        assertThat(result.isValid()).isFalse();
    }
}
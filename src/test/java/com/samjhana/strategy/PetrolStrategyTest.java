package com.samjhana.strategy;

import com.samjhana.strategy.impl.PetrolStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PetrolStrategyTest {

    private PetrolStrategy strategy;

    @BeforeEach
    void setUp() {
        strategy = new PetrolStrategy();
    }

    @Test
    void shouldReturnCorrectBusinessCode() {
        assertThat(strategy.getBusinessCode()).isEqualTo("petrol");
    }

    @Test
    void shouldCalculateAmount_whenLitersAndRateProvided() {
        Map<String, Object> fields = Map.of(
            "liters", 100.0,
            "ratePerLiter", 182.50
        );
        BigDecimal amount = strategy.calculateAmount(fields);
        assertThat(amount).isEqualByComparingTo(new BigDecimal("18250.00"));
    }

    @Test
    void shouldReturnZero_whenFieldsMissing() {
        BigDecimal amount = strategy.calculateAmount(Map.of());
        assertThat(amount).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldFailValidation_whenLitersNegative() {
        Map<String, Object> fields = Map.of("liters", -10.0, "ratePerLiter", 182.50);
        BusinessCalculationStrategy.ValidationResult result = strategy.validate(fields);
        assertThat(result.isValid()).isFalse();
    }

    @Test
    void shouldPassValidation_whenFieldsValid() {
        Map<String, Object> fields = Map.of(
            "liters", 500.0,
            "ratePerLiter", 182.50,
            "fuelType", "diesel"
        );
        BusinessCalculationStrategy.ValidationResult result = strategy.validate(fields);
        assertThat(result.isValid()).isTrue();
    }
}
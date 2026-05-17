package com.samjhana.service;

import com.samjhana.strategy.BusinessCalculationStrategy;
import com.samjhana.strategy.impl.EVStrategy;
import com.samjhana.strategy.impl.PetrolStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CalculationEngineTest {

    private CalculationEngine engine;

    @BeforeEach
    void setUp() {
        engine = new CalculationEngine(List.of(new PetrolStrategy(), new EVStrategy()));
        engine.init();
    }

    @Test
    void shouldRegisterAllStrategies() {
        assertThat(engine.getRegisteredBusinessCodes()).containsExactlyInAnyOrder("petrol", "ev");
    }

    @Test
    void shouldReturnTrue_whenStrategyExists() {
        assertThat(engine.hasStrategy("petrol")).isTrue();
    }

    @Test
    void shouldReturnFalse_whenStrategyDoesNotExist() {
        assertThat(engine.hasStrategy("unknown")).isFalse();
    }

    @Test
    void shouldCalculateAmount_forPetrol() {
        Map<String, Object> fields = Map.of("liters", 100.0, "ratePerLiter", 182.50);
        assertThat(engine.calculateAmount("petrol", fields))
            .isEqualByComparingTo(new BigDecimal("18250.00"));
    }

    @Test
    void shouldReturnZero_whenStrategyUnknown() {
        assertThat(engine.calculateAmount("furniture", Map.of()))
            .isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldReturnValidResult_whenFieldsValid() {
        Map<String, Object> fields = Map.of(
            "liters", 100.0,
            "ratePerLiter", 182.50,
            "fuelType", "petrol"
        );
        BusinessCalculationStrategy.ValidationResult result = engine.validate("petrol", fields);
        assertThat(result.isValid()).isTrue();
    }
}
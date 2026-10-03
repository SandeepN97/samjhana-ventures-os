package com.samjhana.strategy;

import com.samjhana.strategy.BusinessCalculationStrategy.ValidationResult;
import com.samjhana.strategy.impl.BeekeepingStrategy;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class BeekeepingStrategyTest {

    private final BeekeepingStrategy strategy = new BeekeepingStrategy();

    private static Map<String, Object> line(Object qty, Object price) {
        return Map.of("itemId", "11111111-1111-1111-1111-111111111111", "itemName", "Honey", "quantity", qty, "unitPrice", price);
    }

    @Test
    void shouldReturnTheBeekeepingCode() {
        assertThat(strategy.getBusinessCode()).isEqualTo("beekeeping");
    }

    @Test
    void shouldSumQuantityTimesPriceAcrossLines_whenCalculatingTheAmount() {
        Map<String, Object> fields = Map.of("items", List.of(line(2, 850), line(1, "3200")));
        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo("4900.00");
    }

    @Test
    void shouldReturnZero_whenThereAreNoLines() {
        assertThat(strategy.calculateAmount(Map.of())).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldAcceptASaleWithOneValidLine() {
        assertThat(strategy.validate(Map.of("items", List.of(line(1, 850)))).isValid()).isTrue();
    }

    @Test
    void shouldRejectASaleWithNoLines() {
        ValidationResult result = strategy.validate(Map.of("items", List.of()));
        assertThat(result.isValid()).isFalse();
        assertThat(result.errors()).containsKey("items");
    }

    @Test
    void shouldRejectZeroNegativeAndFractionalQuantities() {
        for (Object qty : List.of(0, -2, 1.5)) {
            ValidationResult result = strategy.validate(Map.of("items", List.of(line(qty, 100))));
            assertThat(result.isValid()).as("quantity %s", qty).isFalse();
            assertThat(result.errors()).containsKey("quantity");
        }
    }

    @Test
    void shouldRejectANegativePriceAndALineWithoutAProduct() {
        assertThat(strategy.validate(Map.of("items", List.of(line(1, -5)))).errors()).containsKey("unitPrice");
        Map<String, Object> noProduct = Map.of("quantity", 1, "unitPrice", 10);
        assertThat(strategy.validate(Map.of("items", List.of(noProduct))).errors()).containsKey("items");
    }

    @Test
    void shouldReadTheServerWorkedOutProfit_andReturnNullWhenAbsent() {
        assertThat(strategy.calculateProfit(Map.of("profit", "250.50"))).isEqualByComparingTo("250.50");
        assertThat(strategy.calculateProfit(Map.of())).isNull();
    }

    @Test
    void shouldNameTheFirstProductAndCountTheRest_inTheSummary() {
        Map<String, Object> fields = Map.of("items", List.of(line(1, 100), line(2, 50)));
        assertThat(strategy.getSummary(null, fields)).contains("Honey").contains("+1").contains("200.00");
    }
}

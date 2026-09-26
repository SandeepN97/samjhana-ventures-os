package com.samjhana.strategy;

import com.samjhana.entity.Transaction;
import com.samjhana.strategy.impl.FurnitureStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FurnitureStrategyTest {

    private FurnitureStrategy strategy;

    @BeforeEach
    void setUp() {
        strategy = new FurnitureStrategy();
    }

    @Test
    void shouldReturnCorrectBusinessCode() {
        assertThat(strategy.getBusinessCode()).isEqualTo("furniture");
    }

    @Test
    void shouldCalculateAmount_whenQuantityAndPriceProvided() {
        Map<String, Object> fields = Map.of("quantity", 3, "sellingPrice", new BigDecimal("1500"));
        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo(new BigDecimal("4500.00"));
    }

    @Test
    void shouldFallBackToQtyOut_whenQuantityMissing() {
        Map<String, Object> fields = Map.of("qtyOut", 2, "sellingPrice", new BigDecimal("1000"));
        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo(new BigDecimal("2000.00"));
    }

    @Test
    void shouldReturnZero_whenPriceMissing() {
        assertThat(strategy.calculateAmount(Map.of("quantity", 3))).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldReturnZero_whenQuantityAndQtyOutBothMissing() {
        assertThat(strategy.calculateAmount(Map.of("sellingPrice", new BigDecimal("100")))).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldCalculateProfit_whenAllFieldsProvided() {
        Map<String, Object> fields = Map.of(
                "quantity", 2, "sellingPrice", new BigDecimal("1500"), "purchasePrice", new BigDecimal("1000"));
        assertThat(strategy.calculateProfit(fields)).isEqualByComparingTo(new BigDecimal("1000.00"));
    }

    @Test
    void shouldReturnNullProfit_whenPurchasePriceMissing() {
        Map<String, Object> fields = Map.of("quantity", 2, "sellingPrice", new BigDecimal("1500"));
        assertThat(strategy.calculateProfit(fields)).isNull();
    }

    @Test
    void shouldCalculateStock_combiningInitialInAndOut() {
        Map<String, Object> fields = Map.of("initialStock", 10, "qtyIn", 5, "qtyOut", 3);
        assertThat(strategy.calculateStock(fields)).isEqualTo(12);
    }

    @Test
    void shouldDefaultMissingStockFields_toZero() {
        assertThat(strategy.calculateStock(Map.of())).isEqualTo(0);
    }

    @Test
    void shouldPassValidation_whenAllRequiredFieldsPresent() {
        Map<String, Object> fields = Map.of("itemName", "Sofa Set", "quantity", 1, "sellingPrice", new BigDecimal("50000"));
        assertThat(strategy.validate(fields).isValid()).isTrue();
    }

    @Test
    void shouldFailValidation_whenItemNameBlank() {
        Map<String, Object> fields = new HashMap<>();
        fields.put("itemName", "  ");
        fields.put("quantity", 1);
        assertThat(strategy.validate(fields).errors()).containsKey("itemName");
    }

    @Test
    void shouldFailValidation_whenNoQuantityFieldAtAll() {
        Map<String, Object> fields = Map.of("itemName", "Chair");
        assertThat(strategy.validate(fields).errors()).containsKey("quantity");
    }

    @Test
    void shouldFailValidation_whenQuantityNegative() {
        Map<String, Object> fields = Map.of("itemName", "Chair", "quantity", -1);
        assertThat(strategy.validate(fields).errors()).containsKey("quantity");
    }

    @Test
    void shouldFailValidation_whenQtyInNegative() {
        Map<String, Object> fields = Map.of("itemName", "Chair", "qtyIn", -1);
        assertThat(strategy.validate(fields).errors()).containsKey("qtyIn");
    }

    @Test
    void shouldFailValidation_whenQtyOutNegative() {
        Map<String, Object> fields = Map.of("itemName", "Chair", "qtyOut", -1);
        assertThat(strategy.validate(fields).errors()).containsKey("qtyOut");
    }

    @Test
    void shouldFailValidation_whenSellingPriceNegative() {
        Map<String, Object> fields = Map.of("itemName", "Chair", "quantity", 1, "sellingPrice", new BigDecimal("-5"));
        assertThat(strategy.validate(fields).errors()).containsKey("sellingPrice");
    }

    @Test
    void shouldSummariseWithQuantityFallingBackThroughQtyOutThenQtyIn() {
        Transaction transaction = Transaction.builder().amount(new BigDecimal("4500")).build();
        Map<String, Object> fields = Map.of("itemName", "Sofa", "category", "sofa", "qtyOut", 3);
        assertThat(strategy.getSummary(transaction, fields)).contains("Sofa").contains("सोफा").contains("3");
    }

    @Test
    void shouldSummariseWithDefaults_whenItemNameAndCategoryMissing() {
        Transaction transaction = Transaction.builder().amount(new BigDecimal("0")).build();
        assertThat(strategy.getSummary(transaction, Map.of())).contains("फर्निचर").contains("अन्य");
    }

    @Test
    void shouldTranslateAllKnownCategories() {
        Transaction transaction = Transaction.builder().amount(BigDecimal.ZERO).build();
        assertThat(strategy.getSummary(transaction, Map.of("category", "table"))).contains("टेबल");
        assertThat(strategy.getSummary(transaction, Map.of("category", "chair"))).contains("कुर्सी");
        assertThat(strategy.getSummary(transaction, Map.of("category", "bed"))).contains("पलंग");
        assertThat(strategy.getSummary(transaction, Map.of("category", "cabinet"))).contains("क्याबिनेट");
        assertThat(strategy.getSummary(transaction, Map.of("category", "wardrobe"))).contains("अलमारी");
    }

    @Test
    void shouldPassThroughUnknownCategoryUnchanged() {
        Transaction transaction = Transaction.builder().amount(BigDecimal.ZERO).build();
        assertThat(strategy.getSummary(transaction, Map.of("category", "mystery-item"))).contains("mystery-item");
    }

    @Test
    void shouldParseNumericAndStringFieldValues() {
        // getBigDecimal/getInteger accept Number and String forms, not just their exact types
        Map<String, Object> fields = Map.of("quantity", "4", "sellingPrice", "250.5");
        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo(new BigDecimal("1002.00"));
    }

    @Test
    void shouldTreatUnparsableStringValues_asMissing() {
        Map<String, Object> fields = Map.of("quantity", "not-a-number", "sellingPrice", new BigDecimal("100"));
        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo(BigDecimal.ZERO);
    }
}

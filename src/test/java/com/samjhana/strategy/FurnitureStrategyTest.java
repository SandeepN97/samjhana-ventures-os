package com.samjhana.strategy;

import com.samjhana.entity.Transaction;
import com.samjhana.strategy.impl.FurnitureStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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

    // ---- finding P0-11: how many of each item a sale line takes off the stock ----

    private Map<String, Object> saleWithLines(Object... lines) {
        return Map.of("itemName", "Sofa Set", "quantity", 1, "items", List.of(lines));
    }

    private Map<String, Object> line(Object quantity) {
        Map<String, Object> line = new HashMap<>();
        line.put("itemId", UUID.randomUUID().toString());
        line.put("quantity", quantity);
        return line;
    }

    @Test
    void shouldAcceptSaleLinesWithAWholeQuantity() {
        assertThat(strategy.validate(saleWithLines(line(1), line(5), line(10_000), line(3.0), line(2L))).isValid()).isTrue();
    }

    @Test
    void shouldAcceptALineWithNoQuantity_whichMeansOne() {
        Map<String, Object> noQuantity = new HashMap<>();
        noQuantity.put("itemId", UUID.randomUUID().toString());

        assertThat(strategy.validate(saleWithLines(noQuantity)).isValid()).isTrue();
    }

    @Test
    void shouldAcceptASaleWithNoLinesAtAll() {
        assertThat(strategy.validate(Map.of("itemName", "Sofa Set", "quantity", 1)).isValid()).isTrue();
    }

    @Test
    void shouldRejectALineWithANegativeQuantity_whichWouldAddToTheStock() {
        var result = strategy.validate(saleWithLines(line(-5)));

        assertThat(result.isValid()).isFalse();
        assertThat(result.errors()).containsKey("items[0].quantity");
    }

    @Test
    void shouldRejectALineWithAZeroQuantity() {
        assertThat(strategy.validate(saleWithLines(line(0))).errors()).containsKey("items[0].quantity");
    }

    @Test
    void shouldRejectALineWithAFractionalQuantity() {
        assertThat(strategy.validate(saleWithLines(line(2.5))).errors()).containsKey("items[0].quantity");
    }

    @Test
    void shouldRejectALineAboveTheLargestQuantity() {
        assertThat(strategy.validate(saleWithLines(line(10_001))).errors()).containsKey("items[0].quantity");
    }

    @Test
    void shouldRejectALineWhoseQuantityIsNotANumber() {
        assertThat(strategy.validate(saleWithLines(line("5"))).errors()).containsKey("items[0].quantity");
        assertThat(strategy.validate(saleWithLines(line(true))).errors()).containsKey("items[0].quantity");
    }

    @Test
    void shouldNameTheLineThatIsWrong() {
        var result = strategy.validate(saleWithLines(line(1), line(-1), line(2)));

        assertThat(result.errors()).containsOnlyKeys("items[1].quantity");
    }

    @Test
    void shouldRejectItemsThatAreNotAList() {
        var result = strategy.validate(Map.of("itemName", "Sofa Set", "quantity", 1, "items", "many"));

        assertThat(result.errors()).containsKey("items");
    }

    @Test
    void shouldRejectALineThatIsNotAnObject() {
        var result = strategy.validate(saleWithLines("a sofa"));

        assertThat(result.errors()).containsKey("items[0]");
    }

    // ---- finding P1B1-02: the order screen sends a line per item and no item name or quantity at the top ----

    private Map<String, Object> orderLine(String itemName, Object quantity, Object unitPrice) {
        Map<String, Object> line = new HashMap<>();
        line.put("itemId", UUID.randomUUID().toString());
        line.put("itemName", itemName);
        line.put("quantity", quantity);
        line.put("unitPrice", unitPrice);
        return line;
    }

    private Map<String, Object> order(Object... lines) {
        Map<String, Object> fields = new HashMap<>();
        fields.put("customerName", "Hari Thapa");
        fields.put("paymentMethod", "CASH");
        fields.put("items", List.of(lines));
        return fields;
    }

    @Test
    void shouldPassValidation_whenTheOrderHasALinePerItemAndNothingAtTheTop() {
        assertThat(strategy.validate(order(orderLine("Teak Sofa", 2, 45000), orderLine("Chair", 4, 3500))).isValid()).isTrue();
    }

    @Test
    void shouldStillRequireTheItemNameAndQuantity_whenTheOrderHasNoLines() {
        var result = strategy.validate(order());

        assertThat(result.errors()).containsKeys("itemName", "quantity");
    }

    @Test
    void shouldFailValidation_whenALineNamesNoItemAtAll() {
        Map<String, Object> nameless = new HashMap<>();
        nameless.put("quantity", 1);
        nameless.put("unitPrice", 1000);

        assertThat(strategy.validate(order(nameless)).errors()).containsOnlyKeys("items[0].itemName");
    }

    @Test
    void shouldPassValidation_whenALineIsNamedByIdOnlyOrByNameOnly() {
        Map<String, Object> byId = new HashMap<>();
        byId.put("itemId", UUID.randomUUID().toString());
        Map<String, Object> byName = new HashMap<>();
        byName.put("itemName", "Custom-made wardrobe");

        assertThat(strategy.validate(order(byId, byName)).isValid()).isTrue();
    }

    @Test
    void shouldFailValidation_whenALineHasANegativeOrNonNumericUnitPrice() {
        assertThat(strategy.validate(order(orderLine("Chair", 1, -5))).errors()).containsKey("items[0].unitPrice");
        assertThat(strategy.validate(order(orderLine("Chair", 1, "free"))).errors()).containsKey("items[0].unitPrice");
        assertThat(strategy.validate(order(orderLine("Chair", 1, true))).errors()).containsKey("items[0].unitPrice");
    }

    @Test
    void shouldFailValidation_whenALineUnitPriceIsNotAFiniteNumber() {
        assertThat(strategy.validate(order(orderLine("Chair", 1, Double.POSITIVE_INFINITY))).errors()).containsKey("items[0].unitPrice");
        assertThat(strategy.validate(order(orderLine("Chair", 1, Double.NaN))).errors()).containsKey("items[0].unitPrice");
    }

    @Test
    void shouldPassValidation_whenALineIsFreeOrPricedWithDecimals() {
        assertThat(strategy.validate(order(orderLine("Gift stool", 1, 0), orderLine("Table", 1, 12500.5))).isValid()).isTrue();
    }

    @Test
    void shouldFailValidation_notThrow_whenTheItemNameIsNotText() {
        Map<String, Object> fields = Map.of("itemName", 123, "quantity", 1);

        assertThat(strategy.validate(fields).errors()).containsKey("itemName");
    }

    @Test
    void shouldSummariseAnOrderByItsFirstItemTheNumberOfOthersAndThePiecesInAll() {
        Transaction transaction = Transaction.builder().amount(new BigDecimal("104000")).build();

        String summary = strategy.getSummary(transaction, order(orderLine("Teak Sofa", 2, 45000), orderLine("Chair", 4, 3500)));

        assertThat(summary).contains("Teak Sofa +1").contains("× 6").contains("104000.00");
    }

    @Test
    void shouldSummariseAOneLineOrderWithoutAnExtraCountAndCountAMissingQuantityAsOne() {
        Transaction transaction = Transaction.builder().amount(new BigDecimal("45000")).build();
        Map<String, Object> noQuantity = new HashMap<>();
        noQuantity.put("itemName", "Teak Sofa");

        String summary = strategy.getSummary(transaction, order(noQuantity));

        assertThat(summary).contains("Teak Sofa (").doesNotContain("+").contains("× 1");
    }

    @Test
    void shouldSummariseWithoutThrowing_whenTheItemNameOrCategoryIsNotText() {
        Transaction transaction = Transaction.builder().amount(BigDecimal.ZERO).build();

        assertThat(strategy.getSummary(transaction, Map.of("itemName", 123, "category", List.of("x")))).contains("फर्निचर").contains("अन्य");
    }
}

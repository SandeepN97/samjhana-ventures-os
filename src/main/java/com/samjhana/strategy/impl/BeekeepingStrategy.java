package com.samjhana.strategy.impl;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.strategy.BusinessCalculationStrategy;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Beekeeping shop sales and purchases. A transaction carries its product lines in
 * {@code customFields.items} as {@code [{itemId, itemName, quantity, unitPrice}]}. The amount is the
 * sum of the lines. Cost and profit are added by the server from the product's cost price.
 */
@Component
public class BeekeepingStrategy implements BusinessCalculationStrategy {

    @Override
    public String getBusinessCode() {
        return BusinessUnit.CODE_BEEKEEPING;
    }

    @Override
    public BigDecimal calculateAmount(Map<String, Object> customFields) {
        BigDecimal total = BigDecimal.ZERO;
        for (Map<String, Object> line : lines(customFields)) {
            BigDecimal price = number(line.get("unitPrice"));
            BigDecimal qty = number(line.get("quantity"));
            if (price != null && qty != null) total = total.add(price.multiply(qty));
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    /** The server stores {@code profit} on the transaction; the strategy only reads it back. */
    @Override
    public BigDecimal calculateProfit(Map<String, Object> customFields) {
        return number(customFields.get("profit"));
    }

    @Override
    public ValidationResult validate(Map<String, Object> customFields) {
        Map<String, String> errors = new HashMap<>();
        List<Map<String, Object>> lines = lines(customFields);
        if (lines.isEmpty()) {
            errors.put("items", "Add at least one product");
        }
        for (Map<String, Object> line : lines) {
            Object itemId = line.get("itemId");
            if (itemId == null || itemId.toString().isBlank()) errors.put("items", "Every line needs a product");
            BigDecimal qty = number(line.get("quantity"));
            if (qty == null || qty.signum() <= 0 || qty.stripTrailingZeros().scale() > 0) {
                errors.put("quantity", "Quantity must be a whole number of at least 1");
            }
            BigDecimal price = number(line.get("unitPrice"));
            if (price == null || price.signum() < 0) errors.put("unitPrice", "Price cannot be negative");
        }
        return errors.isEmpty() ? ValidationResult.valid() : ValidationResult.invalid(errors);
    }

    @Override
    public String getSummary(Transaction transaction, Map<String, Object> customFields) {
        List<Map<String, Object>> lines = lines(customFields);
        String first = lines.isEmpty() ? "मौरीपालन" : String.valueOf(lines.get(0).getOrDefault("itemName", "मौरीपालन"));
        String more = lines.size() > 1 ? " +" + (lines.size() - 1) : "";
        return String.format("%s%s = रु %.2f", first, more, calculateAmount(customFields));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> lines(Map<String, Object> customFields) {
        Object items = customFields == null ? null : customFields.get("items");
        if (!(items instanceof List)) return List.of();
        return ((List<Object>) items).stream()
                .filter(o -> o instanceof Map)
                .map(o -> (Map<String, Object>) o)
                .toList();
    }

    private static BigDecimal number(Object value) {
        if (value == null) return null;
        try {
            return new BigDecimal(value.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}

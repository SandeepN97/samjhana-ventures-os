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

@Component
public class FurnitureStrategy implements BusinessCalculationStrategy {

    /** The most of one item a single line of a sale or purchase may take off (or put on) the stock. */
    public static final int MAX_LINE_QUANTITY = 10_000;

    /**
     * The whole number a line's quantity stands for, or null when it is not a whole number from 1 to
     * {@link #MAX_LINE_QUANTITY} (a negative quantity would add to the stock, finding P0-11).
     */
    public static Integer lineQuantity(Object value) {
        if (!(value instanceof Number number)) return null;
        double quantity = number.doubleValue();
        if (Double.isNaN(quantity) || quantity != Math.rint(quantity)) return null;
        if (quantity < 1 || quantity > MAX_LINE_QUANTITY) return null;
        return (int) quantity;
    }

    @Override
    public String getBusinessCode() {
        return BusinessUnit.CODE_FURNITURE;
    }

    @Override
    public BigDecimal calculateAmount(Map<String, Object> customFields) {
        Integer quantity = getInteger(customFields, "quantity");
        BigDecimal price = getBigDecimal(customFields, "sellingPrice");
        if (quantity == null) quantity = getInteger(customFields, "qtyOut");
        if (quantity == null || price == null) return BigDecimal.ZERO;
        return price.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public BigDecimal calculateProfit(Map<String, Object> customFields) {
        Integer quantity = getInteger(customFields, "quantity");
        if (quantity == null) quantity = getInteger(customFields, "qtyOut");
        BigDecimal sellingPrice = getBigDecimal(customFields, "sellingPrice");
        BigDecimal purchasePrice = getBigDecimal(customFields, "purchasePrice");
        if (quantity == null || sellingPrice == null || purchasePrice == null) return null;
        return sellingPrice.subtract(purchasePrice).multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
    }

    public int calculateStock(Map<String, Object> customFields) {
        Integer initialStock = getInteger(customFields, "initialStock");
        Integer qtyIn = getInteger(customFields, "qtyIn");
        Integer qtyOut = getInteger(customFields, "qtyOut");
        int initial = initialStock != null ? initialStock : 0;
        int in = qtyIn != null ? qtyIn : 0;
        int out = qtyOut != null ? qtyOut : 0;
        return initial + in - out;
    }

    @Override
    public ValidationResult validate(Map<String, Object> customFields) {
        Map<String, String> errors = new HashMap<>();
        String itemName = (String) customFields.get("itemName");
        if (itemName == null || itemName.isBlank()) errors.put("itemName", "Item name is required");
        Integer quantity = getInteger(customFields, "quantity");
        Integer qtyIn = getInteger(customFields, "qtyIn");
        Integer qtyOut = getInteger(customFields, "qtyOut");
        if (quantity == null && qtyIn == null && qtyOut == null) errors.put("quantity", "Quantity is required");
        if (quantity != null && quantity < 0) errors.put("quantity", "Quantity cannot be negative");
        if (qtyIn != null && qtyIn < 0) errors.put("qtyIn", "Quantity In cannot be negative");
        if (qtyOut != null && qtyOut < 0) errors.put("qtyOut", "Quantity Out cannot be negative");
        BigDecimal sellingPrice = getBigDecimal(customFields, "sellingPrice");
        if (sellingPrice != null && sellingPrice.compareTo(BigDecimal.ZERO) < 0) {
            errors.put("sellingPrice", "Selling price cannot be negative");
        }
        validateLines(customFields.get("items"), errors);
        return errors.isEmpty() ? ValidationResult.valid() : ValidationResult.invalid(errors);
    }

    /** The lines of a sale or purchase each name an item and a quantity; the quantity moves the stock, so it is checked. */
    private void validateLines(Object items, Map<String, String> errors) {
        if (items == null) return;
        if (!(items instanceof List<?> lines)) {
            errors.put("items", "Items must be a list");
            return;
        }
        for (int i = 0; i < lines.size(); i++) {
            if (!(lines.get(i) instanceof Map<?, ?> line)) {
                errors.put("items[" + i + "]", "Each item must be an object");
                continue;
            }
            Object quantity = line.get("quantity");   // no quantity means one
            if (quantity != null && lineQuantity(quantity) == null) {
                errors.put("items[" + i + "].quantity", "Quantity must be a whole number from 1 to " + MAX_LINE_QUANTITY);
            }
        }
    }

    @Override
    public String getSummary(Transaction transaction, Map<String, Object> customFields) {
        String itemName = (String) customFields.get("itemName");
        String category = (String) customFields.get("category");
        Integer quantity = getInteger(customFields, "quantity");
        if (quantity == null) quantity = getInteger(customFields, "qtyOut");
        if (quantity == null) quantity = getInteger(customFields, "qtyIn");
        String categoryLabel = getCategoryLabel(category);
        return String.format("%s (%s) × %d = रु %.2f",
                itemName != null ? itemName : "फर्निचर",
                categoryLabel,
                quantity != null ? quantity : 0,
                transaction.getAmount() != null ? transaction.getAmount() : BigDecimal.ZERO);
    }

    private String getCategoryLabel(String category) {
        if (category == null) return "अन्य";
        return switch (category.toLowerCase()) {
            case "sofa" -> "सोफा";
            case "table" -> "टेबल";
            case "chair" -> "कुर्सी";
            case "bed" -> "पलंग";
            case "cabinet" -> "क्याबिनेट";
            case "wardrobe" -> "अलमारी";
            default -> category;
        };
    }

    private BigDecimal getBigDecimal(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) return null;
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number num) return BigDecimal.valueOf(num.doubleValue());
        if (value instanceof String str) { try { return new BigDecimal(str); } catch (NumberFormatException e) { return null; } }
        return null;
    }

    private Integer getInteger(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) return null;
        if (value instanceof Integer i) return i;
        if (value instanceof Number num) return num.intValue();
        if (value instanceof String str) { try { return Integer.parseInt(str); } catch (NumberFormatException e) { return null; } }
        return null;
    }
}

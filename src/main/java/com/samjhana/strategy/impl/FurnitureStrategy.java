package com.samjhana.strategy.impl;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.strategy.BusinessCalculationStrategy;
import com.samjhana.util.SafeDecimal;
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
        // An order with a line per item (the order screen sends this) names its items and quantities on the lines;
        // a sale of one item names it here (finding P1B1-02).
        boolean hasLines = customFields.get("items") instanceof List<?> lines && !lines.isEmpty();
        if (!hasLines && text(customFields.get("itemName")) == null) errors.put("itemName", "Item name is required");
        Integer quantity = getInteger(customFields, "quantity");
        Integer qtyIn = getInteger(customFields, "qtyIn");
        Integer qtyOut = getInteger(customFields, "qtyOut");
        if (!hasLines && quantity == null && qtyIn == null && qtyOut == null) errors.put("quantity", "Quantity is required");
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

    /**
     * The lines of a sale or purchase each name an item (by id or by name) and a quantity, and may carry a price; the
     * quantity moves the stock, so it is checked.
     */
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
            if (text(line.get("itemId")) == null && text(line.get("itemName")) == null) {
                errors.put("items[" + i + "].itemName", "Each line needs an item");
            }
            Object quantity = line.get("quantity");   // no quantity means one
            if (quantity != null && lineQuantity(quantity) == null) {
                errors.put("items[" + i + "].quantity", "Quantity must be a whole number from 1 to " + MAX_LINE_QUANTITY);
            }
            Object unitPrice = line.get("unitPrice");
            if (unitPrice != null && !(unitPrice instanceof Number price && Double.isFinite(price.doubleValue()) && price.doubleValue() >= 0)) {
                errors.put("items[" + i + "].unitPrice", "Unit price must be a number that is not negative");
            }
        }
    }

    @Override
    public String getSummary(Transaction transaction, Map<String, Object> customFields) {
        String itemName = text(customFields.get("itemName"));
        String more = "";
        Integer quantity = getInteger(customFields, "quantity");
        if (quantity == null) quantity = getInteger(customFields, "qtyOut");
        if (quantity == null) quantity = getInteger(customFields, "qtyIn");
        if (itemName == null && customFields.get("items") instanceof List<?> lines && !lines.isEmpty()) {
            // An order with a line per item: the first item's name, how many more there are, and the pieces in all.
            if (lines.get(0) instanceof Map<?, ?> first) itemName = text(first.get("itemName"));
            if (lines.size() > 1) more = " +" + (lines.size() - 1);
            if (quantity == null) quantity = piecesOnTheLines(lines);
        }
        String categoryLabel = getCategoryLabel(text(customFields.get("category")));
        return String.format("%s%s (%s) × %d = रु %.2f",
                itemName != null ? itemName : "फर्निचर",
                more,
                categoryLabel,
                quantity != null ? quantity : 0,
                transaction.getAmount() != null ? transaction.getAmount() : BigDecimal.ZERO);
    }

    /** The pieces on all the lines of an order; a line with no usable quantity counts as one. */
    private int piecesOnTheLines(List<?> lines) {
        int pieces = 0;
        for (Object line : lines) {
            Integer quantity = line instanceof Map<?, ?> map && map.get("quantity") != null ? lineQuantity(map.get("quantity")) : null;
            pieces += quantity != null ? quantity : 1;
        }
        return pieces;
    }

    /** The text if it is a non-blank string, otherwise null (a number or a list where a name belongs is just "not given"). */
    private static String text(Object value) {
        return value instanceof String string && !string.isBlank() ? string : null;
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
        // Numbers from outside are read through SafeDecimal: one with an extreme exponent counts as missing (G-01, D-01).
        if (value instanceof BigDecimal bd) return SafeDecimal.limited(bd);
        if (value instanceof Number num) return SafeDecimal.limited(BigDecimal.valueOf(num.doubleValue()));
        if (value instanceof String str) return SafeDecimal.parse(str);
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

package com.samjhana.strategy.impl;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.strategy.BusinessCalculationStrategy;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

@Component
public class FurnitureStrategy implements BusinessCalculationStrategy {

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
        return errors.isEmpty() ? ValidationResult.valid() : ValidationResult.invalid(errors);
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

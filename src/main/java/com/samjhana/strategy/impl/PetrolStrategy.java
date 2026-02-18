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
public class PetrolStrategy implements BusinessCalculationStrategy {

    @Override
    public String getBusinessCode() {
        return BusinessUnit.CODE_PETROL;
    }

    @Override
    public BigDecimal calculateAmount(Map<String, Object> customFields) {
        BigDecimal liters = getBigDecimal(customFields, "liters");
        BigDecimal ratePerLiter = getBigDecimal(customFields, "ratePerLiter");
        if (liters == null || ratePerLiter == null) return BigDecimal.ZERO;
        return liters.multiply(ratePerLiter).setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public BigDecimal calculateProfit(Map<String, Object> customFields) {
        BigDecimal liters = getBigDecimal(customFields, "liters");
        BigDecimal ratePerLiter = getBigDecimal(customFields, "ratePerLiter");
        BigDecimal purchaseRate = getBigDecimal(customFields, "purchaseRate");
        if (liters == null || ratePerLiter == null || purchaseRate == null) return null;
        return ratePerLiter.subtract(purchaseRate).multiply(liters).setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public ValidationResult validate(Map<String, Object> customFields) {
        Map<String, String> errors = new HashMap<>();
        BigDecimal liters = getBigDecimal(customFields, "liters");
        if (liters == null || liters.compareTo(BigDecimal.ZERO) <= 0) {
            errors.put("liters", "Liters must be greater than 0");
        }
        BigDecimal ratePerLiter = getBigDecimal(customFields, "ratePerLiter");
        if (ratePerLiter == null || ratePerLiter.compareTo(BigDecimal.ZERO) <= 0) {
            errors.put("ratePerLiter", "Rate per liter must be greater than 0");
        }
        String fuelType = (String) customFields.get("fuelType");
        if (fuelType == null || fuelType.isBlank()) {
            errors.put("fuelType", "Fuel type is required");
        } else if (!fuelType.equals("petrol") && !fuelType.equals("diesel")) {
            errors.put("fuelType", "Fuel type must be 'petrol' or 'diesel'");
        }
        BigDecimal density = getBigDecimal(customFields, "density");
        if (density != null && (density.compareTo(new BigDecimal("0.7")) < 0 || density.compareTo(new BigDecimal("0.9")) > 0)) {
            errors.put("density", "Density should be between 0.7 and 0.9");
        }
        return errors.isEmpty() ? ValidationResult.valid() : ValidationResult.invalid(errors);
    }

    @Override
    public String getSummary(Transaction transaction, Map<String, Object> customFields) {
        BigDecimal liters = getBigDecimal(customFields, "liters");
        String fuelType = (String) customFields.get("fuelType");
        BigDecimal rate = getBigDecimal(customFields, "ratePerLiter");
        String fuelLabel = "petrol".equals(fuelType) ? "पेट्रोल" : "डिजेल";
        return String.format("%s %.2f लिटर @ रु %.2f = रु %.2f", fuelLabel,
                liters != null ? liters : BigDecimal.ZERO,
                rate != null ? rate : BigDecimal.ZERO,
                transaction.getAmount() != null ? transaction.getAmount() : BigDecimal.ZERO);
    }

    @Override
    public ReconciliationResult reconcile(Map<String, Object> customFields, Map<String, Object> previousState) {
        BigDecimal openingStock = getBigDecimal(customFields, "openingStock");
        BigDecimal closingStock = getBigDecimal(customFields, "closingStock");
        BigDecimal sales = getBigDecimal(customFields, "liters");
        BigDecimal purchases = getBigDecimal(customFields, "purchases");
        if (openingStock == null || closingStock == null || sales == null) return ReconciliationResult.notApplicable();
        BigDecimal purchasesValue = purchases != null ? purchases : BigDecimal.ZERO;
        BigDecimal theoreticalClosing = openingStock.add(purchasesValue).subtract(sales);
        BigDecimal variance = closingStock.subtract(theoreticalClosing);
        String message = variance.abs().compareTo(new BigDecimal("5")) <= 0 ? "Stock reconciled within tolerance"
                : variance.compareTo(BigDecimal.ZERO) < 0 ? String.format("Shortage of %.2f liters detected", variance.abs())
                : String.format("Excess of %.2f liters detected", variance);
        return new ReconciliationResult(true, theoreticalClosing, closingStock, variance, message);
    }

    private BigDecimal getBigDecimal(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) return null;
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number num) return BigDecimal.valueOf(num.doubleValue());
        if (value instanceof String str) { try { return new BigDecimal(str); } catch (NumberFormatException e) { return null; } }
        return null;
    }
}

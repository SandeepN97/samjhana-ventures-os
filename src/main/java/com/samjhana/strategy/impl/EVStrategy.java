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
public class EVStrategy implements BusinessCalculationStrategy {

    @Override
    public String getBusinessCode() {
        return BusinessUnit.CODE_EV;
    }

    @Override
    public BigDecimal calculateAmount(Map<String, Object> customFields) {
        if (isPercentageMode(customFields)) {
            BigDecimal startPercent = getBigDecimal(customFields, "startPercent");
            BigDecimal endPercent = getBigDecimal(customFields, "endPercent");
            BigDecimal ratePerPercent = getBigDecimal(customFields, "ratePerPercent");
            if (startPercent == null || endPercent == null || ratePerPercent == null) return BigDecimal.ZERO;
            return endPercent.subtract(startPercent).multiply(ratePerPercent).setScale(2, RoundingMode.HALF_UP);
        }
        // METER mode (default)
        BigDecimal openingMeter = getBigDecimal(customFields, "openingMeter");
        BigDecimal closingMeter = getBigDecimal(customFields, "closingMeter");
        BigDecimal unitRate = getBigDecimal(customFields, "unitRate");
        if (openingMeter == null || closingMeter == null || unitRate == null) return BigDecimal.ZERO;
        return closingMeter.subtract(openingMeter).multiply(unitRate).setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public BigDecimal calculateProfit(Map<String, Object> customFields) {
        if (isPercentageMode(customFields)) {
            // No NEA cost tracking for percentage mode
            return null;
        }
        BigDecimal units = calculateUnits(customFields);
        BigDecimal unitRate = getBigDecimal(customFields, "unitRate");
        BigDecimal neaCostPerUnit = getBigDecimal(customFields, "neaCostPerUnit");
        if (units == null || unitRate == null || neaCostPerUnit == null) return null;
        return unitRate.subtract(neaCostPerUnit).multiply(units).setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public ValidationResult validate(Map<String, Object> customFields) {
        Map<String, String> errors = new HashMap<>();

        if (isPercentageMode(customFields)) {
            BigDecimal startPercent = getBigDecimal(customFields, "startPercent");
            BigDecimal endPercent = getBigDecimal(customFields, "endPercent");
            if (startPercent == null) errors.put("startPercent", "Start percentage is required");
            if (endPercent == null) errors.put("endPercent", "End percentage is required");
            if (startPercent != null && (startPercent.compareTo(BigDecimal.ZERO) < 0 || startPercent.compareTo(new BigDecimal("100")) > 0)) {
                errors.put("startPercent", "Start percentage must be between 0 and 100");
            }
            if (endPercent != null && (endPercent.compareTo(BigDecimal.ZERO) < 0 || endPercent.compareTo(new BigDecimal("100")) > 0)) {
                errors.put("endPercent", "End percentage must be between 0 and 100");
            }
            if (startPercent != null && endPercent != null && endPercent.compareTo(startPercent) <= 0) {
                errors.put("endPercent", "End percentage must be greater than start percentage");
            }
            BigDecimal ratePerPercent = getBigDecimal(customFields, "ratePerPercent");
            if (ratePerPercent == null || ratePerPercent.compareTo(BigDecimal.ZERO) <= 0) {
                errors.put("ratePerPercent", "Rate per percent must be greater than 0");
            }
        } else {
            BigDecimal openingMeter = getBigDecimal(customFields, "openingMeter");
            BigDecimal closingMeter = getBigDecimal(customFields, "closingMeter");
            if (openingMeter == null) errors.put("openingMeter", "Opening meter reading is required");
            if (closingMeter == null) errors.put("closingMeter", "Closing meter reading is required");
            if (openingMeter != null && closingMeter != null && closingMeter.compareTo(openingMeter) < 0) {
                errors.put("closingMeter", "Closing meter must be greater than opening meter");
            }
            BigDecimal unitRate = getBigDecimal(customFields, "unitRate");
            if (unitRate == null || unitRate.compareTo(BigDecimal.ZERO) <= 0) {
                errors.put("unitRate", "Unit rate must be greater than 0");
            }
        }

        return errors.isEmpty() ? ValidationResult.valid() : ValidationResult.invalid(errors);
    }

    @Override
    public String getSummary(Transaction transaction, Map<String, Object> customFields) {
        if (isPercentageMode(customFields)) {
            BigDecimal startPercent = getBigDecimal(customFields, "startPercent");
            BigDecimal endPercent = getBigDecimal(customFields, "endPercent");
            BigDecimal rate = getBigDecimal(customFields, "ratePerPercent");
            String vehicleName = (String) customFields.get("vehicleName");
            return String.format("%s चार्जिंग: %s%% → %s%% @ रु %.2f/%% = रु %.2f",
                    vehicleName != null ? vehicleName : "गाडी",
                    startPercent != null ? startPercent.stripTrailingZeros().toPlainString() : "0",
                    endPercent != null ? endPercent.stripTrailingZeros().toPlainString() : "0",
                    rate != null ? rate : BigDecimal.ZERO,
                    transaction.getAmount() != null ? transaction.getAmount() : BigDecimal.ZERO);
        }
        // METER mode
        BigDecimal units = calculateUnits(customFields);
        BigDecimal rate = getBigDecimal(customFields, "unitRate");
        String chargerType = (String) customFields.get("chargerType");
        String chargerLabel = switch (chargerType != null ? chargerType : "UNKNOWN") {
            case "DC_FAST" -> "DC फास्ट";
            case "AC_SLOW" -> "AC स्लो";
            default -> "चार्जर";
        };
        return String.format("%s चार्जिंग: %.2f kWh @ रु %.2f = रु %.2f", chargerLabel,
                units != null ? units : BigDecimal.ZERO,
                rate != null ? rate : BigDecimal.ZERO,
                transaction.getAmount() != null ? transaction.getAmount() : BigDecimal.ZERO);
    }

    @Override
    public ReconciliationResult reconcile(Map<String, Object> customFields, Map<String, Object> previousState) {
        if (isPercentageMode(customFields)) {
            return ReconciliationResult.notApplicable();
        }
        BigDecimal totalUnitsCharged = getBigDecimal(customFields, "totalUnitsCharged");
        BigDecimal neaBillUnits = getBigDecimal(customFields, "neaBillUnits");
        if (totalUnitsCharged == null || neaBillUnits == null) return ReconciliationResult.notApplicable();
        BigDecimal variance = totalUnitsCharged.subtract(neaBillUnits);
        BigDecimal tolerance = neaBillUnits.multiply(new BigDecimal("0.02"));
        String message = variance.abs().compareTo(tolerance) <= 0 ? "NEA bill reconciled within 2% tolerance"
                : variance.compareTo(BigDecimal.ZERO) > 0 ? String.format("Charged %.2f kWh more than NEA bill shows", variance)
                : String.format("NEA bill shows %.2f kWh more than meter readings", variance.abs());
        return new ReconciliationResult(true, neaBillUnits, totalUnitsCharged, variance, message);
    }

    private boolean isPercentageMode(Map<String, Object> customFields) {
        return "PERCENTAGE".equals(customFields.get("chargingMode"));
    }

    private BigDecimal calculateUnits(Map<String, Object> customFields) {
        BigDecimal openingMeter = getBigDecimal(customFields, "openingMeter");
        BigDecimal closingMeter = getBigDecimal(customFields, "closingMeter");
        if (openingMeter == null || closingMeter == null) return null;
        return closingMeter.subtract(openingMeter);
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

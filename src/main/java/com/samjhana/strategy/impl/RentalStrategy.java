package com.samjhana.strategy.impl;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.strategy.BusinessCalculationStrategy;
import com.samjhana.util.SafeDecimal;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

@Component
public class RentalStrategy implements BusinessCalculationStrategy {

    @Override
    public String getBusinessCode() {
        return BusinessUnit.CODE_RENTAL;
    }

    @Override
    public BigDecimal calculateAmount(Map<String, Object> customFields) {
        BigDecimal monthlyRent = getBigDecimal(customFields, "monthlyRent");
        Integer monthsPaid = getInteger(customFields, "monthsPaid");
        if (monthlyRent != null && monthsPaid != null) {
            return monthlyRent.multiply(BigDecimal.valueOf(monthsPaid));
        }
        return monthlyRent != null ? monthlyRent : BigDecimal.ZERO;
    }

    @Override
    public BigDecimal calculateProfit(Map<String, Object> customFields) {
        BigDecimal amount = calculateAmount(customFields);
        BigDecimal maintenance = getBigDecimal(customFields, "maintenanceCost");
        return maintenance != null ? amount.subtract(maintenance) : amount;
    }

    public BigDecimal calculateDueAmount(Map<String, Object> customFields) {
        BigDecimal monthlyRent = getBigDecimal(customFields, "monthlyRent");
        LocalDate paidUntil = getLocalDate(customFields, "paidUntil");
        if (monthlyRent == null) return BigDecimal.ZERO;
        LocalDate today = LocalDate.now();
        LocalDate dueFrom;
        if (paidUntil != null) {
            dueFrom = paidUntil.plusMonths(1).withDayOfMonth(1);
        } else {
            LocalDate leaseStart = getLocalDate(customFields, "leaseStartDate");
            dueFrom = leaseStart != null ? leaseStart : today.withDayOfMonth(1);
        }
        if (dueFrom.isAfter(today)) return BigDecimal.ZERO;
        long monthsDue = Math.max(0, ChronoUnit.MONTHS.between(dueFrom.withDayOfMonth(1), today.withDayOfMonth(1)) + 1);
        return monthlyRent.multiply(BigDecimal.valueOf(monthsDue));
    }

    @Override
    public ValidationResult validate(Map<String, Object> customFields) {
        Map<String, String> errors = new HashMap<>();
        // A rent payment names a room (the older form) or a property (the rent screen, which sends the property's id
        // and name, and no tenant when the property has none on record): finding P1B1-02.
        boolean property = text(customFields.get("propertyId")) != null || text(customFields.get("propertyName")) != null;
        if (!property && text(customFields.get("roomNo")) == null) errors.put("roomNo", "Room number or property is required");
        if (!property && text(customFields.get("tenantName")) == null) errors.put("tenantName", "Tenant name is required");
        BigDecimal monthlyRent = getBigDecimal(customFields, "monthlyRent");
        if (monthlyRent == null || monthlyRent.compareTo(BigDecimal.ZERO) <= 0) {
            errors.put("monthlyRent", "Monthly rent must be greater than 0");
        }
        return errors.isEmpty() ? ValidationResult.valid() : ValidationResult.invalid(errors);
    }

    @Override
    public String getSummary(Transaction transaction, Map<String, Object> customFields) {
        String roomNo = text(customFields.get("roomNo"));
        String propertyName = text(customFields.get("propertyName"));
        String tenantName = text(customFields.get("tenantName"));
        Integer monthsPaid = getInteger(customFields, "monthsPaid");
        String months = monthsPaid != null && monthsPaid > 1 ? monthsPaid + " महिना" : "१ महिना";
        // The rent screen names a property, not a room number.
        String place = roomNo != null ? "कोठा " + roomNo : (propertyName != null ? propertyName : "कोठा ?");
        return String.format("%s - %s: %s भाडा रु %.2f",
                place,
                tenantName != null ? tenantName : "भाडावाल",
                months,
                transaction.getAmount() != null ? transaction.getAmount() : BigDecimal.ZERO);
    }

    /** The text if it is a non-blank string, otherwise null (a number or a list where a name belongs is just "not given"). */
    private static String text(Object value) {
        return value instanceof String string && !string.isBlank() ? string : null;
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

    private LocalDate getLocalDate(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) return null;
        if (value instanceof LocalDate ld) return ld;
        if (value instanceof String str) { try { return LocalDate.parse(str); } catch (Exception e) { return null; } }
        return null;
    }
}

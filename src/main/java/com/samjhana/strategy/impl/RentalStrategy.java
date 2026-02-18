package com.samjhana.strategy.impl;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.strategy.BusinessCalculationStrategy;
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
        String roomNo = (String) customFields.get("roomNo");
        if (roomNo == null || roomNo.isBlank()) errors.put("roomNo", "Room number is required");
        String tenantName = (String) customFields.get("tenantName");
        if (tenantName == null || tenantName.isBlank()) errors.put("tenantName", "Tenant name is required");
        BigDecimal monthlyRent = getBigDecimal(customFields, "monthlyRent");
        if (monthlyRent == null || monthlyRent.compareTo(BigDecimal.ZERO) <= 0) {
            errors.put("monthlyRent", "Monthly rent must be greater than 0");
        }
        return errors.isEmpty() ? ValidationResult.valid() : ValidationResult.invalid(errors);
    }

    @Override
    public String getSummary(Transaction transaction, Map<String, Object> customFields) {
        String roomNo = (String) customFields.get("roomNo");
        String tenantName = (String) customFields.get("tenantName");
        Integer monthsPaid = getInteger(customFields, "monthsPaid");
        String months = monthsPaid != null && monthsPaid > 1 ? monthsPaid + " महिना" : "१ महिना";
        return String.format("कोठा %s - %s: %s भाडा रु %.2f",
                roomNo != null ? roomNo : "?",
                tenantName != null ? tenantName : "भाडावाल",
                months,
                transaction.getAmount() != null ? transaction.getAmount() : BigDecimal.ZERO);
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

    private LocalDate getLocalDate(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) return null;
        if (value instanceof LocalDate ld) return ld;
        if (value instanceof String str) { try { return LocalDate.parse(str); } catch (Exception e) { return null; } }
        return null;
    }
}

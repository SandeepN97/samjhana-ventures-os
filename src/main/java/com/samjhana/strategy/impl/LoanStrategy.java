package com.samjhana.strategy.impl;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.strategy.BusinessCalculationStrategy;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

@Component
public class LoanStrategy implements BusinessCalculationStrategy {

    @Override
    public String getBusinessCode() {
        return BusinessUnit.CODE_LOAN;
    }

    @Override
    public BigDecimal calculateAmount(Map<String, Object> customFields) {
        BigDecimal paymentAmount = getBigDecimal(customFields, "paymentAmount");
        if (paymentAmount != null) return paymentAmount;
        return getBigDecimal(customFields, "principal");
    }

    @Override
    public BigDecimal calculateProfit(Map<String, Object> customFields) {
        return calculateAccruedInterest(customFields);
    }

    public BigDecimal calculateAccruedInterest(Map<String, Object> customFields) {
        BigDecimal principal = getBigDecimal(customFields, "principal");
        BigDecimal annualRate = getBigDecimal(customFields, "interestRate");
        if (principal == null || annualRate == null) return BigDecimal.ZERO;
        LocalDate startDate = getLocalDate(customFields, "startDate");
        LocalDate calcDate = getLocalDate(customFields, "calculationDate");
        if (startDate == null) return BigDecimal.ZERO;
        if (calcDate == null) calcDate = LocalDate.now();
        long days = Math.max(0, ChronoUnit.DAYS.between(startDate, calcDate));
        BigDecimal rateDecimal = annualRate.divide(new BigDecimal("100"), 10, RoundingMode.HALF_UP);
        BigDecimal dailyRate = rateDecimal.divide(new BigDecimal("365"), 10, RoundingMode.HALF_UP);
        return principal.multiply(dailyRate).multiply(BigDecimal.valueOf(days)).setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal calculateRemainingBalance(Map<String, Object> customFields) {
        BigDecimal principal = getBigDecimal(customFields, "principal");
        BigDecimal totalPayments = getBigDecimal(customFields, "totalPayments");
        BigDecimal accruedInterest = calculateAccruedInterest(customFields);
        if (principal == null) return BigDecimal.ZERO;
        BigDecimal payments = totalPayments != null ? totalPayments : BigDecimal.ZERO;
        return principal.add(accruedInterest).subtract(payments);
    }

    @Override
    public ValidationResult validate(Map<String, Object> customFields) {
        Map<String, String> errors = new HashMap<>();
        BigDecimal principal = getBigDecimal(customFields, "principal");
        if (principal == null || principal.compareTo(BigDecimal.ZERO) <= 0) {
            errors.put("principal", "Principal amount must be greater than 0");
        }
        BigDecimal interestRate = getBigDecimal(customFields, "interestRate");
        if (interestRate == null || interestRate.compareTo(BigDecimal.ZERO) < 0) {
            errors.put("interestRate", "Interest rate cannot be negative");
        }
        if (interestRate != null && interestRate.compareTo(new BigDecimal("50")) > 0) {
            errors.put("interestRate", "Interest rate seems too high (>50%)");
        }
        LocalDate startDate = getLocalDate(customFields, "startDate");
        if (startDate == null) errors.put("startDate", "Loan start date is required");
        String borrowerName = (String) customFields.get("borrowerName");
        if (borrowerName == null || borrowerName.isBlank()) errors.put("borrowerName", "Borrower name is required");
        return errors.isEmpty() ? ValidationResult.valid() : ValidationResult.invalid(errors);
    }

    @Override
    public String getSummary(Transaction transaction, Map<String, Object> customFields) {
        String borrowerName = (String) customFields.get("borrowerName");
        BigDecimal principal = getBigDecimal(customFields, "principal");
        BigDecimal interestRate = getBigDecimal(customFields, "interestRate");
        BigDecimal remainingBalance = calculateRemainingBalance(customFields);
        if (transaction.getTransactionType().name().equals("PAYMENT")) {
            return String.format("%s को भुक्तानी: रु %.2f | बाँकी: रु %.2f",
                    borrowerName != null ? borrowerName : "ऋणी",
                    transaction.getAmount() != null ? transaction.getAmount() : BigDecimal.ZERO,
                    remainingBalance);
        }
        return String.format("%s: ऋण रु %.2f @ %.2f%% | बाँकी: रु %.2f",
                borrowerName != null ? borrowerName : "ऋणी",
                principal != null ? principal : BigDecimal.ZERO,
                interestRate != null ? interestRate : BigDecimal.ZERO,
                remainingBalance);
    }

    private BigDecimal getBigDecimal(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) return null;
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number num) return BigDecimal.valueOf(num.doubleValue());
        if (value instanceof String str) { try { return new BigDecimal(str); } catch (NumberFormatException e) { return null; } }
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

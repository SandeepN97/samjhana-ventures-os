package com.samjhana.strategy;

import com.samjhana.entity.Transaction;

import java.math.BigDecimal;
import java.util.Map;

/**
 * BusinessCalculationStrategy - Strategy interface for business-specific calculations.
 *
 * Each business type (Petrol, EV, Rental, Loan, Furniture) has its own
 * calculation strategy implementing this interface.
 */
public interface BusinessCalculationStrategy {

    String getBusinessCode();

    BigDecimal calculateAmount(Map<String, Object> customFields);

    BigDecimal calculateProfit(Map<String, Object> customFields);

    ValidationResult validate(Map<String, Object> customFields);

    String getSummary(Transaction transaction, Map<String, Object> customFields);

    default ReconciliationResult reconcile(Map<String, Object> customFields,
                                           Map<String, Object> previousState) {
        return ReconciliationResult.notApplicable();
    }

    record ValidationResult(boolean isValid, Map<String, String> errors) {
        public static ValidationResult valid() {
            return new ValidationResult(true, Map.of());
        }

        public static ValidationResult invalid(Map<String, String> errors) {
            return new ValidationResult(false, errors);
        }

        public static ValidationResult invalid(String field, String message) {
            return new ValidationResult(false, Map.of(field, message));
        }
    }

    record ReconciliationResult(
            boolean isApplicable,
            BigDecimal expected,
            BigDecimal actual,
            BigDecimal variance,
            String message
    ) {
        public static ReconciliationResult notApplicable() {
            return new ReconciliationResult(false, null, null, null, null);
        }

        public boolean hasVariance() {
            return isApplicable && variance != null && variance.abs().compareTo(BigDecimal.ZERO) > 0;
        }
    }
}

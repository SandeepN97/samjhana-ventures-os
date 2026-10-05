package com.samjhana.strategy.impl;

import com.samjhana.strategy.BusinessCalculationStrategy.ValidationResult;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LoanStrategyLoanTypeTest {

    private final LoanStrategy strategy = new LoanStrategy();

    private static Map<String, Object> fields(Object... pairs) {
        Map<String, Object> map = new HashMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put((String) pairs[i], pairs[i + 1]);
        return map;
    }

    @Test
    void shouldAcceptANewLoanAsTheLoansScreenSendsIt() {
        ValidationResult result = strategy.validate(fields("loanType", "NEW_LOAN", "bankName", "NIC Asia",
                "loanAmount", 500000, "interestRate", null));
        assertThat(result.isValid()).isTrue();
    }

    @Test
    void shouldRefuseANewLoanWithoutBankNameOrAmount() {
        ValidationResult result = strategy.validate(fields("loanType", "NEW_LOAN", "bankName", " ", "loanAmount", 0));
        assertThat(result.isValid()).isFalse();
        assertThat(result.errors()).containsKeys("bankName", "loanAmount");
    }

    @Test
    void shouldRefuseANewLoanWithAnImpossibleInterestRate() {
        assertThat(strategy.validate(fields("loanType", "NEW_LOAN", "bankName", "B", "loanAmount", 10, "interestRate", 80)).isValid()).isFalse();
        assertThat(strategy.validate(fields("loanType", "NEW_LOAN", "bankName", "B", "loanAmount", 10, "interestRate", -1)).isValid()).isFalse();
    }

    @Test
    void shouldAcceptAPaymentWithALoanAndPrincipal() {
        assertThat(strategy.validate(fields("loanType", "PAYMENT", "loanId", "abc",
                "principalAmount", 20000, "interestAmount", 0)).isValid()).isTrue();
    }

    @Test
    void shouldRefusePaymentsMissingTheLoanOrPrincipalOrWithNegativeInterest() {
        ValidationResult result = strategy.validate(fields("loanType", "PAYMENT", "principalAmount", 0, "interestAmount", -5));
        assertThat(result.isValid()).isFalse();
        assertThat(result.errors()).containsKeys("loanId", "principalAmount", "interestAmount");
    }

    @Test
    void shouldKeepTheOriginalRulesForEntriesWithoutALoanType() {
        assertThat(strategy.validate(fields("principal", 1000, "interestRate", 10,
                "startDate", "2026-01-01", "borrowerName", "Ram")).isValid()).isTrue();
        assertThat(strategy.validate(fields("principal", 1000)).isValid()).isFalse();
    }
}

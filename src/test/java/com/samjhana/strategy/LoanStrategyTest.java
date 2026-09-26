package com.samjhana.strategy;

import com.samjhana.entity.Transaction;
import com.samjhana.strategy.impl.LoanStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LoanStrategyTest {

    private LoanStrategy strategy;

    @BeforeEach
    void setUp() {
        strategy = new LoanStrategy();
    }

    @Test
    void shouldReturnCorrectBusinessCode() {
        assertThat(strategy.getBusinessCode()).isEqualTo("loan");
    }

    @Test
    void shouldCalculateAmount_asPaymentAmount_whenPresent() {
        Map<String, Object> fields = Map.of("paymentAmount", new BigDecimal("5000"), "principal", new BigDecimal("100000"));
        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo(new BigDecimal("5000"));
    }

    @Test
    void shouldFallBackToPrincipal_whenPaymentAmountMissing() {
        Map<String, Object> fields = Map.of("principal", new BigDecimal("100000"));
        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo(new BigDecimal("100000"));
    }

    @Test
    void shouldReturnNullAmount_whenBothMissing() {
        assertThat(strategy.calculateAmount(Map.of())).isNull();
    }

    @Test
    void shouldCalculateAccruedInterest_forAFullYear() {
        Map<String, Object> fields = Map.of(
                "principal", new BigDecimal("100000"),
                "interestRate", new BigDecimal("12"),
                "startDate", LocalDate.of(2025, 1, 1),
                "calculationDate", LocalDate.of(2026, 1, 1));
        // 365 days at 12%/yr simple daily interest ~= principal * 12% (one full year)
        assertThat(strategy.calculateAccruedInterest(fields)).isCloseTo(new BigDecimal("12000.00"), within(new BigDecimal("1")));
    }

    @Test
    void shouldReturnZeroInterest_whenPrincipalMissing() {
        Map<String, Object> fields = Map.of("interestRate", new BigDecimal("12"), "startDate", LocalDate.now());
        assertThat(strategy.calculateAccruedInterest(fields)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldReturnZeroInterest_whenRateMissing() {
        Map<String, Object> fields = Map.of("principal", new BigDecimal("100000"), "startDate", LocalDate.now());
        assertThat(strategy.calculateAccruedInterest(fields)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldReturnZeroInterest_whenStartDateMissing() {
        Map<String, Object> fields = Map.of("principal", new BigDecimal("100000"), "interestRate", new BigDecimal("12"));
        assertThat(strategy.calculateAccruedInterest(fields)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldDefaultCalculationDate_toTodayWhenMissing() {
        Map<String, Object> fields = Map.of(
                "principal", new BigDecimal("100000"),
                "interestRate", new BigDecimal("12"),
                "startDate", LocalDate.now().minusDays(10));
        assertThat(strategy.calculateAccruedInterest(fields)).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    void shouldCalculateRemainingBalance_subtractingPayments() {
        Map<String, Object> fields = Map.of(
                "principal", new BigDecimal("100000"),
                "totalPayments", new BigDecimal("20000"));
        assertThat(strategy.calculateRemainingBalance(fields)).isEqualByComparingTo(new BigDecimal("80000.00"));
    }

    @Test
    void shouldTreatMissingTotalPayments_asZero() {
        Map<String, Object> fields = Map.of("principal", new BigDecimal("100000"));
        assertThat(strategy.calculateRemainingBalance(fields)).isEqualByComparingTo(new BigDecimal("100000.00"));
    }

    @Test
    void shouldReturnZeroBalance_whenPrincipalMissing() {
        assertThat(strategy.calculateRemainingBalance(Map.of())).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldPassValidation_whenAllFieldsValid() {
        Map<String, Object> fields = Map.of(
                "principal", new BigDecimal("50000"),
                "interestRate", new BigDecimal("10"),
                "startDate", LocalDate.now(),
                "borrowerName", "Ram Sharma");
        assertThat(strategy.validate(fields).isValid()).isTrue();
    }

    @Test
    void shouldFailValidation_whenPrincipalZeroOrMissing() {
        assertThat(strategy.validate(Map.of()).errors()).containsKey("principal");
        Map<String, Object> zero = Map.of("principal", BigDecimal.ZERO);
        assertThat(strategy.validate(zero).errors()).containsKey("principal");
    }

    @Test
    void shouldFailValidation_whenInterestRateNegative() {
        Map<String, Object> fields = Map.of("principal", new BigDecimal("1000"), "interestRate", new BigDecimal("-1"));
        assertThat(strategy.validate(fields).errors()).containsKey("interestRate");
    }

    @Test
    void shouldFailValidation_whenInterestRateImplausiblyHigh() {
        Map<String, Object> fields = Map.of("principal", new BigDecimal("1000"), "interestRate", new BigDecimal("75"));
        assertThat(strategy.validate(fields).errors()).containsKey("interestRate");
    }

    @Test
    void shouldFailValidation_whenStartDateMissing() {
        Map<String, Object> fields = Map.of("principal", new BigDecimal("1000"), "interestRate", new BigDecimal("10"));
        assertThat(strategy.validate(fields).errors()).containsKey("startDate");
    }

    @Test
    void shouldFailValidation_whenBorrowerNameBlank() {
        Map<String, Object> fields = Map.of(
                "principal", new BigDecimal("1000"), "interestRate", new BigDecimal("10"),
                "startDate", LocalDate.now(), "borrowerName", "");
        assertThat(strategy.validate(fields).errors()).containsKey("borrowerName");
    }

    @Test
    void shouldSummarisePayment_whenTransactionTypeIsPayment() {
        Transaction transaction = Transaction.builder()
                .amount(new BigDecimal("5000"))
                .transactionType(Transaction.TransactionType.PAYMENT)
                .build();
        Map<String, Object> fields = Map.of("borrowerName", "Ram", "principal", new BigDecimal("100000"));
        assertThat(strategy.getSummary(transaction, fields)).contains("Ram").contains("भुक्तानी");
    }

    @Test
    void shouldSummariseDisbursement_whenTransactionTypeIsNotPayment() {
        Transaction transaction = Transaction.builder()
                .amount(new BigDecimal("100000"))
                .transactionType(Transaction.TransactionType.DISBURSEMENT)
                .build();
        Map<String, Object> fields = Map.of("borrowerName", "Sita", "principal", new BigDecimal("100000"), "interestRate", new BigDecimal("10"));
        assertThat(strategy.getSummary(transaction, fields)).contains("Sita").contains("ऋण");
    }

    @Test
    void shouldDefaultBorrowerName_whenMissingFromSummary() {
        Transaction transaction = Transaction.builder()
                .amount(BigDecimal.ZERO)
                .transactionType(Transaction.TransactionType.DISBURSEMENT)
                .build();
        assertThat(strategy.getSummary(transaction, Map.of())).contains("ऋणी");
    }

    @Test
    void shouldParseStringTypedDatesAndAmounts() {
        Map<String, Object> fields = Map.of(
                "principal", "50000",
                "interestRate", "10",
                "startDate", "2025-01-01");
        assertThat(strategy.calculateAccruedInterest(fields)).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    void shouldTreatUnparsableDateString_asMissing() {
        Map<String, Object> fields = Map.of(
                "principal", new BigDecimal("50000"), "interestRate", new BigDecimal("10"), "startDate", "not-a-date");
        assertThat(strategy.calculateAccruedInterest(fields)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    private static org.assertj.core.data.Offset<BigDecimal> within(BigDecimal delta) {
        return org.assertj.core.data.Offset.offset(delta);
    }
}

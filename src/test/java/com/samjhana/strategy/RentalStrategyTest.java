package com.samjhana.strategy;

import com.samjhana.entity.Transaction;
import com.samjhana.strategy.impl.RentalStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RentalStrategyTest {

    private RentalStrategy strategy;

    @BeforeEach
    void setUp() {
        strategy = new RentalStrategy();
    }

    @Test
    void shouldReturnCorrectBusinessCode() {
        assertThat(strategy.getBusinessCode()).isEqualTo("rental");
    }

    @Test
    void shouldCalculateAmount_multiplyingRentByMonthsPaid() {
        Map<String, Object> fields = Map.of("monthlyRent", new BigDecimal("15000"), "monthsPaid", 3);
        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo(new BigDecimal("45000"));
    }

    @Test
    void shouldReturnRentAlone_whenMonthsPaidMissing() {
        Map<String, Object> fields = Map.of("monthlyRent", new BigDecimal("15000"));
        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo(new BigDecimal("15000"));
    }

    @Test
    void shouldReturnZero_whenMonthlyRentMissing() {
        assertThat(strategy.calculateAmount(Map.of("monthsPaid", 2))).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldCalculateProfit_subtractingMaintenance() {
        Map<String, Object> fields = Map.of("monthlyRent", new BigDecimal("15000"), "maintenanceCost", new BigDecimal("2000"));
        assertThat(strategy.calculateProfit(fields)).isEqualByComparingTo(new BigDecimal("13000"));
    }

    @Test
    void shouldReturnFullAmountAsProfit_whenNoMaintenanceCost() {
        Map<String, Object> fields = Map.of("monthlyRent", new BigDecimal("15000"));
        assertThat(strategy.calculateProfit(fields)).isEqualByComparingTo(new BigDecimal("15000"));
    }

    @Test
    void shouldReturnZeroDue_whenMonthlyRentMissing() {
        assertThat(strategy.calculateDueAmount(Map.of())).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldOweAtLeastOneMonth_whenPaidUntilLastMonth() {
        Map<String, Object> fields = Map.of(
                "monthlyRent", new BigDecimal("10000"),
                "paidUntil", LocalDate.now().minusMonths(1));
        assertThat(strategy.calculateDueAmount(fields)).isGreaterThanOrEqualTo(new BigDecimal("10000"));
    }

    @Test
    void shouldOweNothing_whenPaidUntilFarInTheFuture() {
        Map<String, Object> fields = Map.of(
                "monthlyRent", new BigDecimal("10000"),
                "paidUntil", LocalDate.now().plusYears(1));
        assertThat(strategy.calculateDueAmount(fields)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldFallBackToLeaseStartDate_whenPaidUntilMissing() {
        Map<String, Object> fields = Map.of(
                "monthlyRent", new BigDecimal("10000"),
                "leaseStartDate", LocalDate.now().minusMonths(2));
        assertThat(strategy.calculateDueAmount(fields)).isGreaterThanOrEqualTo(new BigDecimal("20000"));
    }

    @Test
    void shouldDefaultToStartOfCurrentMonth_whenNeitherPaidUntilNorLeaseStartGiven() {
        Map<String, Object> fields = Map.of("monthlyRent", new BigDecimal("10000"));
        assertThat(strategy.calculateDueAmount(fields)).isEqualByComparingTo(new BigDecimal("10000"));
    }

    @Test
    void shouldPassValidation_whenAllFieldsValid() {
        Map<String, Object> fields = Map.of(
                "roomNo", "A-101", "tenantName", "Hari Bahadur", "monthlyRent", new BigDecimal("12000"));
        assertThat(strategy.validate(fields).isValid()).isTrue();
    }

    @Test
    void shouldFailValidation_whenRoomNoBlank() {
        Map<String, Object> fields = Map.of("tenantName", "Hari", "monthlyRent", new BigDecimal("12000"));
        assertThat(strategy.validate(fields).errors()).containsKey("roomNo");
    }

    @Test
    void shouldFailValidation_whenTenantNameBlank() {
        Map<String, Object> fields = Map.of("roomNo", "A-101", "monthlyRent", new BigDecimal("12000"));
        assertThat(strategy.validate(fields).errors()).containsKey("tenantName");
    }

    @Test
    void shouldFailValidation_whenMonthlyRentZeroOrMissing() {
        assertThat(strategy.validate(Map.of("roomNo", "A-101", "tenantName", "Hari")).errors()).containsKey("monthlyRent");
        Map<String, Object> zero = Map.of("roomNo", "A-101", "tenantName", "Hari", "monthlyRent", BigDecimal.ZERO);
        assertThat(strategy.validate(zero).errors()).containsKey("monthlyRent");
    }

    @Test
    void shouldSummariseWithMonthsPaidPluralised() {
        Transaction transaction = Transaction.builder().amount(new BigDecimal("30000")).build();
        Map<String, Object> fields = Map.of("roomNo", "A-101", "tenantName", "Hari", "monthsPaid", 3);
        assertThat(strategy.getSummary(transaction, fields)).contains("A-101").contains("Hari").contains("3 महिना");
    }

    @Test
    void shouldSummariseSingleMonth_whenMonthsPaidMissingOrOne() {
        Transaction transaction = Transaction.builder().amount(new BigDecimal("10000")).build();
        assertThat(strategy.getSummary(transaction, Map.of())).contains("१ महिना").contains("?").contains("भाडावाल");
    }
}

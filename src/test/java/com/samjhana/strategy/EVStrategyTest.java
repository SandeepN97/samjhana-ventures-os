package com.samjhana.strategy;

import com.samjhana.entity.Transaction;
import com.samjhana.strategy.impl.EVStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class EVStrategyTest {

    private EVStrategy strategy;

    @BeforeEach
    void setUp() {
        strategy = new EVStrategy();
    }

    @Test
    void shouldReturnCorrectBusinessCode() {
        assertThat(strategy.getBusinessCode()).isEqualTo("ev");
    }

    @Test
    void shouldCalculateAmount_fromMeterReadings() {
        Map<String, Object> fields = Map.of(
            "openingMeter", 15000,
            "closingMeter", 15200,
            "unitRate", 13.50
        );
        BigDecimal amount = strategy.calculateAmount(fields);
        assertThat(amount).isEqualByComparingTo(new BigDecimal("2700.00"));
    }

    @Test
    void shouldFailValidation_whenClosingLessThanOpening() {
        Map<String, Object> fields = Map.of(
            "openingMeter", 15200,
            "closingMeter", 15000,
            "unitRate", 13.50
        );
        BusinessCalculationStrategy.ValidationResult result = strategy.validate(fields);
        assertThat(result.isValid()).isFalse();
    }

    // ------------------------------------------------------------------ OCPP live sessions

    /** A closed, paid live session as ChargeSessionService books it. */
    private Map<String, Object> ocppSession() {
        Map<String, Object> fields = new HashMap<>();
        fields.put("chargingMode", "OCPP_SESSION");
        fields.put("chargeSessionId", "5b1c0f3e-0000-4000-8000-000000000001");
        fields.put("chargePointCode", "HD-D180-CC-01");
        fields.put("plateNumber", "BA1PA4521");
        fields.put("energyDeliveredKwh", new BigDecimal("7.500"));
        fields.put("amountPaid", new BigDecimal("600"));
        return fields;
    }

    @Test
    void shouldUseTheAmountPaid_forALiveSession() {
        assertThat(strategy.calculateAmount(ocppSession())).isEqualByComparingTo("600.00");
    }

    @Test
    void shouldRoundThePaidAmountToTwoDecimals_forALiveSession() {
        Map<String, Object> fields = ocppSession();
        fields.put("amountPaid", new BigDecimal("112.505"));

        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo("112.51");
    }

    @Test
    void shouldReturnZero_whenALiveSessionHasNoPaidAmount() {
        Map<String, Object> fields = ocppSession();
        fields.remove("amountPaid");

        assertThat(strategy.calculateAmount(fields)).isEqualByComparingTo("0");
    }

    @Test
    void shouldNotEstimateProfitPerSession_forALiveSession() {
        // Profit for live sessions comes from the NEA bill for the billing period, not a per-session guess.
        assertThat(strategy.calculateProfit(ocppSession())).isNull();
    }

    @Test
    void shouldAcceptAValidLiveSession() {
        assertThat(strategy.validate(ocppSession()).isValid()).isTrue();
    }

    @Test
    void shouldAcceptAZeroEnergySession_whenTheChargerNeverDeliveredPower() {
        Map<String, Object> fields = ocppSession();
        fields.put("energyDeliveredKwh", BigDecimal.ZERO);

        assertThat(strategy.validate(fields).isValid()).isTrue();
    }

    @Test
    void shouldRejectALiveSession_withoutTheSessionId() {
        Map<String, Object> fields = ocppSession();
        fields.remove("chargeSessionId");

        BusinessCalculationStrategy.ValidationResult result = strategy.validate(fields);

        assertThat(result.isValid()).isFalse();
        assertThat(result.errors()).containsKey("chargeSessionId");
    }

    @Test
    void shouldRejectALiveSession_withNegativeOrMissingEnergy() {
        Map<String, Object> negative = ocppSession();
        negative.put("energyDeliveredKwh", new BigDecimal("-1"));
        Map<String, Object> missing = ocppSession();
        missing.remove("energyDeliveredKwh");

        assertThat(strategy.validate(negative).errors()).containsKey("energyDeliveredKwh");
        assertThat(strategy.validate(missing).errors()).containsKey("energyDeliveredKwh");
    }

    @Test
    void shouldRejectALiveSession_whenNothingWasPaid() {
        Map<String, Object> zero = ocppSession();
        zero.put("amountPaid", BigDecimal.ZERO);
        Map<String, Object> absent = ocppSession();
        absent.remove("amountPaid");

        assertThat(strategy.validate(zero).errors()).containsKey("amountPaid");
        assertThat(strategy.validate(absent).errors()).containsKey("amountPaid");
    }

    @Test
    void shouldReportAllProblemsAtOnce_whenALiveSessionIsBadlyFormed() {
        BusinessCalculationStrategy.ValidationResult result = strategy.validate(
                new HashMap<>(Map.of("chargingMode", "OCPP_SESSION")));

        assertThat(result.errors()).containsOnlyKeys("chargeSessionId", "energyDeliveredKwh", "amountPaid");
    }

    @Test
    void shouldSummariseALiveSession_withPlateChargerAndEnergy() {
        Transaction transaction = Transaction.builder().amount(new BigDecimal("600")).build();

        String summary = strategy.getSummary(transaction, ocppSession());

        assertThat(summary).contains("BA1PA4521").contains("HD-D180-CC-01").contains("7.500").contains("600.00");
    }

    @Test
    void shouldFallBackGracefully_whenTheSummaryLacksPlateAndCharger() {
        Map<String, Object> fields = ocppSession();
        fields.remove("plateNumber");
        fields.remove("chargePointCode");

        assertThat(strategy.getSummary(Transaction.builder().amount(new BigDecimal("600")).build(), fields))
                .startsWith("EV");
    }

    @Test
    void shouldNotReconcileALiveSessionAgainstAMeterBill() {
        BusinessCalculationStrategy.ReconciliationResult result = strategy.reconcile(ocppSession(), Map.of());

        assertThat(result.isApplicable()).isFalse();
    }
}

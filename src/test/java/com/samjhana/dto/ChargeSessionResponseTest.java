package com.samjhana.dto;

import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.ChargeSession;
import com.samjhana.entity.EvCustomerVehicle;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ChargeSessionResponseTest {

    private ChargeSession session(Integer startSoc, Integer currentSoc, String ratePerPercent) {
        return ChargeSession.builder()
                .id(UUID.randomUUID())
                .chargePoint(ChargePoint.builder().id(UUID.randomUUID()).code("HD-D180-CC-01").model("HD-D180-CC").build())
                .vehicle(EvCustomerVehicle.builder().id(UUID.randomUUID()).plateNumber("BA1PA4521").build())
                .connectorId(1).targetPercent(80)
                .startSoc(startSoc).currentSoc(currentSoc)
                .energyDeliveredKwh(new BigDecimal("6.000"))
                .ratePerPercent(ratePerPercent == null ? null : new BigDecimal(ratePerPercent))
                .status(ChargeSession.Status.ACTIVE)
                .requestedAt(LocalDateTime.now())
                .build();
    }

    @Test
    void shouldBillByVehiclePriceTimesPercentCharged() {
        // DFAC EV 32 is Rs 14 per 1%; 32% -> 50% is 18% charged.
        ChargeSessionResponse response = ChargeSessionResponse.from(session(32, 50, "14"));

        assertEquals(18, response.getPercentCharged());
        assertEquals(0, new BigDecimal("252.00").compareTo(response.getSuggestedAmount()));
        assertEquals(0, new BigDecimal("14").compareTo(response.getRatePerPercent()));
    }

    @Test
    void shouldKeepTwoDecimals_whenThePriceHasPaisa() {
        ChargeSessionResponse response = ChargeSessionResponse.from(session(20, 25, "9.75"));

        assertEquals(0, new BigDecimal("48.75").compareTo(response.getSuggestedAmount()));
    }

    @Test
    void shouldSuggestZero_whenNothingHasBeenChargedYet() {
        ChargeSessionResponse response = ChargeSessionResponse.from(session(40, 40, "14"));

        assertEquals(0, response.getPercentCharged());
        assertEquals(0, BigDecimal.ZERO.compareTo(response.getSuggestedAmount()));
    }

    @Test
    void shouldNeverGoNegative_whenTheChargerReportsALowerPercentThanItStartedAt() {
        ChargeSessionResponse response = ChargeSessionResponse.from(session(50, 45, "14"));

        assertEquals(0, response.getPercentCharged());
        assertEquals(0, BigDecimal.ZERO.compareTo(response.getSuggestedAmount()));
    }

    @Test
    void shouldNotSuggestAnAmount_whenNoVehicleTypeWasChosen() {
        ChargeSessionResponse response = ChargeSessionResponse.from(session(32, 50, null));

        assertEquals(18, response.getPercentCharged()); // still known, just not priced
        assertNull(response.getSuggestedAmount());
        assertNull(response.getRatePerPercent());
    }

    @Test
    void shouldNotSuggestAnAmount_whenTheChargerHasNotReportedStateOfCharge() {
        ChargeSessionResponse withoutStart = ChargeSessionResponse.from(session(null, 50, "14"));
        ChargeSessionResponse withoutCurrent = ChargeSessionResponse.from(session(32, null, "14"));

        assertNull(withoutStart.getPercentCharged());
        assertNull(withoutStart.getSuggestedAmount());
        assertNull(withoutCurrent.getPercentCharged());
        assertNull(withoutCurrent.getSuggestedAmount());
    }

    @Test
    void shouldNotExposePhotoUrl_whenVehicleHasNoPhoto() {
        assertNull(ChargeSessionResponse.from(session(32, 50, "14")).getPlatePhotoUrl());
    }
}

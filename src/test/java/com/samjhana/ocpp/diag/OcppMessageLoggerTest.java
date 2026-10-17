package com.samjhana.ocpp.diag;

import ch.qos.logback.classic.Level;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.ChargePoint;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.repository.ChargeSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OcppMessageLoggerTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private ChargePointRepository chargePoints;
    private OcppMessageLogger logger;
    private OcppConnectionState state;

    @BeforeEach
    void setUp() {
        chargePoints = mock(ChargePointRepository.class);
        OcppLoggingProperties properties = new OcppLoggingProperties();
        RecordingAuditWriter writer = new RecordingAuditWriter(properties);
        LockEvidenceTracker evidence = new LockEvidenceTracker(writer, mock(ChargeSessionRepository.class), properties, mapper);
        logger = new OcppMessageLogger(properties, chargePoints, evidence, new JsonMasker(mapper));
        state = new OcppConnectionState("ws-1", "CP-1", "10.0.0.5", "ocpp2.0.1", Instant.now(), 30);
    }

    private JsonNode json(String text) throws Exception {
        return mapper.readTree(text);
    }

    // ---------------------------------------------------------------- Boot

    @Test
    void shouldLogEveryBootField_andWarnWhenSerialOrModelDiffer() throws Exception {
        when(chargePoints.findByCodeAndDeletedAtIsNull("CP-1")).thenReturn(Optional.of(
                ChargePoint.builder().code("CP-1").model("HD-D180").serialNumber("SN-OLD").build()));
        JsonNode boot = json("{\"reason\":\"PowerUp\",\"chargingStation\":{\"model\":\"HD-D180-X\",\"vendorName\":\"Hardhitter\","
                + "\"serialNumber\":\"SN-NEW\",\"firmwareVersion\":\"1.2.3\",\"modem\":{\"iccid\":\"8997\",\"imsi\":\"4701\"}}}");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.boot(state, boot);

            assertThat(capture.matching("BOOT reason=PowerUp vendor=Hardhitter model=HD-D180-X serial=SN-NEW firmware=1.2.3 "
                    + "modem.iccid=8997 modem.imsi=4701")).hasSize(1);
            assertThat(capture.matching("BOOT serial MISMATCH")).singleElement().asString().contains("SN-NEW").contains("SN-OLD");
            assertThat(capture.matching("BOOT model MISMATCH")).hasSize(1);
        }
    }

    @Test
    void shouldNotWarn_whenBootMatchesTheRow() throws Exception {
        when(chargePoints.findByCodeAndDeletedAtIsNull("CP-1")).thenReturn(Optional.of(
                ChargePoint.builder().code("CP-1").model("hd-d180").serialNumber("SN-1").build()));

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.boot(state, json("{\"reason\":\"PowerUp\",\"chargingStation\":{\"model\":\"HD-D180\",\"vendorName\":\"V\",\"serialNumber\":\"SN-1\"}}"));

            assertThat(capture.matching("MISMATCH")).isEmpty();
        }
    }

    // ---------------------------------------------------------------- Status

    @Test
    void shouldLogStatusWithEvseConnector_andEveryChangeOldToNew() throws Exception {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.status(state, json("{\"timestamp\":\"" + OffsetDateTime.now() + "\",\"connectorStatus\":\"Available\",\"evseId\":1,\"connectorId\":2}"));
            logger.status(state, json("{\"timestamp\":\"" + OffsetDateTime.now() + "\",\"connectorStatus\":\"Occupied\",\"evseId\":1,\"connectorId\":2}"));
            logger.status(state, json("{\"timestamp\":\"" + OffsetDateTime.now() + "\",\"connectorStatus\":\"Occupied\",\"evseId\":1,\"connectorId\":2}"));
            logger.status(state, json("{\"timestamp\":\"" + OffsetDateTime.now() + "\",\"connectorStatus\":\"Available\",\"evseId\":1,\"connectorId\":1}"));

            assertThat(capture.matching("STATUS evse=1 connector=2 connectorStatus=Available")).hasSize(1);
            assertThat(capture.matching("CONNECTOR STATUS CHANGE evse=1 connector=2: (first seen) -> Available")).hasSize(1);
            assertThat(capture.matching("CONNECTOR STATUS CHANGE evse=1 connector=2: Available -> Occupied")).hasSize(1);
            // The unchanged repeat produces no change line; connector 1 is tracked separately.
            assertThat(capture.matching("CONNECTOR STATUS CHANGE evse=1 connector=2: Occupied")).isEmpty();
            assertThat(capture.matching("CONNECTOR STATUS CHANGE evse=1 connector=1: (first seen) -> Available")).hasSize(1);
        }
    }

    // ---------------------------------------------------------------- TransactionEvent

    private String txEvent(String eventType, int seq, String meterValues) {
        return "{\"eventType\":\"" + eventType + "\",\"timestamp\":\"" + OffsetDateTime.now()
                + "\",\"triggerReason\":\"MeterValuePeriodic\",\"seqNo\":" + seq
                + ",\"evse\":{\"id\":1,\"connectorId\":2},\"transactionInfo\":{\"transactionId\":\"TX-1\",\"chargingState\":\"Charging\""
                + (eventType.equals("Ended") ? ",\"stoppedReason\":\"Local\"" : "") + "},"
                + "\"idToken\":{\"idToken\":\"BA1PA4521\",\"type\":\"Central\"}" + meterValues + "}";
    }

    @Test
    void shouldLogEveryTransactionEventFieldAndEverySampledValue_withMaskedToken() throws Exception {
        String meter = ",\"meterValue\":[{\"timestamp\":\"2026-10-15T10:00:00Z\",\"sampledValue\":["
                + "{\"value\":12345.6,\"measurand\":\"Energy.Active.Import.Register\",\"context\":\"Sample.Periodic\",\"location\":\"Outlet\",\"unitOfMeasure\":{\"unit\":\"Wh\"}},"
                + "{\"value\":57,\"measurand\":\"SoC\",\"location\":\"EV\",\"unitOfMeasure\":{\"unit\":\"Percent\"}},"
                + "{\"value\":16.5,\"measurand\":\"Current.Import\",\"phase\":\"L1\",\"unitOfMeasure\":{\"unit\":\"A\"}}]}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.transactionEvent(state, json(txEvent("Updated", 3, meter)));

            assertThat(capture.matching("TRANSACTION EVENT eventType=Updated triggerReason=MeterValuePeriodic transactionId=TX-1 "
                    + "seqNo=3 stoppedReason=null evse=1 connector=2 chargingState=Charging idToken=BA***21")).hasSize(1);
            assertThat(capture.anyContains("BA1PA4521")).isFalse();
            String meterLine = capture.matching("METER VALUE").get(0);
            assertThat(meterLine).contains("measurand=Energy.Active.Import.Register value=12345.6 unit=Wh context=Sample.Periodic location=Outlet phase=null")
                    .contains("measurand=SoC value=57 unit=Percent context=null location=EV phase=null")
                    .contains("measurand=Current.Import value=16.5 unit=A context=null location=null phase=L1");
            assertThat(capture.matching("SoC present=true value=57%")).hasSize(1);
            assertThat(capture.matching("SoC present=false")).isEmpty();
        }
    }

    @Test
    void shouldSayExplicitly_whenSoCIsAbsent() throws Exception {
        String withoutSoc = ",\"meterValue\":[{\"timestamp\":\"2026-10-15T10:00:00Z\",\"sampledValue\":["
                + "{\"value\":100,\"measurand\":\"Energy.Active.Import.Register\"}]}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.transactionEvent(state, json(txEvent("Updated", 4, withoutSoc)));
            logger.transactionEvent(state, json(txEvent("Updated", 5, "")));

            assertThat(capture.matching("SoC present=false (meterValue has no SoC sampledValue)")).hasSize(1);
            assertThat(capture.matching("SoC present=false (event has no meterValue)")).hasSize(1);
            assertThat(capture.matching("SoC present=true")).isEmpty();
        }
    }

    @Test
    void shouldFlagEnergyThatDecreasesOrResets() throws Exception {
        String low = ",\"meterValue\":[{\"sampledValue\":[{\"value\":4000,\"measurand\":\"Energy.Active.Import.Register\"}]}]";
        String lower = ",\"meterValue\":[{\"sampledValue\":[{\"value\":3500,\"measurand\":\"Energy.Active.Import.Register\"}]}]";
        String zero = ",\"meterValue\":[{\"sampledValue\":[{\"value\":0,\"measurand\":\"Energy.Active.Import.Register\"}]}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.transactionEvent(state, json(txEvent("Updated", 1, low)));
            logger.transactionEvent(state, json(txEvent("Updated", 2, lower)));
            logger.transactionEvent(state, json(txEvent("Updated", 3, zero)));

            assertThat(capture.matching("ENERGY DECREASED:")).singleElement().asString().contains("3500 Wh").contains("previous 4000 Wh");
            assertThat(capture.matching("ENERGY RESET to zero:")).hasSize(1);
            assertThat(capture.events("com.samjhana.ocpp.lifecycle", Level.WARN)).hasSize(2);
        }
    }

    @Test
    void shouldConvertKwhWhenComparingEnergy() throws Exception {
        String kwh = ",\"meterValue\":[{\"sampledValue\":[{\"value\":1.5,\"measurand\":\"Energy.Active.Import.Register\",\"unitOfMeasure\":{\"unit\":\"kWh\"}}]}]";
        String wh = ",\"meterValue\":[{\"sampledValue\":[{\"value\":1400,\"measurand\":\"Energy.Active.Import.Register\"}]}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.transactionEvent(state, json(txEvent("Updated", 1, kwh)));
            logger.transactionEvent(state, json(txEvent("Updated", 2, wh)));

            assertThat(capture.matching("ENERGY DECREASED")).singleElement().asString().contains("1400 Wh").contains("previous 1500 Wh");
        }
    }

    // ---- finding D-01: a charger-supplied number with an extreme exponent or multiplier is not logged or compared ----

    @Test
    void shouldWarnAndSkipEnergyThatIsNotAUsableNumber() throws Exception {
        String extreme = ",\"meterValue\":[{\"sampledValue\":[{\"value\":\"1e100000\",\"measurand\":\"Energy.Active.Import.Register\"}]}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.transactionEvent(state, json(txEvent("Updated", 1, extreme)));

            assertThat(capture.matching("is not a usable number")).hasSize(1);
            assertThat(capture.matching("ENERGY Energy.Active.Import.Register =")).isEmpty();
        }
    }

    @Test
    void shouldWarnAndSkipEnergyWithAnExtremeMultiplier() throws Exception {
        String extreme = ",\"meterValue\":[{\"sampledValue\":[{\"value\":5,\"measurand\":\"Energy.Active.Import.Register\","
                + "\"unitOfMeasure\":{\"unit\":\"Wh\",\"multiplier\":100000}}]}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.transactionEvent(state, json(txEvent("Updated", 1, extreme)));

            assertThat(capture.matching("ENERGY multiplier 100000 with value '5' is out of range")).hasSize(1);
            assertThat(capture.matching("ENERGY Energy.Active.Import.Register =")).isEmpty();
        }
    }

    @Test
    void shouldWarnAndSkipEnergyWhoseMultiplierIsTheLargestNegativeNumber() throws Exception {
        String extreme = ",\"meterValue\":[{\"sampledValue\":[{\"value\":5,\"measurand\":\"Energy.Active.Import.Register\","
                + "\"unitOfMeasure\":{\"unit\":\"Wh\",\"multiplier\":-2147483648}}]}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.transactionEvent(state, json(txEvent("Updated", 1, extreme)));

            assertThat(capture.matching("is out of range")).hasSize(1);
        }
    }

    @Test
    void shouldStillLogEnergyWithAnOrdinaryMultiplier() throws Exception {
        String ordinary = ",\"meterValue\":[{\"sampledValue\":[{\"value\":5,\"measurand\":\"Energy.Active.Import.Register\","
                + "\"unitOfMeasure\":{\"unit\":\"Wh\",\"multiplier\":3}}]}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.transactionEvent(state, json(txEvent("Updated", 1, ordinary)));

            assertThat(capture.matching("ENERGY Energy.Active.Import.Register =")).singleElement().asString().contains("5000 Wh");
        }
    }

    // ---------------------------------------------------------------- clock skew

    @Test
    void shouldWarnOnClockSkewAboveSixtySeconds_andOnlyInfoBelow() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.skew("CP-1", "TransactionEvent", OffsetDateTime.now().plusSeconds(5).toString());
            logger.skew("CP-1", "TransactionEvent", OffsetDateTime.now().minusSeconds(300).toString());
            logger.skew("CP-1", "TransactionEvent", "not a date");

            assertThat(capture.events("com.samjhana.ocpp.lifecycle", Level.INFO)).hasSize(1);
            assertThat(capture.matching("CLOCK SKEW -3")).singleElement().asString().contains("BEHIND");
            assertThat(capture.matching("cannot be computed")).hasSize(1);
        }
    }

    // ---------------------------------------------------------------- required fields, other actions, unread keys

    @Test
    void shouldWarnAboutMissingRequiredFields_withoutRejecting() throws Exception {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.checkRequired("CP-1", "BootNotification", json("{\"chargingStation\":{\"model\":\"M\"}}"));
            logger.checkRequired("CP-1", "TransactionEvent", json("{\"eventType\":\"Started\"}"));
            logger.checkRequired("CP-1", "Heartbeat", json("{}"));

            assertThat(capture.matching("MISSING REQUIRED FIELD(S) in BootNotification")).singleElement().asString()
                    .contains("/reason").contains("/chargingStation/vendorName").doesNotContain("/chargingStation/model");
            assertThat(capture.matching("MISSING REQUIRED FIELD(S) in TransactionEvent")).singleElement().asString()
                    .contains("/triggerReason").contains("/transactionInfo/transactionId");
            assertThat(capture.matching("in Heartbeat")).isEmpty();
        }
    }

    @Test
    void shouldLogOtherActionsWithPayload_unknownOnesAsWarn() throws Exception {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            logger.otherAction(state, "Authorize", json("{\"idToken\":{\"idToken\":\"BA1PA4521\",\"type\":\"Central\"}}"));
            logger.otherAction(state, "SecurityEventNotification", json("{\"type\":\"FirmwareUpdated\"}"));
            logger.otherAction(state, "VendorThing", json("{\"x\":1}"));

            assertThat(capture.matching("ACTION Authorize received but not implemented")).singleElement().asString()
                    .contains("BA***21").doesNotContain("BA1PA4521");
            assertThat(capture.matching("ACTION SecurityEventNotification received but not implemented")).hasSize(1);
            assertThat(capture.matching("UNKNOWN ACTION 'VendorThing'")).singleElement().asString().contains("{\"x\":1}");
            assertThat(capture.events("com.samjhana.ocpp.lifecycle", Level.WARN)).hasSize(1);
        }
    }

    @Test
    void shouldListUnreadVendorKeysAtDebug() throws Exception {
        JsonNode boot = json("{\"reason\":\"PowerUp\",\"chargingStation\":{\"model\":\"M\",\"vendorName\":\"V\",\"vendorBlob\":1},"
                + "\"customData\":{\"vendorId\":\"x\"}}");

        try (LogCapture capture = LogCapture.atEveryLevel().with(OcppLoggers.LIFECYCLE_NAME, Level.DEBUG)) {
            logger.logUnreadKeys("CP-1", "BootNotification", boot);

            assertThat(capture.matching("UNREAD KEYS in BootNotification")).singleElement().asString()
                    .contains("chargingStation.vendorBlob").contains("customData").doesNotContain("chargingStation.model");
        }
    }

    @Test
    void shouldStayQuietAboutUnreadKeys_atInfo() throws Exception {
        try (LogCapture capture = LogCapture.atConfiguredLevels().with("com.samjhana.ocpp.lifecycle", Level.INFO)) {
            logger.logUnreadKeys("CP-1", "BootNotification", json("{\"vendorBlob\":1}"));

            assertThat(capture.matching("UNREAD KEYS")).isEmpty();
        }
    }

    @Test
    void shouldLogHeartbeatAtDebug_withIntervalSincePrevious() {
        try (LogCapture capture = LogCapture.atEveryLevel().with(OcppLoggers.LIFECYCLE_NAME, Level.DEBUG)) {
            logger.heartbeat(state);
            logger.heartbeat(state);

            assertThat(capture.events("com.samjhana.ocpp.lifecycle", Level.DEBUG)).hasSize(2);
            assertThat(capture.matching("HEARTBEAT #")).hasSize(2);
            assertThat(state.lastHeartbeatAt()).isNotNull();
        }
    }
}

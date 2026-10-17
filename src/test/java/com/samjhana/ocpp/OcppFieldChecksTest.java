package com.samjhana.ocpp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Finding D-05: the few things a charger sends that the app stores (connector status, serial number, transaction id, the text
 * of an error) must fit what the database column holds and be something the standard allows. A value that does not fit is
 * answered with a standard error; it must never reach the database and fail there.
 */
class OcppFieldChecksTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode json(String text) throws Exception {
        return mapper.readTree(text);
    }

    private static OcppFieldChecks.Violation violationOf(Runnable check) {
        try {
            check.run();
        } catch (OcppFieldChecks.Violation violation) {
            return violation;
        }
        throw new AssertionError("expected the check to refuse the value");
    }

    // ---------------------------------------------------------------- connector status

    @ParameterizedTest
    @ValueSource(strings = {"Available", "Occupied", "Reserved", "Unavailable", "Faulted"})
    void shouldAcceptEachOfTheFiveStandardConnectorStatuses(String status) throws Exception {
        assertThat(OcppFieldChecks.requireConnectorStatus(json("{\"connectorStatus\":\"" + status + "\"}"))).isEqualTo(status);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Charging", "Preparing", "available", "AVAILABLE", " Available", "Available ", "", "Unknown", "Occupied\n"})
    void shouldRefuseAConnectorStatusThatIsNotOneOfTheFive_asAPropertyConstraintViolation(String status) throws Exception {
        JsonNode payload = mapper.createObjectNode().put("connectorStatus", status);

        OcppFieldChecks.Violation violation = violationOf(() -> OcppFieldChecks.requireConnectorStatus(payload));

        assertThat(violation.errorCode()).isEqualTo("PropertyConstraintViolation");
        assertThat(violation.getMessage()).contains("Available").contains("Faulted");
    }

    @Test
    void shouldRefuseA200CharacterStatus_withoutEchoingItBack() {
        JsonNode payload = mapper.createObjectNode().put("connectorStatus", "Z".repeat(200));

        OcppFieldChecks.Violation violation = violationOf(() -> OcppFieldChecks.requireConnectorStatus(payload));

        assertThat(violation.errorCode()).isEqualTo("PropertyConstraintViolation");
        assertThat(violation.getMessage()).doesNotContain("ZZZZZ").hasSizeLessThan(150);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"connectorStatus\":null}"})
    void shouldRefuseAMissingConnectorStatus_asAFormationViolation(String payload) throws Exception {
        JsonNode node = json(payload);

        OcppFieldChecks.Violation violation = violationOf(() -> OcppFieldChecks.requireConnectorStatus(node));

        assertThat(violation.errorCode()).isEqualTo("FormationViolation");
        assertThat(violation.getMessage()).contains("required");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"connectorStatus\":12}", "{\"connectorStatus\":true}", "{\"connectorStatus\":{\"a\":1}}",
            "{\"connectorStatus\":[\"Available\"]}"})
    void shouldRefuseANonTextConnectorStatus_asAFormationViolation(String payload) throws Exception {
        JsonNode node = json(payload);

        OcppFieldChecks.Violation violation = violationOf(() -> OcppFieldChecks.requireConnectorStatus(node));

        assertThat(violation.errorCode()).isEqualTo("FormationViolation");
        assertThat(violation.getMessage()).contains("must be text");
    }

    // ---------------------------------------------------------------- serial number

    @ParameterizedTest
    @ValueSource(strings = {"SN-123", "A", "a.b_c-9", "ABCDEFGHIJKLMNOPQRSTUVWXY"})
    void shouldStoreASerialOfUpTo25LettersDigitsDotsUnderscoresAndHyphens(String serial) throws Exception {
        assertThat(OcppFieldChecks.serialToStore(mapper.getNodeFactory().textNode(serial))).isEqualTo(serial);
    }

    @ParameterizedTest
    @ValueSource(strings = {"ABCDEFGHIJKLMNOPQRSTUVWXYZ", "has space", "semi;colon", "slash/slash", "café", "new\nline",
            "<script>", "tab\tx", "quote'", "percent%"})
    void shouldNotStoreASerialThatDoesNotFit(String serial) {
        assertThat(OcppFieldChecks.serialToStore(mapper.getNodeFactory().textNode(serial))).isNull();
        assertThat(OcppFieldChecks.wasSent(mapper.getNodeFactory().textNode(serial))).as("it counts as sent, so the log says it was not stored").isTrue();
    }

    @Test
    void shouldNotStoreASerialThatIsNotText_butStillCountItAsSent() throws Exception {
        for (String node : new String[]{"123", "true", "{\"a\":1}", "[\"SN-1\"]"}) {
            assertThat(OcppFieldChecks.serialToStore(json(node))).as(node).isNull();
            assertThat(OcppFieldChecks.wasSent(json(node))).as(node).isTrue();
        }
    }

    @Test
    void shouldTreatAMissingNullOrBlankSerialAsNotSent() throws Exception {
        assertThat(OcppFieldChecks.wasSent(json("{}").path("serialNumber"))).isFalse();
        assertThat(OcppFieldChecks.wasSent(json("null"))).isFalse();
        assertThat(OcppFieldChecks.wasSent(mapper.getNodeFactory().textNode(""))).isFalse();
        assertThat(OcppFieldChecks.wasSent(mapper.getNodeFactory().textNode("   "))).isFalse();
        assertThat(OcppFieldChecks.serialToStore(json("{}").path("serialNumber"))).isNull();
        assertThat(OcppFieldChecks.serialToStore(mapper.getNodeFactory().textNode(""))).isNull();
    }

    // ---------------------------------------------------------------- transaction id

    @Test
    void shouldAcceptATransactionIdOfUpTo36Characters() throws Exception {
        assertThatCode(() -> OcppFieldChecks.requireTransactionIdFits(
                json("{\"transactionInfo\":{\"transactionId\":\"" + "T".repeat(36) + "\"}}"))).doesNotThrowAnyException();
    }

    @Test
    void shouldRefuseATransactionIdOf37Characters_withoutEchoingIt() throws Exception {
        JsonNode payload = json("{\"transactionInfo\":{\"transactionId\":\"" + "T".repeat(37) + "\"}}");

        OcppFieldChecks.Violation violation = violationOf(() -> OcppFieldChecks.requireTransactionIdFits(payload));

        assertThat(violation.errorCode()).isEqualTo("PropertyConstraintViolation");
        assertThat(violation.getMessage()).contains("36").doesNotContain("TTTTT");
    }

    @Test
    void shouldLeaveAMissingNumericOrObjectTransactionIdToTheExistingHandling() throws Exception {
        for (String payload : new String[]{"{}", "{\"transactionInfo\":{}}", "{\"transactionInfo\":{\"transactionId\":null}}",
                "{\"transactionInfo\":{\"transactionId\":12345}}", "{\"transactionInfo\":{\"transactionId\":{\"a\":1}}}"}) {
            JsonNode node = json(payload);
            assertThatCode(() -> OcppFieldChecks.requireTransactionIdFits(node)).as(payload).doesNotThrowAnyException();
        }
    }

    // ---------------------------------------------------------------- error text sent by a charger

    @Test
    void shouldKeepAShortErrorTextAsItIs() {
        assertThat(OcppFieldChecks.errorText("lock motor jammed")).isEqualTo("lock motor jammed");
        assertThat(OcppFieldChecks.errorText("")).isEmpty();
        assertThat(OcppFieldChecks.errorText("E".repeat(200))).isEqualTo("E".repeat(200));
    }

    @Test
    void shouldCutAVeryLongErrorTextTo200Characters_andSayHowLongItWas() {
        String cut = OcppFieldChecks.errorText("D".repeat(5000));

        assertThat(cut).startsWith("D".repeat(200)).endsWith("...(5000 chars)").hasSizeLessThanOrEqualTo(230);
    }

    @Test
    void shouldReplaceControlCharactersInAnErrorText() {
        assertThat(OcppFieldChecks.errorText("line one\r\nline two\u0000")).isEqualTo("line one??line two?");
        assertThat(OcppFieldChecks.errorText(null)).isNull();
    }

    @Test
    void shouldCutAnErrorCodeTo64Characters() {
        assertThat(OcppFieldChecks.errorCode("GenericError")).isEqualTo("GenericError");
        assertThat(OcppFieldChecks.errorCode("C".repeat(300))).as("the stored column holds 64, so no suffix is added").isEqualTo("C".repeat(64));
        assertThat(OcppFieldChecks.errorCode(null)).isNull();
        assertThat(OcppFieldChecks.errorCode("bad\ncode")).isEqualTo("bad?code");
    }

    @Test
    void shouldNotLetTheViolationCarryAStackTrace() {
        OcppFieldChecks.Violation violation = new OcppFieldChecks.Violation("FormationViolation", "x");

        assertThat(violation.getStackTrace()).isEmpty();
        assertThatThrownBy(() -> { throw violation; }).isInstanceOf(RuntimeException.class).hasMessage("x");
    }
}

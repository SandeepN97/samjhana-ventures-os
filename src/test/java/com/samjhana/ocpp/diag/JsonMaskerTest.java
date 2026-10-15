package com.samjhana.ocpp.diag;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JsonMaskerTest {

    private final JsonMasker masker = new JsonMasker(new ObjectMapper());

    @Test
    void shouldMaskIdToken_whenTransactionEventCarriesOne() {
        String frame = "[2,\"m1\",\"TransactionEvent\",{\"eventType\":\"Started\",\"idToken\":{\"idToken\":\"BA1PA4521\",\"type\":\"Central\"}}]";

        JsonMasker.Masked masked = masker.mask(frame);

        assertThat(masked.changed()).isTrue();
        assertThat(masked.text()).contains("\"idToken\":\"BA***21\"").doesNotContain("BA1PA4521");
        assertThat(masked.tree().get(3).get("idToken").get("type").asText()).isEqualTo("Central");
    }

    @Test
    void shouldMaskNestedAndOcpp16Tokens_whenTheyAppearAnywhere() {
        String frame = "[2,\"m\",\"Authorize\",{\"a\":{\"b\":[{\"idToken\":{\"idToken\":\"ABCDEFGH\"}}]},\"idTag\":\"12345678\"}]";

        assertThat(masker.mask(frame).text()).contains("AB***GH").contains("12***78")
                .doesNotContain("ABCDEFGH").doesNotContain("12345678");
    }

    @Test
    void shouldHideShortTokensCompletely() {
        assertThat(JsonMasker.maskToken("1234")).isEqualTo("****");
        assertThat(JsonMasker.maskToken("12345")).isEqualTo("12***45");
    }

    @Test
    void shouldReturnFrameVerbatim_whenNothingNeedsMasking() {
        String frame = "[2, \"m1\", \"Heartbeat\", {}]";

        JsonMasker.Masked masked = masker.mask(frame);

        assertThat(masked.changed()).isFalse();
        assertThat(masked.text()).isEqualTo(frame);
    }

    @Test
    void shouldStillMaskTokens_whenJsonIsMalformed() {
        String broken = "[2,\"m\",\"Authorize\",{\"idToken\":{\"idToken\":\"TOKEN-ABC-1\"}, oops";

        JsonMasker.Masked masked = masker.mask(broken);

        assertThat(masked.tree()).isNull();
        assertThat(masked.text()).doesNotContain("TOKEN-ABC-1").contains("TO***-1");
    }

    @Test
    void shouldMaskPasswordsAndSecretVariables_whenTheyAppearInAFrame() {
        String value = "val-" + java.util.UUID.randomUUID();
        String other = "val-" + java.util.UUID.randomUUID();
        String frame = "[2,\"m\",\"SetVariables\",{\"setVariableData\":[{\"attributeValue\":\"" + value + "\","
                + "\"variable\":{\"name\":\"BasicAuthPassword\"},\"component\":{\"name\":\"SecurityCtrlr\"}},"
                + "{\"attributeValue\":\"30\",\"variable\":{\"name\":\"HeartbeatInterval\"}}],\"password\":\"" + other + "\"}]";

        String text = masker.mask(frame).text();

        assertThat(text).doesNotContain(value).doesNotContain(other);
        assertThat(text).contains("\"attributeValue\":\"30\"");
    }

    @Test
    void shouldHandleEmptyAndNullInput() {
        assertThat(masker.mask(null).text()).isEmpty();
        assertThat(masker.mask("").text()).isEmpty();
    }
}

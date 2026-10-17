package com.samjhana.config;

import com.fasterxml.jackson.core.exc.StreamConstraintsException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Finding F-01: the server's JSON reader had no limit on the size of one text or of the whole document other than
 * Jackson's very generous defaults (20 million characters per text). Now nothing needs more than the photo field
 * (7 million characters), so a bigger text, or a bigger document, is refused while it is being read.
 */
@SpringBootTest
@ActiveProfiles("test")
class JacksonLimitsConfigTest {

    @Autowired ObjectMapper objectMapper;

    @Test
    void shouldReadATextOfAPhotoSize() throws Exception {
        String photoSized = "a".repeat(7_000_000);

        String read = objectMapper.readValue("\"" + photoSized + "\"", String.class);

        assertThat(read).hasSize(7_000_000);
    }

    @Test
    void shouldRefuseATextLongerThanTheLimit() {
        String tooLong = "\"" + "a".repeat(JacksonLimitsConfig.MAX_STRING_CHARS + 1) + "\"";

        assertThatThrownBy(() -> objectMapper.readValue(tooLong, String.class)).isInstanceOf(StreamConstraintsException.class);
    }

    @Test
    void shouldReadATextExactlyAtTheLimit() throws Exception {
        String atLimit = "\"" + "a".repeat(JacksonLimitsConfig.MAX_STRING_CHARS) + "\"";

        assertThat(objectMapper.readValue(atLimit, String.class)).hasSize(JacksonLimitsConfig.MAX_STRING_CHARS);
    }

    @Test
    void shouldRefuseADocumentLongerThanTheLimit_evenWhenEveryTextInItIsShort() {
        StringBuilder many = new StringBuilder("[");
        String item = "\"" + "b".repeat(990) + "\",";
        for (int i = 0; i < JacksonLimitsConfig.MAX_DOCUMENT_CHARS / item.length() + 10; i++) many.append(item);
        many.append("\"end\"]");

        assertThatThrownBy(() -> objectMapper.readValue(many.toString(), Object.class)).isInstanceOf(StreamConstraintsException.class);
    }

    @Test
    void shouldStillReadOrdinaryJson() throws Exception {
        assertThat(objectMapper.readTree("{\"a\":[1,2,{\"b\":\"c\"}]}").get("a")).hasSize(3);
    }
}

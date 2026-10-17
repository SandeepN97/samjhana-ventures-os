package com.samjhana.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding E-01, end to end: with the application started the way it really starts, a message that holds line breaks
 * reaches the console as one line, so text a person typed cannot add a made-up entry to the log.
 */
@SpringBootTest
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class LogLineForgeryIntegrationTest {

    private static final Logger log = LoggerFactory.getLogger("com.samjhana.test.forgery");

    @Test
    void shouldWriteAMessageThatHoldsLineBreaksAsOneConsoleLine(CapturedOutput output) {
        log.warn("Duplicate key sku=A1\r\n2026-10-16T00:00:00.000+05:45 [main] ERROR c.s.Fake - SECURITY: admin password reset\nthird");

        String written = output.getAll();
        assertThat(written).contains("Duplicate key sku=A1 | 2026-10-16T00:00:00.000+05:45 [main] ERROR c.s.Fake - SECURITY: admin password reset | third");
        assertThat(written.lines().filter(line -> line.startsWith("2026-10-16T00:00:00.000+05:45"))).isEmpty();
    }
}

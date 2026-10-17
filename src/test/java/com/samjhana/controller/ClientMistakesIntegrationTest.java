package com.samjhana.controller;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding I-01, through the real (anonymous) routes: a malformed query value or the wrong content type is the
 * caller's mistake, so it answers 4xx and writes no error and no stack trace to the log.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ClientMistakesIntegrationTest {

    @Autowired MockMvc mockMvc;

    private final Logger handlerLog = (Logger) LoggerFactory.getLogger("com.samjhana.exception.GlobalExceptionHandler");
    private final ListAppender<ILoggingEvent> events = new ListAppender<>();

    @BeforeEach
    void capture() {
        events.start();
        handlerLog.addAppender(events);
    }

    @AfterEach
    void release() {
        handlerLog.detachAppender(events);
    }

    @Test
    void shouldAnswer400_andLogNoError_whenAPageNumberIsNotANumber() throws Exception {
        mockMvc.perform(get("/api/public/shop/products").param("page", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));

        assertThat(events.list).noneMatch(e -> e.getLevel().isGreaterOrEqual(Level.WARN));
        assertThat(events.list).allMatch(e -> e.getThrowableProxy() == null);
    }

    @Test
    void shouldAnswer400_whenAPriceIsNotANumber_andNeverLogALineBreakTheCallerChose() throws Exception {
        mockMvc.perform(get("/api/public/shop/products").param("minPrice", "1\r\nFORGED ERROR LINE"))
                .andExpect(status().isBadRequest());

        assertThat(events.list).allSatisfy(e -> assertThat(e.getFormattedMessage()).doesNotContain("\n").doesNotContain("\r"));
        assertThat(events.list).noneMatch(e -> e.getLevel().isGreaterOrEqual(Level.WARN));
    }

    @Test
    void shouldAnswer415_whenTheLoginIsSentAsPlainText() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.TEXT_PLAIN).content("username=admin&password=x"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));

        assertThat(events.list).noneMatch(e -> e.getLevel().isGreaterOrEqual(Level.WARN));
    }

    @Test
    void shouldStillAnswerTheNormalProductList() throws Exception {
        mockMvc.perform(get("/api/public/shop/products").param("page", "1").param("size", "5"))
                .andExpect(status().isOk());
    }
}

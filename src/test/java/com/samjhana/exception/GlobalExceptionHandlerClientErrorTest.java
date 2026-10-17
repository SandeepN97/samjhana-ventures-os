package com.samjhana.exception;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Finding I-01: the catch-all handler answered every exception it had no handler for with 500 and wrote the whole
 * stack trace to the log at ERROR. Anyone could therefore fill the log, with text of their choosing, by sending a
 * malformed query value or the wrong content type. Those are the caller's mistakes: they get the 4xx Spring chose, and
 * the log gets one short line with the caller's text made safe. A real fault is still a 500 and still logged in full.
 */
class GlobalExceptionHandlerClientErrorTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final Logger logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final ListAppender<ILoggingEvent> events = new ListAppender<>();
    private Level before;

    @BeforeEach
    void capture() {
        before = logger.getLevel();
        logger.setLevel(Level.ALL);
        events.start();
        logger.addAppender(events);
    }

    @AfterEach
    void release() {
        logger.detachAppender(events);
        logger.setLevel(before);
    }

    private static MethodArgumentTypeMismatchException mismatch(String value) {
        return new MethodArgumentTypeMismatchException(value, Integer.class, "page", mock(MethodParameter.class),
                new NumberFormatException("For input string: \"" + value + "\""));
    }

    @Test
    void shouldAnswer400_whenAQueryValueIsNotOfTheRightType() {
        ResponseEntity<ErrorResponse> response = handler.handleGeneric(mismatch("abc"));

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody().code()).isEqualTo("BAD_REQUEST");
        assertThat(response.getBody().message()).doesNotContain("abc");
    }

    @Test
    void shouldAnswer415_whenTheContentTypeIsNotSupported() {
        ResponseEntity<ErrorResponse> response = handler.handleGeneric(
                new HttpMediaTypeNotSupportedException(MediaType.TEXT_PLAIN, List.of(MediaType.APPLICATION_JSON)));

        assertThat(response.getStatusCode().value()).isEqualTo(415);
        assertThat(response.getBody().code()).isEqualTo("UNSUPPORTED_MEDIA_TYPE");
    }

    @Test
    void shouldAnswer406_whenNoAcceptableAnswerExists() {
        ResponseEntity<ErrorResponse> response = handler.handleGeneric(
                new HttpMediaTypeNotAcceptableException(List.of(MediaType.APPLICATION_JSON)));

        assertThat(response.getStatusCode().value()).isEqualTo(406);
        assertThat(response.getBody().code()).isEqualTo("NOT_ACCEPTABLE");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void shouldAnswer400_whenARequiredHeaderIsMissing() {
        MethodParameter parameter = mock(MethodParameter.class);
        when(parameter.getNestedParameterType()).thenReturn((Class) String.class);

        ResponseEntity<ErrorResponse> response = handler.handleGeneric(new MissingRequestHeaderException("X-Needed", parameter));

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void shouldNotLogAnErrorOrAStackTrace_forACallersMistake() {
        handler.handleGeneric(mismatch("abc"));
        handler.handleGeneric(new HttpMediaTypeNotSupportedException(MediaType.TEXT_PLAIN, List.of(MediaType.APPLICATION_JSON)));

        assertThat(events.list).noneMatch(e -> e.getLevel().isGreaterOrEqual(Level.WARN));
        assertThat(events.list).allMatch(e -> e.getThrowableProxy() == null);
    }

    @Test
    void shouldKeepTheCallersTextOutOfTheLogsLineStructure() {
        handler.handleGeneric(mismatch("abc\r\n2026-10-16 ERROR forged line\u0000"));

        assertThat(events.list).isNotEmpty();
        assertThat(events.list).allSatisfy(e -> assertThat(e.getFormattedMessage()).doesNotContain("\r").doesNotContain("\n").doesNotContain("\u0000"));
    }

    @Test
    void shouldBoundHowMuchOfTheCallersTextIsLogged() {
        handler.handleGeneric(mismatch("x".repeat(50_000)));

        assertThat(events.list).allSatisfy(e -> assertThat(e.getFormattedMessage().length()).isLessThan(1_000));
    }

    @Test
    void shouldKeepAServerSideProblemAs500AndLogItInFull_evenWhenSpringDescribesItWithAStatus() {
        // Spring's own "async request timed out" is a 503: a problem on our side, not the caller's mistake
        ResponseEntity<ErrorResponse> response = handler.handleGeneric(
                new org.springframework.web.context.request.async.AsyncRequestTimeoutException());

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(events.list).anyMatch(e -> e.getLevel() == Level.ERROR && e.getThrowableProxy() != null);
    }

    @Test
    void shouldStillAnswer500AndLogInFull_forARealFault() {
        ResponseEntity<ErrorResponse> response = handler.handleGeneric(new IllegalStateException("database is down"));

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody().code()).isEqualTo("SERVER_ERROR");
        assertThat(events.list).anyMatch(e -> e.getLevel() == Level.ERROR && e.getThrowableProxy() != null);
    }
}

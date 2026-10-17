package com.samjhana.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Finding F-01: when a body that did not announce its size turns out to be too big while it is being read, the
 * caller gets 413 (not the generic "invalid value" 400), and a body that is merely malformed is still a 400.
 */
class GlobalExceptionHandlerTooLargeTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final HttpInputMessage message = mock(HttpInputMessage.class);

    @Test
    void shouldAnswer413_whenTheBodyWasCutOffForBeingTooLarge() {
        HttpMessageNotReadableException unreadable = new HttpMessageNotReadableException(
                "I/O error while reading input message", new RequestBodyTooLargeException("over the limit"), message);

        ResponseEntity<ErrorResponse> response = handler.handleUnreadableBody(unreadable);

        assertThat(response.getStatusCode().value()).isEqualTo(413);
        assertThat(response.getBody()).isEqualTo(new ErrorResponse("TOO_LARGE", "That request is too large."));
    }

    @Test
    void shouldFindTheCauseEvenWhenItIsWrappedDeeper() {
        Exception wrapped = new IOException("read failed", new IOException("again", new RequestBodyTooLargeException("over")));
        HttpMessageNotReadableException unreadable = new HttpMessageNotReadableException("x", wrapped, message);

        assertThat(handler.handleUnreadableBody(unreadable).getStatusCode().value()).isEqualTo(413);
    }

    @Test
    void shouldStillAnswer400_whenTheBodyIsOnlyMalformed() {
        HttpMessageNotReadableException unreadable = new HttpMessageNotReadableException("JSON parse error", new IOException("bad"), message);

        ResponseEntity<ErrorResponse> response = handler.handleUnreadableBody(unreadable);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody().code()).isEqualTo("INVALID_REQUEST");
    }

    @Test
    void shouldStillAnswer400_whenThereIsNoCause() {
        HttpMessageNotReadableException unreadable = new HttpMessageNotReadableException("Required request body is missing", message);

        assertThat(handler.handleUnreadableBody(unreadable).getStatusCode().value()).isEqualTo(400);
    }
}

package com.samjhana.exception;

import com.samjhana.ocpp.diag.LogSafe;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.format.DateTimeParseException;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler({BusinessUnitNotFoundException.class, TransactionNotFoundException.class, ResourceNotFoundException.class})
    public ResponseEntity<ErrorResponse> handleNotFound(RuntimeException ex) {
        return ResponseEntity.status(404).body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }

    /** A URL nothing serves: a plain 404, not a logged "Something went wrong" 500. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoSuchPath(NoResourceFoundException ex) {
        return ResponseEntity.status(404).body(new ErrorResponse("NOT_FOUND", "Not found"));
    }

    @ExceptionHandler(DayAlreadyClosedException.class)
    public ResponseEntity<ErrorResponse> handleDayAlreadyClosed(DayAlreadyClosedException ex) {
        return ResponseEntity.status(409).body(new ErrorResponse("ALREADY_CLOSED", ex.getMessage()));
    }

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ErrorResponse> handleInsufficientStock(InsufficientStockException ex) {
        return ResponseEntity.status(409).body(new ErrorResponse("INSUFFICIENT_STOCK", ex.getMessage()));
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<ErrorResponse> handleTooMany(TooManyRequestsException ex) {
        return ResponseEntity.status(429).body(new ErrorResponse("TOO_MANY_REQUESTS", ex.getMessage()));
    }

    @ExceptionHandler(EvSessionStateException.class)
    public ResponseEntity<ErrorResponse> handleEvSessionConflict(EvSessionStateException ex) {
        return ResponseEntity.status(409).body(new ErrorResponse("EV_SESSION_CONFLICT", ex.getMessage()));
    }

    @ExceptionHandler(FuelPriceScraperException.class)
    public ResponseEntity<ErrorResponse> handleScraperError(FuelPriceScraperException ex) {
        log.warn("Fuel price scraper error: {}", ex.getMessage());
        return ResponseEntity.status(503).body(new ErrorResponse("SCRAPER_ERROR", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(400).body(new ErrorResponse("VALIDATION_FAILED", message));
    }

    /**
     * Malformed JSON, or a value that isn't valid for its type (e.g. a payment method
     * that isn't in the enum). That's the caller's mistake, not a server fault, so answer
     * 400 instead of letting it fall through to the generic 500 handler. The parser's own
     * message is deliberately not echoed back.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException ex) {
        if (causedByTooLargeBody(ex)) {
            return ResponseEntity.status(413).body(new ErrorResponse("TOO_LARGE", "That request is too large."));
        }
        log.debug("Unreadable request body: {}", ex.getMessage());
        return ResponseEntity.status(400)
                .body(new ErrorResponse("INVALID_REQUEST", "Request body is missing or contains an invalid value."));
    }

    /**
     * True when the body did not say how big it was and turned out to be over the limit while it was being read
     * (see {@code RequestBodyLimitFilter}): reading stopped there, so nothing more was kept in memory.
     */
    private static boolean causedByTooLargeBody(Throwable ex) {
        Throwable cause = ex;
        for (int depth = 0; cause != null && depth < 10; depth++, cause = cause.getCause()) {
            if (cause instanceof RequestBodyTooLargeException) return true;
        }
        return false;
    }

    @ExceptionHandler({BadCredentialsException.class, AuthenticationException.class})
    public ResponseEntity<ErrorResponse> handleAuthentication(RuntimeException ex) {
        return ResponseEntity.status(401).body(new ErrorResponse("UNAUTHORIZED", "Invalid credentials"));
    }

    /**
     * A @PreAuthorize refusal. Without this it would fall through to the generic handler as a 500.
     * The message matters: the admin app treats a 403 without one as an expired login.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(403).body(new ErrorResponse("FORBIDDEN", "You do not have permission to do this"));
    }

    /** E.g. two people closing the same day at once: the second hits the unique date and gets a clear 409. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleConflict(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return ResponseEntity.status(409).body(new ErrorResponse("CONFLICT", "This conflicts with a record that already exists"));
    }

    @ExceptionHandler(DateTimeParseException.class)
    public ResponseEntity<ErrorResponse> handleBadDate(DateTimeParseException ex) {
        return ResponseEntity.status(400).body(new ErrorResponse("BAD_REQUEST", "Dates must be in YYYY-MM-DD format"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(400).body(new ErrorResponse("BAD_REQUEST", ex.getMessage()));
    }

    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleWrongMethod(org.springframework.web.HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(405).body(new ErrorResponse("METHOD_NOT_ALLOWED", "This request type is not allowed here."));
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleTooLarge(org.springframework.web.multipart.MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(413).body(new ErrorResponse("TOO_LARGE", "The picture is larger than 3 MB"));
    }

    @ExceptionHandler({org.springframework.web.multipart.support.MissingServletRequestPartException.class,
            org.springframework.web.bind.MissingServletRequestParameterException.class})
    public ResponseEntity<ErrorResponse> handleMissingPart(Exception ex) {
        return ResponseEntity.status(400).body(new ErrorResponse("BAD_REQUEST", "Choose a picture to upload"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        // A caller's mistake (a query value that is not a number, the wrong content type, a missing header) is
        // theirs to fix: it gets the 4xx Spring chose, and the log gets one short line instead of a stack trace
        // (finding I-01). Only a real fault is a 500 that is logged in full.
        if (ex instanceof org.springframework.web.ErrorResponse spring && spring.getStatusCode().is4xxClientError()) {
            return clientMistake(spring.getStatusCode().value(), ex);
        }
        if (ex instanceof TypeMismatchException) {
            return clientMistake(400, ex);
        }
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(500).body(new ErrorResponse("SERVER_ERROR", "Something went wrong."));
    }

    private ResponseEntity<ErrorResponse> clientMistake(int status, Exception ex) {
        // The text may hold what the caller typed, so it is made safe for the log: no line breaks, bounded length.
        log.debug("Request refused with {}: {}", status, LogSafe.clean(ex.getMessage(), 200));
        HttpStatus known = HttpStatus.resolve(status);
        String code = known == null ? "BAD_REQUEST" : known.name();
        return ResponseEntity.status(status).body(new ErrorResponse(code, "That request could not be processed."));
    }
}

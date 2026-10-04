package com.samjhana.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
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
        log.debug("Unreadable request body: {}", ex.getMessage());
        return ResponseEntity.status(400)
                .body(new ErrorResponse("INVALID_REQUEST", "Request body is missing or contains an invalid value."));
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

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(500).body(new ErrorResponse("SERVER_ERROR", "Something went wrong."));
    }
}

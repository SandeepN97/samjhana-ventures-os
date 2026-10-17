package com.samjhana.exception;

import com.samjhana.ocpp.diag.LogCapture;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding L-01: the database's own error text names the row that clashed (a number plate, a username). It was written
 * to the log whole. Only the name of the rule that was broken and the SQL state are logged now.
 */
class GlobalExceptionHandlerConflictLogTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private static DataIntegrityViolationException clash() {
        String text = "Unique index or primary key violation: \"PUBLIC.UK_EV_PLATE_INDEX_5 ON PUBLIC.EV_CUSTOMER_VEHICLES(PLATE_NUMBER NULLS FIRST) VALUES ( /* 1 */ 'BA 1 PA 1234' )\"";
        SQLException sql = new SQLException(text, "23505");
        ConstraintViolationException hibernate = new ConstraintViolationException("could not execute statement [" + text + "]", sql, "uk_ev_plate");
        return new DataIntegrityViolationException("could not execute statement", hibernate);
    }

    @Test
    void shouldLogTheRuleThatWasBrokenButNeverTheValuesThatClashed() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.handleConflict(clash());

            assertThat(capture.anyContains("BA 1 PA 1234")).as("the number plate").isFalse();
            assertThat(capture.anyContains("VALUES")).as("the database's own text").isFalse();
            assertThat(capture.matching("Data integrity violation")).hasSize(1);
            assertThat(capture.matching("uk_ev_plate")).hasSize(1);
            assertThat(capture.matching("23505")).hasSize(1);
        }
    }

    @Test
    void shouldStillAnswer409WithTheSameMessage() {
        ResponseEntity<ErrorResponse> response = handler.handleConflict(clash());

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(response.getBody().code()).isEqualTo("CONFLICT");
        assertThat(response.getBody().message()).isEqualTo("This conflicts with a record that already exists");
    }

    @Test
    void shouldNotFail_whenTheErrorCarriesNeitherARuleNameNorAnSqlState() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            ResponseEntity<ErrorResponse> response = handler.handleConflict(new DataIntegrityViolationException("odd 'secret-value' failure"));

            assertThat(response.getStatusCode().value()).isEqualTo(409);
            assertThat(capture.anyContains("secret-value")).isFalse();
            assertThat(capture.matching("Data integrity violation")).hasSize(1);
        }
    }

    @Test
    void shouldKeepLineBreaksInTheRuleNameOutOfTheLog() {
        ConstraintViolationException hibernate = new ConstraintViolationException("x", new SQLException("y", "23505"), "rule\nSECURITY: forged");
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.handleConflict(new DataIntegrityViolationException("x", hibernate));

            assertThat(capture.matching("Data integrity violation").get(0)).doesNotContain("\n");
        }
    }

    @Test
    void shouldCutAVeryLongRuleNameShort() {
        ConstraintViolationException hibernate = new ConstraintViolationException("x", new SQLException("y", "23505"), "r".repeat(5000));
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.handleConflict(new DataIntegrityViolationException("x", hibernate));

            assertThat(capture.matching("Data integrity violation").get(0).length()).isLessThan(400);
        }
    }
}

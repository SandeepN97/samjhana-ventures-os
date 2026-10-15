package com.samjhana.websocket;

import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.ocpp.diag.LogCapture;
import com.samjhana.ocpp.diag.OcppLoggers;
import com.samjhana.ocpp.diag.OcppLoggingProperties;
import com.samjhana.ocpp.diag.RecordingAuditWriter;
import com.samjhana.repository.ChargePointRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OcppHandshakeInterceptorTest {

    private static final String CODE = "HD-D180-CC-01";
    // generated at run time: nothing in the repository looks like a credential
    private static final String PASSWORD = "pw-" + java.util.UUID.randomUUID();
    private static final String WRONG_PASSWORD = "wrong-" + java.util.UUID.randomUUID();
    private static final String BEARER = "Bearer " + java.util.UUID.randomUUID();

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private ChargePointRepository repository;
    private RecordingAuditWriter writer;
    private OcppHandshakeInterceptor interceptor;
    private ChargePoint point;

    @BeforeEach
    void setUp() {
        repository = mock(ChargePointRepository.class);
        writer = new RecordingAuditWriter(new OcppLoggingProperties());
        interceptor = new OcppHandshakeInterceptor(repository, encoder, writer);
        point = ChargePoint.builder().code(CODE).isActive(true).ocppAuthSecretHash(encoder.encode(PASSWORD)).build();
        when(repository.findByCodeAndDeletedAtIsNull(CODE)).thenReturn(Optional.of(point));
        when(repository.findByCodeAndDeletedAtIsNull("NOPE-01")).thenReturn(Optional.empty());
    }

    private static String basic(String user, String password) {
        return "Basic " + Base64.getEncoder().encodeToString((user + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    private record Result(boolean accepted, int status, Map<String, Object> attributes) {}

    private Result attempt(String path, String protocols, String authorization, LogCapture capture) {
        MockHttpServletRequest servlet = new MockHttpServletRequest("GET", path);
        servlet.setRemoteAddr("203.0.113.9");
        servlet.addHeader("X-Forwarded-For", "198.51.100.7, 10.0.0.1");
        servlet.addHeader("User-Agent", "HardhitterFirmware/1.0");
        if (protocols != null) servlet.addHeader("Sec-WebSocket-Protocol", protocols);
        if (authorization != null) servlet.addHeader("Authorization", authorization);
        MockHttpServletResponse response = new MockHttpServletResponse();
        Map<String, Object> attributes = new HashMap<>();
        boolean accepted = interceptor.beforeHandshake(new ServletServerHttpRequest(servlet),
                new ServletServerHttpResponse(response), null, attributes);
        return new Result(accepted, response.getStatus(), attributes);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "NO_SUBPROTOCOL        | /ocpp/HD-D180-CC-01 | NONE      | NONE   | 426",
            "UNSUPPORTED_SUBPROTOCOL | /ocpp/HD-D180-CC-01 | ocpp1.6   | GOOD   | 426",
            "UNKNOWN_CHARGER       | /ocpp/NOPE-01       | ocpp2.0.1 | GOOD   | 401",
            "NO_AUTH_HEADER        | /ocpp/HD-D180-CC-01 | ocpp2.0.1 | NONE   | 401",
            "MALFORMED_BASIC       | /ocpp/HD-D180-CC-01 | ocpp2.0.1 | BEARER | 401",
            "MALFORMED_BASIC       | /ocpp/HD-D180-CC-01 | ocpp2.0.1 | BADB64 | 401",
            "MALFORMED_BASIC       | /ocpp/HD-D180-CC-01 | ocpp2.0.1 | NOCOLON| 401",
            "USER_MISMATCH         | /ocpp/HD-D180-CC-01 | ocpp2.0.1 | OTHERUSER | 401",
            "BAD_PASSWORD          | /ocpp/HD-D180-CC-01 | ocpp2.0.1 | WRONG  | 401",
            "ACCEPTED              | /ocpp/HD-D180-CC-01 | ocpp2.0.1 | GOOD   | 200"})
    void shouldLogExactlyOneLineWithTheReason_andStoreOneRow_forEveryOutcome(
            String reason, String path, String protocols, String auth, int status) {
        String header = switch (auth) {
            case "GOOD" -> basic(CODE, PASSWORD);
            case "WRONG" -> basic(CODE, WRONG_PASSWORD);
            case "OTHERUSER" -> basic("somebody-else", PASSWORD);
            case "BEARER" -> BEARER;
            case "BADB64" -> "Basic !!!not-base64!!!";
            case "NOCOLON" -> "Basic " + Base64.getEncoder().encodeToString("nocolonhere".getBytes(StandardCharsets.UTF_8));
            default -> null;
        };
        String offered = protocols.equals("NONE") ? null : protocols;

        try (LogCapture capture = LogCapture.atEveryLevel()) {
            Result result = attempt(path, offered, header, capture);

            List<String> lines = capture.textsFrom(OcppLoggers.HANDSHAKE_NAME);
            assertThat(lines).as("exactly one handshake line").hasSize(1);
            assertThat(lines.get(0)).startsWith("HANDSHAKE " + reason + " ").contains("path=" + path)
                    .contains("chargePointId=" + path.substring(path.lastIndexOf('/') + 1))
                    .contains("remote=203.0.113.9").contains("xForwardedFor=198.51.100.7, 10.0.0.1");
            assertThat(result.accepted()).isEqualTo(reason.equals("ACCEPTED"));
            assertThat(result.status()).isEqualTo(status);
            assertThat(result.attributes().containsKey(OcppHandshakeInterceptor.CHARGE_POINT_CODE))
                    .isEqualTo(reason.equals("ACCEPTED"));

            // Secrets never reach any log line at any level, nor the stored rows.
            for (String secret : List.of(PASSWORD, WRONG_PASSWORD, BEARER, "!!!not-base64!!!",
                    basic(CODE, PASSWORD), basic(CODE, WRONG_PASSWORD),
                    Base64.getEncoder().encodeToString((CODE + ":" + PASSWORD).getBytes(StandardCharsets.UTF_8)),
                    point.getOcppAuthSecretHash())) {
                assertThat(capture.anyContains(secret)).as("log must not contain %s", secret).isFalse();
                assertThat(writer.dump()).doesNotContain(secret);
            }
        }
        List<OcppConnectionLog> rows = writer.rows(OcppConnectionLog.class);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getReason()).isEqualTo(reason);
        assertThat(rows.get(0).getEvent()).isEqualTo(reason.equals("ACCEPTED")
                ? OcppConnectionLog.Event.HANDSHAKE_ACCEPTED : OcppConnectionLog.Event.HANDSHAKE_REJECTED);
        assertThat(rows.get(0).getRemoteAddr()).isEqualTo("203.0.113.9");
        assertThat(rows.get(0).getForwardedFor()).isEqualTo("198.51.100.7, 10.0.0.1");
        assertThat(rows.get(0).getUserAgent()).isEqualTo("HardhitterFirmware/1.0");
        assertThat(rows.get(0).getOfferedProtocols()).isEqualTo(offered == null ? "" : offered);
    }

    @Test
    void shouldLogTheFullOfferedList_whenOnlyOcpp16IsOffered() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            attempt("/ocpp/" + CODE, "ocpp1.6, ocpp1.5", basic(CODE, PASSWORD), capture);

            assertThat(capture.textsFrom(OcppLoggers.HANDSHAKE_NAME).get(0))
                    .startsWith("HANDSHAKE UNSUPPORTED_SUBPROTOCOL").contains("offeredProtocols=[ocpp1.6, ocpp1.5]");
        }
    }

    @Test
    void shouldLogOnlyTheUsernameAndWhetherAuthorizationParsed_neverTheValue() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            attempt("/ocpp/" + CODE, "ocpp2.0.1", basic(CODE, WRONG_PASSWORD), capture);

            assertThat(capture.textsFrom(OcppLoggers.HANDSHAKE_NAME).get(0))
                    .contains("authorization=present, Basic parsable").contains("basicUser=" + CODE)
                    .doesNotContain(WRONG_PASSWORD);
        }
    }

    @Test
    void shouldDistinguishInactiveChargerAndMissingSecretHash() {
        point.setIsActive(false);
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            attempt("/ocpp/" + CODE, "ocpp2.0.1", basic(CODE, PASSWORD), capture);
            point.setIsActive(true);
            point.setOcppAuthSecretHash(null);
            attempt("/ocpp/" + CODE, "ocpp2.0.1", basic(CODE, PASSWORD), capture);

            List<String> lines = capture.textsFrom(OcppLoggers.HANDSHAKE_NAME);
            assertThat(lines.get(0)).startsWith("HANDSHAKE INACTIVE_CHARGER");
            assertThat(lines.get(1)).startsWith("HANDSHAKE NO_SECRET_HASH");
        }
    }

    @Test
    void shouldNeverTellTheClientTheReason_onlyOpaque401Or426() {
        Result unknown = attempt("/ocpp/NOPE-01", "ocpp2.0.1", basic("NOPE-01", "x"), null);
        Result badPassword = attempt("/ocpp/" + CODE, "ocpp2.0.1", basic(CODE, WRONG_PASSWORD), null);
        Result wrongProtocol = attempt("/ocpp/" + CODE, "ocpp1.6", basic(CODE, PASSWORD), null);

        assertThat(unknown.status()).isEqualTo(badPassword.status()).isEqualTo(401);
        assertThat(wrongProtocol.status()).isEqualTo(426);
    }

    @Test
    void shouldFlagRejectionsAsWarn_andAcceptanceAsInfo() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            attempt("/ocpp/" + CODE, "ocpp2.0.1", basic(CODE, PASSWORD), capture);
            attempt("/ocpp/" + CODE, "ocpp2.0.1", basic(CODE, WRONG_PASSWORD), capture);

            assertThat(capture.events(OcppLoggers.HANDSHAKE_NAME, ch.qos.logback.classic.Level.INFO)).hasSize(1);
            assertThat(capture.events(OcppLoggers.HANDSHAKE_NAME, ch.qos.logback.classic.Level.WARN)).hasSize(1);
        }
    }

    @Test
    void shouldStripLineBreaksFromHeaderValues_soTheyCannotForgeLogLines() {
        MockHttpServletRequest servlet = new MockHttpServletRequest("GET", "/ocpp/" + CODE);
        servlet.addHeader("Sec-WebSocket-Protocol", "ocpp1.6\nHANDSHAKE ACCEPTED forged");
        servlet.addHeader("User-Agent", "evil\r\nINFO forged");
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            interceptor.beforeHandshake(new ServletServerHttpRequest(servlet),
                    new ServletServerHttpResponse(new MockHttpServletResponse()), null, new HashMap<>());

            assertThat(capture.textsFrom(OcppLoggers.HANDSHAKE_NAME)).singleElement().asString()
                    .doesNotContain("\n").doesNotContain("\r");
        }
    }
}

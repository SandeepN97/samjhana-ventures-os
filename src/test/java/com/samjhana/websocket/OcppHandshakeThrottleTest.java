package com.samjhana.websocket;

import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.ocpp.diag.LogCapture;
import com.samjhana.ocpp.diag.OcppLoggers;
import com.samjhana.ocpp.diag.OcppLoggingProperties;
import com.samjhana.ocpp.diag.RecordingAuditWriter;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.security.ClientAddressResolver;
import com.samjhana.security.RequestThrottle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Finding P1a-10: anyone who knows a public charger code could make the server run a BCrypt comparison per request,
 * as fast as they could send them. Now a handful of wrong passwords from one address for one charger, and further
 * attempts from that address for that charger are refused before any password is checked.
 */
class OcppHandshakeThrottleTest {

    private static final String CODE = "HD-D180-CC-01";
    private static final String OTHER_CODE = "HQC23-80-01";
    private static final String PASSWORD = "pw-" + java.util.UUID.randomUUID();
    private static final String WRONG = "wrong-" + java.util.UUID.randomUUID();

    private final PasswordEncoder encoder = spy(new BCryptPasswordEncoder(4));
    private RecordingAuditWriter writer;
    private OcppHandshakeInterceptor interceptor;

    @BeforeEach
    void setUp() {
        ChargePointRepository repository = mock(ChargePointRepository.class);
        writer = new RecordingAuditWriter(new OcppLoggingProperties());
        interceptor = new OcppHandshakeInterceptor(repository, encoder, writer, new ClientAddressResolver(0), new RequestThrottle());
        for (String code : List.of(CODE, OTHER_CODE)) {
            ChargePoint point = ChargePoint.builder().code(code).isActive(true).ocppAuthSecretHash(encoder.encode(PASSWORD)).build();
            when(repository.findByCodeAndDeletedAtIsNull(code)).thenReturn(Optional.of(point));
        }
        org.mockito.Mockito.clearInvocations(encoder);
    }

    private static String basic(String user, String password) {
        return "Basic " + Base64.getEncoder().encodeToString((user + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    private int attempt(String address, String code, String user, String password) {
        MockHttpServletRequest servlet = new MockHttpServletRequest("GET", "/ocpp/" + code);
        servlet.setRemoteAddr("10.0.0.1");
        servlet.addHeader("X-Forwarded-For", address);          // the proxy puts the visitor's address last
        servlet.addHeader("Sec-WebSocket-Protocol", "ocpp2.0.1");
        servlet.addHeader("Authorization", basic(user, password));
        MockHttpServletResponse response = new MockHttpServletResponse();
        interceptor.beforeHandshake(new ServletServerHttpRequest(servlet), new ServletServerHttpResponse(response), null, new HashMap<>());
        return response.getStatus();
    }

    @Test
    void shouldRefuseWithoutCheckingThePassword_afterTenWrongPasswordsFromOneAddressForOneCharger() {
        for (int i = 0; i < 10; i++) assertThat(attempt("203.0.113.5", CODE, CODE, WRONG)).isEqualTo(401);
        verify(encoder, times(10)).matches(anyString(), anyString());

        assertThat(attempt("203.0.113.5", CODE, CODE, WRONG)).isEqualTo(429);
        assertThat(attempt("203.0.113.5", CODE, CODE, PASSWORD)).as("even the right password, for now").isEqualTo(429);

        verify(encoder, times(10)).matches(anyString(), anyString());   // no further password checks
    }

    @Test
    void shouldNotSpendTheBudgetOnSuccessfulConnections() {
        for (int i = 0; i < 25; i++) assertThat(attempt("203.0.113.5", CODE, CODE, PASSWORD)).isEqualTo(200);

        assertThat(attempt("203.0.113.5", CODE, CODE, WRONG)).isEqualTo(401);
    }

    @Test
    void shouldNotSpendTheBudgetOnAttemptsThatNeverReachThePasswordCheck() {
        for (int i = 0; i < 20; i++) assertThat(attempt("203.0.113.5", CODE, "somebody-else", PASSWORD)).isEqualTo(401);
        verify(encoder, times(0)).matches(anyString(), anyString());

        assertThat(attempt("203.0.113.5", CODE, CODE, PASSWORD)).isEqualTo(200);
    }

    @Test
    void shouldKeepOtherChargersAndOtherAddressesWorking_whileOneIsRefused() {
        for (int i = 0; i < 10; i++) attempt("203.0.113.5", CODE, CODE, WRONG);
        assertThat(attempt("203.0.113.5", CODE, CODE, WRONG)).isEqualTo(429);

        assertThat(attempt("203.0.113.5", OTHER_CODE, OTHER_CODE, PASSWORD)).as("same address, other charger").isEqualTo(200);
        assertThat(attempt("198.51.100.9", CODE, CODE, PASSWORD)).as("other address, same charger").isEqualTo(200);
    }

    @Test
    void shouldRecordARefusedAttemptWithItsOwnReason() {
        for (int i = 0; i < 10; i++) attempt("203.0.113.5", CODE, CODE, WRONG);
        writer.rows(OcppConnectionLog.class);   // (rows so far are counted below)
        int rowsBefore = writer.rows(OcppConnectionLog.class).size();

        try (LogCapture capture = LogCapture.atEveryLevel()) {
            attempt("203.0.113.5", CODE, CODE, WRONG);

            List<String> lines = capture.textsFrom(OcppLoggers.HANDSHAKE_NAME);
            assertThat(lines).hasSize(1);
            assertThat(lines.get(0)).startsWith("HANDSHAKE TOO_MANY_FAILURES ");
            assertThat(capture.anyContains(WRONG)).isFalse();
        }
        List<OcppConnectionLog> rows = writer.rows(OcppConnectionLog.class);
        assertThat(rows).hasSize(rowsBefore + 1);
        assertThat(rows.get(rows.size() - 1).getReason()).isEqualTo("TOO_MANY_FAILURES");
        assertThat(rows.get(rows.size() - 1).getEvent()).isEqualTo(OcppConnectionLog.Event.HANDSHAKE_REJECTED);
    }

    @Test
    void shouldTellApartTwoVisitorsBehindTheSameProxy() {
        for (int i = 0; i < 10; i++) attempt("203.0.113.5", CODE, CODE, WRONG);

        // the proxy appends the real visitor's address; whatever a visitor puts further left is ignored
        assertThat(attempt("203.0.113.5, 203.0.113.77", CODE, CODE, PASSWORD)).as("a different visitor").isEqualTo(200);
        assertThat(attempt("1.1.1.1, 203.0.113.5", CODE, CODE, PASSWORD)).as("the same visitor with a faked left side").isEqualTo(429);
    }
}

package com.samjhana.ocpp.diag;

import ch.qos.logback.classic.Level;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.websocket.OcppHandshakeInterceptor;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OcppRequestLoggingFilterTest {

    private RecordingAuditWriter writer;
    private OcppRequestLoggingFilter filter;

    @BeforeEach
    void setUp() {
        writer = new RecordingAuditWriter(new OcppLoggingProperties());
        filter = new OcppRequestLoggingFilter(writer);
    }

    private MockHttpServletRequest get(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setRemoteAddr("203.0.113.9");
        request.addHeader("Upgrade", "websocket");
        request.addHeader("Connection", "Upgrade");
        request.addHeader("Sec-WebSocket-Key", java.util.Base64.getEncoder().encodeToString(new byte[16]));
        request.addHeader("Sec-WebSocket-Version", "13");
        request.addHeader("Sec-WebSocket-Protocol", "ocpp2.0.1");
        request.addHeader("X-Forwarded-For", "198.51.100.7");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "csms.example.org");
        request.addHeader("User-Agent", "HardhitterFirmware/1.0");
        return request;
    }

    private MockHttpServletResponse run(MockHttpServletRequest request, int status) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> ((HttpServletResponse) res).setStatus(status);
        filter.doFilter(request, response, chain);
        return response;
    }

    @Test
    void shouldLogANearMissThatEndsIn404_withItsClassification() throws Exception {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            run(get("/ocpp/HD-D180-CC-01/HD-D180-CC-01"), 404);
            run(get("/ocpp/HD-D180-CC-01/"), 404);
            run(get("/ocpp/HD-D180-CC-01/extra"), 404);
            run(get("/ocpp2.0.1/HD-D180-CC-01"), 404);
            run(get("/ocpp"), 404);

            List<String> lines = capture.textsFrom(OcppLoggers.HANDSHAKE_NAME);
            assertThat(lines).hasSize(5);
            assertThat(lines.get(0)).contains("-> 404").contains("shape=DOUBLED_CHARGE_POINT_ID").contains("reason=DOUBLED_CHARGE_POINT_ID");
            assertThat(lines.get(1)).contains("shape=TRAILING_SLASH");
            assertThat(lines.get(2)).contains("shape=EXTRA_SEGMENT");
            assertThat(lines.get(3)).contains("shape=UNKNOWN_PREFIX");
            assertThat(lines.get(4)).contains("shape=MISSING_CHARGE_POINT_ID");
            assertThat(capture.events(OcppLoggers.HANDSHAKE_NAME, Level.WARN)).hasSize(5);
        }
        List<OcppConnectionLog> rows = writer.rows(OcppConnectionLog.class);
        assertThat(rows).hasSize(5).allSatisfy(row -> {
            assertThat(row.getEvent()).isEqualTo(OcppConnectionLog.Event.REQUEST_NEAR_MISS);
            assertThat(row.getHttpStatus()).isEqualTo(404);
            assertThat(row.getRemoteAddr()).isEqualTo("203.0.113.9");
            assertThat(row.getForwardedFor()).isEqualTo("198.51.100.7");
            assertThat(row.getUserAgent()).isEqualTo("HardhitterFirmware/1.0");
            assertThat(row.getOfferedProtocols()).isEqualTo("ocpp2.0.1");
        });
        assertThat(rows).extracting(OcppConnectionLog::getReason).containsExactly("DOUBLED_CHARGE_POINT_ID",
                "TRAILING_SLASH", "EXTRA_SEGMENT", "UNKNOWN_PREFIX", "MISSING_CHARGE_POINT_ID");
    }

    @Test
    void shouldLogHeadersAndMethodAndForwardedValues_forEveryRequest() throws Exception {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            run(get("/ocpp/HD-D180-CC-01"), 101);

            String line = capture.textsFrom(OcppLoggers.HANDSHAKE_NAME).get(0);
            assertThat(line).startsWith("REQUEST GET /ocpp/HD-D180-CC-01 -> 101").contains("shape=EXPECTED")
                    .contains("remote=203.0.113.9").contains("xForwardedFor=198.51.100.7")
                    .contains("offeredProtocols=[ocpp2.0.1]").contains("userAgent=HardhitterFirmware/1.0")
                    .contains("upgrade=websocket").contains("connection=Upgrade").contains("secWebSocketVersion=13")
                    .contains("secWebSocketKey=present").contains("xForwardedProto=https")
                    .contains("xForwardedHost=csms.example.org")
                    .contains("handledBy=none (rejected before the handshake interceptor)");
            assertThat(capture.events(OcppLoggers.HANDSHAKE_NAME, Level.INFO)).hasSize(1);
            assertThat(capture.events().get(0).getMDCPropertyMap()).containsEntry("chargePointId", "HD-D180-CC-01");
        }
        // an ordinary request (with nothing wrong) is not stored: the interceptor owns the row
        assertThat(writer.rows).isEmpty();
    }

    @Test
    void shouldLogHeaderNamesOnly_forAuthorizationAndCookie() throws Exception {
        String basic = "val-" + java.util.UUID.randomUUID();
        String cookie = "val-" + java.util.UUID.randomUUID();
        MockHttpServletRequest request = get("/ocpp/HD-D180-CC-01/extra");
        request.addHeader("Authorization", "Basic " + basic);
        request.addHeader("Cookie", "session=" + cookie);

        try (LogCapture capture = LogCapture.atEveryLevel()) {
            run(request, 404);

            assertThat(capture.textsFrom(OcppLoggers.HANDSHAKE_NAME).get(0)).contains("headersPresentNotLogged=[Authorization, Cookie]");
            assertThat(capture.anyContains(basic)).isFalse();
            assertThat(capture.anyContains(cookie)).isFalse();
        }
        assertThat(writer.dump()).doesNotContain(basic).doesNotContain(cookie)
                .contains("Authorization");
    }

    @Test
    void shouldMaskCredentialLookingQueryParameters() throws Exception {
        String first = "val-" + java.util.UUID.randomUUID();
        String second = "val-" + java.util.UUID.randomUUID();
        MockHttpServletRequest request = get("/ocpp/HD-D180-CC-01/extra");
        request.setQueryString("password=" + first + "&token=" + second + "&Authorization=Basic%20xyz&debug=1&flag");

        try (LogCapture capture = LogCapture.atEveryLevel()) {
            run(request, 404);

            String line = capture.textsFrom(OcppLoggers.HANDSHAKE_NAME).get(0);
            assertThat(line).contains("?password=***&token=***&Authorization=***&debug=1&flag");
            assertThat(capture.anyContains(first)).isFalse();
            assertThat(capture.anyContains(second)).isFalse();
        }
        assertThat(writer.dump()).doesNotContain(first).doesNotContain(second);
    }

    @Test
    void shouldRecordAnOriginRejection_whenTheRequestDiesWith403AndAnOriginHeader() throws Exception {
        MockHttpServletRequest request = get("/ocpp/HD-D180-CC-01");
        request.addHeader("Origin", "https://evil.example");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            run(request, 403);

            assertThat(capture.textsFrom(OcppLoggers.HANDSHAKE_NAME).get(0)).contains("-> 403").contains("reason=ORIGIN_REJECTED")
                    .contains("origin=https://evil.example");
        }
        OcppConnectionLog row = writer.rows(OcppConnectionLog.class).get(0);
        assertThat(row.getEvent()).isEqualTo(OcppConnectionLog.Event.HANDSHAKE_REJECTED);
        assertThat(row.getReason()).isEqualTo("ORIGIN_REJECTED");
    }

    @Test
    void shouldRecordRequestsRejectedBeforeTheInterceptor_evenWhenTheUrlIsCorrect() throws Exception {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            run(get("/ocpp/HD-D180-CC-01"), 404);

            assertThat(capture.textsFrom(OcppLoggers.HANDSHAKE_NAME).get(0)).contains("reason=HTTP_404_BEFORE_HANDSHAKE");
        }
        assertThat(writer.rows(OcppConnectionLog.class)).singleElement()
                .satisfies(row -> assertThat(row.getReason()).isEqualTo("HTTP_404_BEFORE_HANDSHAKE"));
    }

    @Test
    void shouldRecordAFailedUpgrade_whenTheInterceptorAcceptedButTheResponseWasNot101() throws Exception {
        MockHttpServletRequest request = get("/ocpp/HD-D180-CC-01");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> {
            req.setAttribute(OcppHandshakeInterceptor.REQUEST_OUTCOME_ATTRIBUTE, "ACCEPTED");
            ((HttpServletResponse) res).setStatus(400);
        };

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            filter.doFilter(request, response, chain);

            assertThat(capture.textsFrom(OcppLoggers.HANDSHAKE_NAME).get(0)).contains("reason=UPGRADE_FAILED_HTTP_400")
                    .contains("handledBy=handshake interceptor");
        }
        assertThat(writer.rows(OcppConnectionLog.class)).singleElement()
                .satisfies(row -> assertThat(row.getReason()).isEqualTo("UPGRADE_FAILED_HTTP_400"));
    }

    @Test
    void shouldIgnoreRequestsOutsideOcpp() throws Exception {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            run(new MockHttpServletRequest("GET", "/api/ev/sessions"), 200);
            run(new MockHttpServletRequest("GET", "/"), 200);

            assertThat(capture.textsFrom(OcppLoggers.HANDSHAKE_NAME)).isEmpty();
        }
        assertThat(writer.rows).isEmpty();
    }

    @Test
    void shouldStillLog_whenTheChainThrows() {
        MockHttpServletRequest request = get("/ocpp/HD-D180-CC-01");
        FilterChain chain = (req, res) -> {
            throw new IllegalStateException("boom");
        };

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            org.assertj.core.api.Assertions.assertThatThrownBy(
                    () -> filter.doFilter(request, new MockHttpServletResponse(), chain)).isInstanceOf(IllegalStateException.class);

            assertThat(capture.textsFrom(OcppLoggers.HANDSHAKE_NAME)).hasSize(1);
        }
    }
}

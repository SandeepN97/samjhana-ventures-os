package com.samjhana.ocpp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.samjhana.config.OcppProperties;
import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.ocpp.diag.LogCapture;
import com.samjhana.ocpp.diag.OcppAuditWriter;
import com.samjhana.ocpp.diag.OcppConnectionState;
import com.samjhana.ocpp.diag.OcppLoggingProperties;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.repository.OcppConnectionLogRepository;
import com.samjhana.websocket.OcppLivenessSweep;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * Finding D-04, on real WebSockets and the real database: a charger whose connection goes quiet is hung up on and shown OFFLINE
 * (even when it never answers the hang-up), a charger that floods the app is cut off, a message above the size cap closes the
 * connection cleanly, and a charger the database shows ONLINE with no connection is corrected.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ChargerConnectionLimitsIntegrationTest {

    private static final String CHARGER_1 = "HD-D180-CC-01";
    private static final String CHARGER_2 = "HQC23-80-01";

    @LocalServerPort int port;
    @Autowired ObjectMapper mapper;
    @Autowired OcppProperties ocppProperties;
    @Autowired OcppLoggingProperties loggingProperties;
    @Autowired ChargePointRepository chargePoints;
    @Autowired OcppConnectionRegistry registry;
    @Autowired OcppLivenessSweep sweep;
    @Autowired OcppAuditWriter auditWriter;
    @Autowired OcppConnectionLogRepository connectionLogs;
    @Autowired ScheduledAnnotationBeanPostProcessor scheduledTasks;

    private final List<WebSocketSession> sockets = new ArrayList<>();
    private final List<Socket> rawSockets = new ArrayList<>();
    private double originalRate;
    private int originalBurst;

    @BeforeEach
    void rememberSettings() {
        originalRate = loggingProperties.getMaxFramesPerSecond();
        originalBurst = loggingProperties.getFrameBurst();
    }

    @AfterEach
    void cleanUp() throws Exception {
        loggingProperties.setMaxFramesPerSecond(originalRate);
        loggingProperties.setFrameBurst(originalBurst);
        for (WebSocketSession socket : sockets) {
            if (socket.isOpen()) socket.close();
        }
        for (Socket raw : rawSockets) {
            raw.close();
        }
        // The server marks a charger OFFLINE after the close; a charger left ONLINE would leak into other test classes.
        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            assertThat(registry.isConnected(CHARGER_1)).isFalse();
            assertThat(registry.isConnected(CHARGER_2)).isFalse();
        });
        for (String code : List.of(CHARGER_1, CHARGER_2)) {
            ChargePoint point = chargePoints.findByCodeAndDeletedAtIsNull(code).orElseThrow();
            if (point.getConnectionStatus() != ChargePoint.ConnectionStatus.OFFLINE) {
                point.setConnectionStatus(ChargePoint.ConnectionStatus.OFFLINE);
                chargePoints.save(point);
            }
        }
    }

    // ------------------------------------------------------------------ the shipped numbers

    @Test
    void shouldShipTheDocumentedDefaults() {
        assertThat(loggingProperties.getCloseFactor()).isEqualTo(3.0);
        assertThat(loggingProperties.getHeartbeatInterval()).isEqualTo(Duration.ofSeconds(30));
        assertThat(loggingProperties.getMaxFramesPerSecond()).isEqualTo(20);
        assertThat(loggingProperties.getFrameBurst()).isEqualTo(60);
        assertThat(loggingProperties.getWebSocketMaxMessageBytes()).isEqualTo(131_072);
    }

    @Test
    void shouldHaveTheLivenessSweepRegisteredWithTheScheduler() {
        List<String> registered = scheduledTasks.getScheduledTasks().stream().map(task -> task.getTask().toString()).toList();

        assertThat(registered).anyMatch(t -> t.endsWith("OcppLivenessSweep.tick"));
    }

    // ------------------------------------------------------------------ silence

    @Test
    void shouldHangUpOnASilentCharger_andShowItOffline() throws Exception {
        Instant testStart = Instant.now();
        Charger charger = connectAndBoot(CHARGER_1);
        assertThat(statusOf(CHARGER_1)).isEqualTo(ChargePoint.ConnectionStatus.ONLINE);

        pretendLastFrameWas(CHARGER_1, Duration.ofMinutes(5));
        sweep.sweep();

        assertThat(charger.awaitClosed().getCode()).isEqualTo(4002);
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(
                () -> assertThat(statusOf(CHARGER_1)).isEqualTo(ChargePoint.ConnectionStatus.OFFLINE));
        assertThat(registry.isConnected(CHARGER_1)).isFalse();
        drainAuditQueue();
        assertThat(connectionLogs.findAll()).filteredOn(r -> !r.getCreatedAt().isBefore(testStart)
                && r.getEvent() == OcppConnectionLog.Event.DISCONNECTED && CHARGER_1.equals(r.getChargePointId())
                && r.getCloseCode() != null && r.getCloseCode() == 4002).hasSize(1);
    }

    @Test
    void shouldLeaveAChargerAlone_whenItKeepsTalking() throws Exception {
        Charger charger = connectAndBoot(CHARGER_1);
        pretendLastFrameWas(CHARGER_1, Duration.ofMinutes(5));

        charger.call("Heartbeat", mapper.createObjectNode()); // any frame restarts the clock
        sweep.sweep();

        assertThat(charger.session.isOpen()).isTrue();
        assertThat(registry.isConnected(CHARGER_1)).isTrue();
        assertThat(statusOf(CHARGER_1)).isEqualTo(ChargePoint.ConnectionStatus.ONLINE);
        charger.call("Heartbeat", mapper.createObjectNode()); // and the connection still works
    }

    @Test
    void shouldShowAChargerOfflineAtOnce_evenWhenItNeverAnswersTheHangUp() throws Exception {
        Socket mute = connectWithoutEverReading(CHARGER_1);
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> assertThat(registry.isConnected(CHARGER_1)).isTrue());
        assertThat(statusOf(CHARGER_1)).isEqualTo(ChargePoint.ConnectionStatus.ONLINE);

        pretendLastFrameWas(CHARGER_1, Duration.ofMinutes(5));
        sweep.sweep();

        // no close frame comes back from the mute side, yet the app does not wait for one
        await().atMost(3, TimeUnit.SECONDS).untilAsserted(
                () -> assertThat(statusOf(CHARGER_1)).isEqualTo(ChargePoint.ConnectionStatus.OFFLINE));
        assertThat(registry.isConnected(CHARGER_1)).isFalse();
        assertThat(mute.isClosed()).as("our test side never closed it").isFalse();
    }

    @Test
    void shouldCorrectAnOnlineRowThatHasNoConnection_butNotOneHeardFromRecently() throws Exception {
        ChargePoint stale = chargePoints.findByCodeAndDeletedAtIsNull(CHARGER_1).orElseThrow();
        stale.setConnectionStatus(ChargePoint.ConnectionStatus.ONLINE);
        stale.setLastHeartbeatAt(LocalDateTime.now().minusMinutes(10));
        chargePoints.save(stale);
        ChargePoint recent = chargePoints.findByCodeAndDeletedAtIsNull(CHARGER_2).orElseThrow();
        recent.setConnectionStatus(ChargePoint.ConnectionStatus.ONLINE);
        recent.setLastHeartbeatAt(LocalDateTime.now().minusSeconds(5));
        chargePoints.save(recent);

        sweep.sweep();

        assertThat(statusOf(CHARGER_1)).as("not heard from for 10 minutes and no connection").isEqualTo(ChargePoint.ConnectionStatus.OFFLINE);
        assertThat(statusOf(CHARGER_2)).as("heard from five seconds ago").isEqualTo(ChargePoint.ConnectionStatus.ONLINE);
    }

    @Test
    void shouldNotTouchAConnectedChargerWhoseRowLooksOld() throws Exception {
        Charger charger = connectAndBoot(CHARGER_1);
        ChargePoint point = chargePoints.findByCodeAndDeletedAtIsNull(CHARGER_1).orElseThrow();
        point.setLastHeartbeatAt(LocalDateTime.now().minusMinutes(10)); // e.g. it only sends TransactionEvents
        chargePoints.save(point);

        sweep.sweep();

        assertThat(statusOf(CHARGER_1)).isEqualTo(ChargePoint.ConnectionStatus.ONLINE);
        assertThat(charger.session.isOpen()).isTrue();
    }

    // ------------------------------------------------------------------ floods

    @Test
    void shouldCutOffAChargerThatFloodsTheApp() throws Exception {
        Instant testStart = Instant.now();
        loggingProperties.setMaxFramesPerSecond(1);
        loggingProperties.setFrameBurst(10);
        Charger charger = connectAndBoot(CHARGER_1); // two frames of the allowance of 10
        OcppConnectionState state = registry.connections().stream()
                .filter(c -> CHARGER_1.equals(c.state().chargePointCode())).findFirst().orElseThrow().state();

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            for (int i = 0; i < 300; i++) {
                if (!charger.session.isOpen()) break;
                try {
                    charger.session.sendMessage(new TextMessage("[2,\"flood-" + i + "\",\"Heartbeat\",{}]"));
                } catch (Exception closedUnderUs) {
                    break;
                }
            }

            assertThat(charger.awaitClosed().getCode()).isEqualTo(1008);
            assertThat(capture.matching("FLOOD chargePointId=" + CHARGER_1)).hasSize(1);
        }
        assertThat(state.framesIn().get()).as("far fewer than the 300 sent were handled").isLessThanOrEqualTo(30);
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(
                () -> assertThat(statusOf(CHARGER_1)).isEqualTo(ChargePoint.ConnectionStatus.OFFLINE));
        drainAuditQueue();
        assertThat(connectionLogs.findAll()).filteredOn(r -> !r.getCreatedAt().isBefore(testStart)
                && r.getEvent() == OcppConnectionLog.Event.DISCONNECTED && CHARGER_1.equals(r.getChargePointId())
                && r.getCloseCode() != null && r.getCloseCode() == 1008).hasSize(1);
    }

    @Test
    void shouldNeverCutOffAChargerAtItsNormalPace_orInItsStartUpBurst() throws Exception {
        Charger charger = connectAndBoot(CHARGER_1);

        for (int i = 0; i < 40; i++) { // a start-up burst: forty frames as fast as the replies come back
            JsonNode reply = charger.call("Heartbeat", mapper.createObjectNode());
            assertThat(reply.get(0).asInt()).isEqualTo(3);
        }

        assertThat(charger.session.isOpen()).isTrue();
    }

    @Test
    void shouldNotLimitAnything_whenTheRateIsSwitchedOff() throws Exception {
        loggingProperties.setMaxFramesPerSecond(0);
        loggingProperties.setFrameBurst(2);
        Charger charger = connectAndBoot(CHARGER_1);

        for (int i = 0; i < 100; i++) {
            assertThat(charger.call("Heartbeat", mapper.createObjectNode()).get(0).asInt()).isEqualTo(3);
        }

        assertThat(charger.session.isOpen()).isTrue();
    }

    // ------------------------------------------------------------------ message size

    @Test
    void shouldCloseCleanlyWith1009_whenAMessageIsAboveTheSizeCap() throws Exception {
        Charger charger = connectAndBoot(CHARGER_1);
        int cap = loggingProperties.getWebSocketMaxMessageBytes();

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            charger.session.sendMessage(new TextMessage(paddedHeartbeat("too-big", cap + 4096)));

            assertThat(charger.awaitClosed().getCode()).isEqualTo(1009);
            await().atMost(5, TimeUnit.SECONDS).untilAsserted(
                    () -> assertThat(statusOf(CHARGER_1)).isEqualTo(ChargePoint.ConnectionStatus.OFFLINE));
            assertThat(capture.matching("Handler failed")).as("the message never reached the handler").isEmpty();
        }
    }

    @Test
    void shouldAnswerAMessageJustUnderTheSizeCap() throws Exception {
        Charger charger = connectAndBoot(CHARGER_1);
        int cap = loggingProperties.getWebSocketMaxMessageBytes();

        JsonNode reply = charger.callRaw("big-ok", paddedHeartbeat("big-ok", cap - 2048));

        assertThat(reply.get(0).asInt()).isEqualTo(3);
        assertThat(charger.session.isOpen()).isTrue();
    }

    // ------------------------------------------------------------------ helpers

    private String paddedHeartbeat(String messageId, int totalBytes) {
        String head = "[2,\"" + messageId + "\",\"Heartbeat\",{\"pad\":\"";
        String tail = "\"}]";
        return head + "x".repeat(totalBytes - head.length() - tail.length()) + tail;
    }

    private ChargePoint.ConnectionStatus statusOf(String code) {
        return chargePoints.findByCodeAndDeletedAtIsNull(code).orElseThrow().getConnectionStatus();
    }

    private void pretendLastFrameWas(String code, Duration ago) {
        registry.connections().stream().filter(c -> code.equals(c.state().chargePointCode())).findFirst().orElseThrow()
                .state().lastFrameAt(Instant.now().minus(ago));
    }

    private void drainAuditQueue() {
        int guard = 0;
        while (auditWriter.flush() > 0 && guard++ < 1000) {
            // keep going until the queue is empty
        }
    }

    private Charger connectAndBoot(String code) throws Exception {
        Charger charger = new Charger();
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.setSecWebSocketProtocol("ocpp2.0.1");
        headers.setBasicAuth(code, ocppProperties.secretFor(code));
        charger.session = new StandardWebSocketClient()
                .execute(charger, headers, URI.create("ws://localhost:" + port + "/ocpp/" + code))
                .get(5, TimeUnit.SECONDS);
        sockets.add(charger.session);

        ObjectNode boot = mapper.createObjectNode();
        boot.put("reason", "PowerUp");
        boot.putObject("chargingStation").put("model", "TEST").put("vendorName", "Sim").put("serialNumber", "SN-" + code);
        assertThat(charger.call("BootNotification", boot).get(2).get("status").asText()).isEqualTo("Accepted");
        ObjectNode status = mapper.createObjectNode();
        status.put("timestamp", OffsetDateTime.now().toString());
        status.put("connectorStatus", "Available");
        status.put("evseId", 1);
        status.put("connectorId", 1);
        charger.call("StatusNotification", status);
        return charger;
    }

    /** Opens the WebSocket by hand and then never reads or writes again: a charger whose end has gone dead. */
    private Socket connectWithoutEverReading(String code) throws Exception {
        Socket socket = new Socket("localhost", port);
        rawSockets.add(socket);
        socket.setSoTimeout(5000);
        String key = Base64.getEncoder().encodeToString(UUID.randomUUID().toString().substring(0, 16).getBytes(StandardCharsets.US_ASCII));
        String credentials = Base64.getEncoder().encodeToString((code + ":" + ocppProperties.secretFor(code)).getBytes(StandardCharsets.UTF_8));
        String request = "GET /ocpp/" + code + " HTTP/1.1\r\n"
                + "Host: localhost:" + port + "\r\n"
                + "Upgrade: websocket\r\n"
                + "Connection: Upgrade\r\n"
                + "Sec-WebSocket-Key: " + key + "\r\n"
                + "Sec-WebSocket-Version: 13\r\n"
                + "Sec-WebSocket-Protocol: ocpp2.0.1\r\n"
                + "Authorization: Basic " + credentials + "\r\n\r\n";
        OutputStream out = socket.getOutputStream();
        out.write(request.getBytes(StandardCharsets.US_ASCII));
        out.flush();
        InputStream in = socket.getInputStream();
        StringBuilder head = new StringBuilder();
        while (!head.toString().endsWith("\r\n\r\n")) {
            int next = in.read();
            if (next < 0) throw new AssertionError("the server closed during the handshake: " + head);
            head.append((char) next);
        }
        assertThat(head.toString()).startsWith("HTTP/1.1 101");
        return socket;
    }

    /** A fake charger that remembers how its connection was closed. */
    private final class Charger extends TextWebSocketHandler {
        private final BlockingQueue<JsonNode> inbox = new LinkedBlockingQueue<>();
        private final AtomicReference<CloseStatus> closedWith = new AtomicReference<>();
        WebSocketSession session;

        @Override
        protected void handleTextMessage(WebSocketSession s, TextMessage message) throws Exception {
            inbox.add(mapper.readTree(message.getPayload()));
        }

        @Override
        public void afterConnectionClosed(WebSocketSession s, CloseStatus status) {
            closedWith.set(status);
        }

        CloseStatus awaitClosed() {
            await().atMost(10, TimeUnit.SECONDS).until(() -> closedWith.get() != null);
            return closedWith.get();
        }

        JsonNode call(String action, ObjectNode payload) throws Exception {
            String messageId = UUID.randomUUID().toString();
            return callRaw(messageId, mapper.createArrayNode().add(2).add(messageId).add(action).add(payload).toString());
        }

        JsonNode callRaw(String messageId, String frame) throws Exception {
            session.sendMessage(new TextMessage(frame));
            long deadline = System.currentTimeMillis() + 5_000;
            while (System.currentTimeMillis() < deadline) {
                JsonNode next = inbox.poll(200, TimeUnit.MILLISECONDS);
                if (next != null && messageId.equals(next.get(1).asText())) return next;
            }
            throw new AssertionError("No reply to " + messageId + " within 5s");
        }
    }
}

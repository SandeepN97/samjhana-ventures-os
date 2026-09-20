package com.samjhana.ocpp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.samjhana.config.OcppProperties;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.EvVehicle;
import com.samjhana.entity.User;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.repository.ChargeSessionRepository;
import com.samjhana.repository.EvVehicleRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end proof of the architecture: a simulated OCPP 2.0.1 charger connects to the
 * real CSMS over a real WebSocket while staff drive the REST API, and the session moves
 * through start → live meter data → stop (connector stays locked) → payment → unlock.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ChargerSessionFlowIntegrationTest {

    private static final String CHARGER_1 = "HD-D180-CC-01";
    private static final String CHARGER_2 = "HQC23-80-01";

    @LocalServerPort int port;
    @Autowired TestRestTemplate rest;
    @Autowired ObjectMapper mapper;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired ChargePointRepository chargePointRepository;
    @Autowired ChargeSessionRepository chargeSessionRepository;
    @Autowired EvVehicleRepository evVehicleRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired OcppProperties ocppProperties;

    private String token;
    private String dfacId; // catalog vehicle priced Rs 14 per 1% charged
    private final List<TextWebSocketHandler> handlers = new ArrayList<>();
    private final List<WebSocketSession> sockets = new ArrayList<>();

    // ------------------------------------------------------------------ fixtures

    @BeforeEach
    void fixtures() {
        if (userRepository.findByUsername("ev-flow-admin").isEmpty()) {
            userRepository.save(User.builder()
                    .username("ev-flow-admin")
                    .passwordHash(passwordEncoder.encode("not-used"))
                    .fullName("EV Flow Admin")
                    .fullNameNepali("ईभी प्रशासक")
                    .role(User.UserRole.ADMIN)
                    .build());
        }
        token = jwtUtil.generateToken("ev-flow-admin");

        if (businessUnitRepository.findByCode(BusinessUnit.CODE_EV).isEmpty()) {
            businessUnitRepository.save(BusinessUnit.builder()
                    .code(BusinessUnit.CODE_EV).name("EV Charging").nameNepali("ईभी चार्जिङ")
                    .icon("⚡").calculationStrategy("EVStrategy").displayOrder(2).build());
        }
        if (dfacId == null) {
            dfacId = evVehicleRepository.save(EvVehicle.builder()
                    .vehicleName("DFAC EV 32 (flow test)").batteryCapacityKw(new java.math.BigDecimal("53.58"))
                    .seatingCapacity(14).ratePerPercent(new java.math.BigDecimal("14")).isActive(true).build())
                    .getId().toString();
        }
        setLockBehavior(CHARGER_1, ChargePoint.LockBehavior.EXPLICIT_UNLOCK);
    }

    @AfterEach
    void cleanup() throws Exception {
        for (WebSocketSession socket : sockets) {
            if (socket.isOpen()) socket.close();
        }
        sockets.clear();
        handlers.clear();
        chargeSessionRepository.deleteAll();
        setLockBehavior(CHARGER_1, ChargePoint.LockBehavior.EXPLICIT_UNLOCK);
    }

    // ------------------------------------------------------------------ happy path

    @Test
    void shouldRunFullSession_whenChargerIsExplicitUnlock() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        long transactionsBefore = transactionRepository.count();

        JsonNode started = startSession(CHARGER_1, "BA 1 PA 4521", 80, dfacId);
        String id = started.get("id").asText();
        assertThat(started.get("status").asText()).isEqualTo("STARTING");
        // The vehicle's price per 1% is copied into the session at start.
        assertThat(started.get("ratePerPercent").decimalValue()).isEqualByComparingTo("14");
        assertThat(started.get("vehicleCatalogName").asText()).contains("DFAC EV 32");

        JsonNode startCall = charger.awaitCall("RequestStartTransaction");
        assertThat(startCall.get(3).get("evseId").asInt()).isEqualTo(1);
        assertThat(startCall.get(3).get("idToken").get("idToken").asText()).isEqualTo("BA1PA4521");
        charger.reply(startCall, "Accepted");

        charger.call("TransactionEvent", txEvent("Started", 0, "TX-1", 32, 1_000_000));
        awaitStatus(id, "ACTIVE");

        charger.call("TransactionEvent", txEvent("Updated", 1, "TX-1", 50, 1_006_000));
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
            JsonNode live = session(id);
            assertThat(live.get("currentSoc").asInt()).isEqualTo(50);
            assertThat(live.get("energyDeliveredKwh").decimalValue()).isEqualByComparingTo("6.000");
            // Charged by car type and percentage: 32% -> 50% is 18% x Rs 14 = Rs 252.
            assertThat(live.get("percentCharged").asInt()).isEqualTo(18);
            assertThat(live.get("suggestedAmount").decimalValue()).isEqualByComparingTo("252.00");
        });

        // A replayed / out-of-order event must not move the numbers backwards.
        charger.call("TransactionEvent", txEvent("Updated", 1, "TX-1", 99, 9_999_000));
        assertThat(session(id).get("currentSoc").asInt()).isEqualTo(50);

        // Stop: power stops but the connector must stay locked until payment.
        assertThat(post("/api/ev/sessions/" + id + "/stop", null).getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode stopCall = charger.awaitCall("RequestStopTransaction");
        assertThat(stopCall.get(3).get("transactionId").asText()).isEqualTo("TX-1");
        charger.reply(stopCall, "Accepted");
        charger.call("TransactionEvent", txEvent("Ended", 2, "TX-1", 60, 1_007_500));
        awaitStatus(id, "AWAITING_PAYMENT");
        charger.assertNoCall("UnlockConnector");

        // Unlock is refused while unpaid.
        assertThat(post("/api/ev/sessions/" + id + "/unlock", null).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // Payment triggers the unlock command, then the session closes and is booked.
        ResponseEntity<JsonNode> paid = post("/api/ev/sessions/" + id + "/mark-paid",
                Map.of("method", "CASH", "amount", 600));
        assertThat(paid.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(paid.getBody().get("status").asText()).isEqualTo("UNLOCK_REQUESTED");

        JsonNode unlockCall = charger.awaitCall("UnlockConnector");
        charger.reply(unlockCall, "Unlocked");
        awaitStatus(id, "CLOSED");

        JsonNode closed = session(id);
        assertThat(closed.get("paymentMethod").asText()).isEqualTo("CASH");
        assertThat(closed.get("amount").decimalValue()).isEqualByComparingTo("600");
        assertThat(closed.get("energyDeliveredKwh").decimalValue()).isEqualByComparingTo("7.500");
        assertThat(transactionRepository.count()).isEqualTo(transactionsBefore + 1);

        // The charger is free again for the next customer.
        assertThat(get("/api/ev/sessions/active").getBody().size()).isZero();
    }

    @Test
    void shouldLeaveTheAmountToStaff_whenTheCustomerIsAWalkInWithNoVehicleType() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String id = startSession(CHARGER_1, "BA 9 PA 0009", 80).get("id").asText();
        charger.reply(charger.awaitCall("RequestStartTransaction"), "Accepted");
        charger.call("TransactionEvent", txEvent("Started", 0, "TX-W", 30, 0));
        awaitStatus(id, "ACTIVE");
        charger.call("TransactionEvent", txEvent("Updated", 1, "TX-W", 50, 5_000));

        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
            JsonNode live = session(id);
            assertThat(live.get("percentCharged").asInt()).isEqualTo(20);
            assertThat(live.get("ratePerPercent").isNull()).isTrue();
            assertThat(live.get("suggestedAmount").isNull()).isTrue();
        });
    }

    @Test
    void shouldHoldChargeUntilPaid_whenChargerUnlocksAutomaticallyOnStop() throws Exception {
        setLockBehavior(CHARGER_1, ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP);
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String id = startSession(CHARGER_1, "BA 2 PA 1111", 90).get("id").asText();
        charger.reply(charger.awaitCall("RequestStartTransaction"), "Accepted");
        charger.call("TransactionEvent", txEvent("Started", 0, "TX-A", 20, 500_000));
        awaitStatus(id, "ACTIVE");

        // "Stop" must NOT stop power (that would unlock the cable before payment).
        assertThat(post("/api/ev/sessions/" + id + "/stop", null).getStatusCode()).isEqualTo(HttpStatus.OK);
        awaitStatus(id, "AWAITING_PAYMENT");
        charger.assertNoCall("RequestStopTransaction");

        // Paying is what finally stops the charge (and the hardware unlocks with it).
        assertThat(post("/api/ev/sessions/" + id + "/mark-paid",
                Map.of("method", "ESEWA", "amount", 250)).getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode stopCall = charger.awaitCall("RequestStopTransaction");
        charger.reply(stopCall, "Accepted");
        charger.call("TransactionEvent", txEvent("Ended", 1, "TX-A", 45, 503_000));
        awaitStatus(id, "CLOSED");
    }

    @Test
    void shouldStopAutomatically_whenTargetPercentIsReached() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String id = startSession(CHARGER_1, "BA 3 PA 2222", 60).get("id").asText();
        charger.reply(charger.awaitCall("RequestStartTransaction"), "Accepted");
        charger.call("TransactionEvent", txEvent("Started", 0, "TX-T", 32, 0));
        awaitStatus(id, "ACTIVE");

        charger.call("TransactionEvent", txEvent("Updated", 1, "TX-T", 61, 5_000));

        JsonNode autoStop = charger.awaitCall("RequestStopTransaction");
        assertThat(autoStop.get(3).get("transactionId").asText()).isEqualTo("TX-T");
        awaitStatus(id, "STOP_REQUESTED");
    }

    // ------------------------------------------------------------------ failure paths

    @Test
    void shouldFailSession_whenChargerRejectsStartCommand() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String id = startSession(CHARGER_1, "BA 4 PA 3333", 80).get("id").asText();

        charger.reply(charger.awaitCall("RequestStartTransaction"), "Rejected");

        awaitStatus(id, "FAILED");
        assertThat(session(id).get("statusMessage").asText()).containsIgnoringCase("rejected");
        // A failed session frees the charger.
        assertThat(get("/api/ev/sessions/active").getBody().size()).isZero();
    }

    @Test
    void shouldReturnConflict_whenStartingOnOfflineCharger() {
        // Charger 2 never connects in this test.
        ResponseEntity<JsonNode> response = post("/api/ev/sessions/start", startBody(CHARGER_2, "BA 5 PA 4444", 80));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().toString()).containsIgnoringCase("offline");
    }

    @Test
    void shouldReturnConflict_whenChargerAlreadyHasOpenSession() throws Exception {
        connectAndBoot(CHARGER_1);
        assertThat(post("/api/ev/sessions/start", startBody(CHARGER_1, "BA 6 PA 5555", 80)).getStatusCode())
                .isEqualTo(HttpStatus.OK);

        ResponseEntity<JsonNode> second = post("/api/ev/sessions/start", startBody(CHARGER_1, "BA 7 PA 6666", 80));

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(second.getBody().toString()).containsIgnoringCase("open session");
    }

    @Test
    void shouldRejectInvalidRequests_whenPlateOrTargetIsInvalid() throws Exception {
        connectAndBoot(CHARGER_1);

        assertThat(post("/api/ev/sessions/start", startBody(CHARGER_1, "", 80)).getStatusCode().is4xxClientError()).isTrue();
        assertThat(post("/api/ev/sessions/start", startBody(CHARGER_1, "BA 8 PA 7777", 0)).getStatusCode().is4xxClientError()).isTrue();
        assertThat(post("/api/ev/sessions/start", startBody(CHARGER_1, "BA 8 PA 7777", 101)).getStatusCode().is4xxClientError()).isTrue();
        assertThat(get("/api/ev/sessions/active").getBody().size()).isZero();
    }

    @Test
    void shouldRefuseTransitions_whenSessionIsInWrongState() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String id = startSession(CHARGER_1, "BA 9 PA 8888", 80).get("id").asText();
        charger.reply(charger.awaitCall("RequestStartTransaction"), "Accepted");

        // Still STARTING: cannot stop or take payment yet.
        assertThat(post("/api/ev/sessions/" + id + "/stop", null).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(post("/api/ev/sessions/" + id + "/mark-paid", Map.of("method", "CASH", "amount", 100))
                .getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void shouldRejectPayment_whenAmountIsNotPositiveOrMethodUnknown() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String id = startSession(CHARGER_1, "BA 1 PA 9999", 80).get("id").asText();
        charger.reply(charger.awaitCall("RequestStartTransaction"), "Accepted");
        charger.call("TransactionEvent", txEvent("Started", 0, "TX-P", 30, 0));
        awaitStatus(id, "ACTIVE");
        post("/api/ev/sessions/" + id + "/stop", null);
        charger.reply(charger.awaitCall("RequestStopTransaction"), "Accepted");
        charger.call("TransactionEvent", txEvent("Ended", 1, "TX-P", 40, 2_000));
        awaitStatus(id, "AWAITING_PAYMENT");

        assertThat(post("/api/ev/sessions/" + id + "/mark-paid", Map.of("method", "CASH", "amount", 0))
                .getStatusCode().is4xxClientError()).isTrue();
        assertThat(post("/api/ev/sessions/" + id + "/mark-paid", Map.of("method", "BANK", "amount", 100))
                .getStatusCode().is4xxClientError()).isTrue();
        assertThat(session(id).get("status").asText()).isEqualTo("AWAITING_PAYMENT");
    }

    // ------------------------------------------------------------------ security

    @Test
    void shouldRequireLogin_whenCallingSessionApiWithoutToken() {
        ResponseEntity<JsonNode> response = rest.exchange("/api/ev/sessions/active", HttpMethod.GET,
                new HttpEntity<>(new HttpHeaders()), JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldRefuseChargerConnection_whenSecretIsWrongOrChargerUnknown() {
        assertThatThrownBy(() -> connect(CHARGER_1, "wrong-secret")).isInstanceOf(ExecutionException.class);
        assertThatThrownBy(() -> connect("NOT-A-CHARGER-01", "anything")).isInstanceOf(ExecutionException.class);
        assertThat(sockets).isEmpty();
    }

    @Test
    void shouldRefuseKioskConnection_whenTokenIsMissingOrInvalid() {
        assertThatThrownBy(() -> connectKiosk("not-a-jwt")).isInstanceOf(ExecutionException.class);
        assertThatThrownBy(() -> connectKiosk("")).isInstanceOf(ExecutionException.class);
    }

    // ------------------------------------------------------------------ protocol + live push

    @Test
    void shouldAnswerWithCallError_whenChargerSendsMalformedOrUnsupportedFrames() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);

        JsonNode notJson = charger.sendRaw("this is not json");
        assertThat(notJson.get(0).asInt()).isEqualTo(4);
        assertThat(notJson.get(2).asText()).isEqualTo("FormationViolation");

        JsonNode unsupported = charger.call("DataTransfer", mapper.createObjectNode().put("vendorId", "x"));
        assertThat(unsupported.get(0).asInt()).isEqualTo(4);
        assertThat(unsupported.get(2).asText()).isEqualTo("NotSupported");
    }

    @Test
    void shouldPushLiveEventsToKiosk_whenSessionAndChargerChange() throws Exception {
        KioskListener kiosk = connectKiosk(token);
        assertThat(kiosk.awaitEvent("CONNECTED", e -> true)).isNotNull();

        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        JsonNode chargerEvent = kiosk.awaitEvent("CHARGE_POINT_UPDATED",
                e -> CHARGER_1.equals(e.get("payload").get("code").asText())
                        && "ONLINE".equals(e.get("payload").get("connectionStatus").asText()));
        assertThat(chargerEvent).isNotNull();

        startSession(CHARGER_1, "BA 2 PA 0001", 80);
        JsonNode sessionEvent = kiosk.awaitEvent("CHARGE_SESSION_UPDATED",
                e -> "STARTING".equals(e.get("payload").get("status").asText()));
        assertThat(sessionEvent.get("payload").get("chargePointCode").asText()).isEqualTo(CHARGER_1);

        charger.reply(charger.awaitCall("RequestStartTransaction"), "Accepted");
    }

    @Test
    void shouldMarkChargerOffline_whenItDisconnects() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(
                () -> assertThat(chargerStatus(CHARGER_1)).isEqualTo("ONLINE"));

        charger.session.close();

        await().atMost(5, TimeUnit.SECONDS).untilAsserted(
                () -> assertThat(chargerStatus(CHARGER_1)).isEqualTo("OFFLINE"));
    }

    // ------------------------------------------------------------------ helpers: REST

    private ResponseEntity<JsonNode> get(String path) {
        return rest.exchange(path, HttpMethod.GET, new HttpEntity<>(authHeaders()), JsonNode.class);
    }

    private ResponseEntity<JsonNode> post(String path, Object body) {
        return rest.exchange(path, HttpMethod.POST, new HttpEntity<>(body, authHeaders()), JsonNode.class);
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private JsonNode session(String id) {
        return get("/api/ev/sessions/" + id).getBody();
    }

    private void awaitStatus(String id, String status) {
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(
                () -> assertThat(session(id).get("status").asText()).isEqualTo(status));
    }

    private String chargerStatus(String code) {
        for (JsonNode point : get("/api/charge-points").getBody()) {
            if (code.equals(point.get("code").asText())) return point.get("connectionStatus").asText();
        }
        return null;
    }

    private Map<String, Object> startBody(String code, String plate, int targetPercent) {
        return Map.of("chargePointId", chargePointId(code), "plateNumber", plate, "targetPercent", targetPercent);
    }

    private JsonNode startSession(String code, String plate, int targetPercent) {
        return startSession(code, plate, targetPercent, null);
    }

    private JsonNode startSession(String code, String plate, int targetPercent, String vehicleCatalogId) {
        Map<String, Object> body = new java.util.HashMap<>(startBody(code, plate, targetPercent));
        if (vehicleCatalogId != null) body.put("vehicleCatalogId", vehicleCatalogId);
        ResponseEntity<JsonNode> response = post("/api/ev/sessions/start", body);
        assertThat(response.getStatusCode()).as("start session: %s", response.getBody()).isEqualTo(HttpStatus.OK);
        return response.getBody();
    }

    private String chargePointId(String code) {
        return chargePointRepository.findByCodeAndDeletedAtIsNull(code).orElseThrow().getId().toString();
    }

    private void setLockBehavior(String code, ChargePoint.LockBehavior behavior) {
        ChargePoint point = chargePointRepository.findByCodeAndDeletedAtIsNull(code).orElseThrow();
        point.setLockBehavior(behavior);
        chargePointRepository.save(point);
    }

    // ------------------------------------------------------------------ helpers: OCPP

    private ObjectNode txEvent(String eventType, int seqNo, String transactionId, int soc, long energyWh) {
        ObjectNode payload = mapper.createObjectNode();
        payload.put("eventType", eventType);
        payload.put("timestamp", OffsetDateTime.now().toString());
        payload.put("triggerReason", "Trigger");
        payload.put("seqNo", seqNo);
        payload.putObject("transactionInfo").put("transactionId", transactionId);
        ObjectNode meterValue = payload.putArray("meterValue").addObject();
        meterValue.putArray("sampledValue").addObject().put("value", soc).put("measurand", "SoC");
        meterValue.withArray("sampledValue").addObject()
                .put("value", energyWh).put("measurand", "Energy.Active.Import.Register");
        return payload;
    }

    private SimulatedCharger connectAndBoot(String code) throws Exception {
        SimulatedCharger charger = connect(code, ocppProperties.secretFor(code));

        ObjectNode boot = mapper.createObjectNode();
        boot.put("reason", "PowerUp");
        boot.putObject("chargingStation").put("model", "TEST").put("vendorName", "Sim")
                .put("serialNumber", "SN-" + code);
        JsonNode bootResult = charger.call("BootNotification", boot);
        assertThat(bootResult.get(0).asInt()).isEqualTo(3);
        assertThat(bootResult.get(2).get("status").asText()).isEqualTo("Accepted");

        ObjectNode status = mapper.createObjectNode();
        status.put("timestamp", OffsetDateTime.now().toString());
        status.put("connectorStatus", "Available");
        status.put("evseId", 1);
        status.put("connectorId", 1);
        charger.call("StatusNotification", status);
        return charger;
    }

    private SimulatedCharger connect(String code, String secret) throws Exception {
        SimulatedCharger charger = new SimulatedCharger();
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.setSecWebSocketProtocol("ocpp2.0.1");
        headers.setBasicAuth(code, secret);
        charger.session = new StandardWebSocketClient()
                .execute(charger, headers, URI.create("ws://localhost:" + port + "/ocpp/" + code))
                .get(5, TimeUnit.SECONDS);
        handlers.add(charger);
        sockets.add(charger.session);
        return charger;
    }

    private KioskListener connectKiosk(String jwt) throws Exception {
        KioskListener kiosk = new KioskListener();
        WebSocketSession socket = new StandardWebSocketClient()
                .execute(kiosk, new WebSocketHttpHeaders(), URI.create("ws://localhost:" + port + "/ws/ev?token=" + jwt))
                .get(5, TimeUnit.SECONDS);
        handlers.add(kiosk);
        sockets.add(socket);
        return kiosk;
    }

    /** A fake charger: speaks OCPP-J over the real WebSocket and lets the test script it. */
    private final class SimulatedCharger extends TextWebSocketHandler {
        private final BlockingQueue<JsonNode> inbox = new LinkedBlockingQueue<>();
        private final List<JsonNode> stash = new ArrayList<>();
        WebSocketSession session;

        @Override
        protected void handleTextMessage(WebSocketSession s, TextMessage message) throws Exception {
            inbox.add(mapper.readTree(message.getPayload()));
        }

        JsonNode call(String action, ObjectNode payload) throws Exception {
            String messageId = UUID.randomUUID().toString();
            session.sendMessage(new TextMessage(mapper.createArrayNode()
                    .add(2).add(messageId).add(action).add(payload).toString()));
            return awaitFrame(frame -> isReplyTo(frame, messageId), "reply to " + action);
        }

        JsonNode sendRaw(String text) throws Exception {
            session.sendMessage(new TextMessage(text));
            return awaitFrame(frame -> frame.get(0).asInt() == 4, "CALLERROR");
        }

        JsonNode awaitCall(String action) throws Exception {
            return awaitFrame(frame -> frame.get(0).asInt() == 2 && action.equals(frame.get(2).asText()),
                    "CSMS call " + action);
        }

        void reply(JsonNode csmsCall, String status) throws Exception {
            session.sendMessage(new TextMessage(mapper.createArrayNode()
                    .add(3).add(csmsCall.get(1).asText())
                    .add(mapper.createObjectNode().put("status", status)).toString()));
        }

        /** Asserts the CSMS does NOT send this command (used to prove the connector stays locked). */
        void assertNoCall(String action) throws Exception {
            JsonNode frame;
            long deadline = System.currentTimeMillis() + 700;
            while ((frame = inbox.poll(Math.max(1, deadline - System.currentTimeMillis()), TimeUnit.MILLISECONDS)) != null) {
                stash.add(frame);
                if (System.currentTimeMillis() >= deadline) break;
            }
            for (JsonNode seen : stash) {
                assertThat(seen.get(0).asInt() == 2 && action.equals(seen.get(2).asText()))
                        .as("CSMS must not send %s yet, but did: %s", action, seen).isFalse();
            }
        }

        private boolean isReplyTo(JsonNode frame, String messageId) {
            int type = frame.get(0).asInt();
            return (type == 3 || type == 4) && messageId.equals(frame.get(1).asText());
        }

        private JsonNode awaitFrame(Predicate<JsonNode> matcher, String what) throws Exception {
            long deadline = System.currentTimeMillis() + 5_000;
            while (true) {
                for (Iterator<JsonNode> it = stash.iterator(); it.hasNext(); ) {
                    JsonNode candidate = it.next();
                    if (matcher.test(candidate)) {
                        it.remove();
                        return candidate;
                    }
                }
                long remaining = deadline - System.currentTimeMillis();
                if (remaining <= 0) throw new AssertionError("Timed out waiting for " + what + "; unmatched frames: " + stash);
                JsonNode next = inbox.poll(remaining, TimeUnit.MILLISECONDS);
                if (next != null) stash.add(next);
            }
        }
    }

    /** Stands in for the kiosk browser's live-update WebSocket. */
    private final class KioskListener extends TextWebSocketHandler {
        private final BlockingQueue<JsonNode> events = new LinkedBlockingQueue<>();

        @Override
        protected void handleTextMessage(WebSocketSession s, TextMessage message) throws Exception {
            events.add(mapper.readTree(message.getPayload()));
        }

        JsonNode awaitEvent(String type, Predicate<JsonNode> matcher) throws Exception {
            long deadline = System.currentTimeMillis() + 5_000;
            while (System.currentTimeMillis() < deadline) {
                JsonNode event = events.poll(200, TimeUnit.MILLISECONDS);
                if (event != null && type.equals(event.path("type").asText()) && matcher.test(event)) return event;
            }
            throw new AssertionError("No " + type + " event arrived within 5s");
        }
    }
}

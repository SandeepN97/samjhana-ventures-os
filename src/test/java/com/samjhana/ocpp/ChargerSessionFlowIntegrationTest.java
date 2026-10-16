package com.samjhana.ocpp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import ch.qos.logback.classic.Level;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.samjhana.config.OcppProperties;
import com.samjhana.entity.OcppCommandLog;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.entity.OcppMessageLog;
import com.samjhana.entity.OcppSessionEvidence;
import com.samjhana.ocpp.diag.LockEvidenceTracker;
import com.samjhana.ocpp.diag.LogCapture;
import com.samjhana.ocpp.diag.OcppAuditRetention;
import com.samjhana.ocpp.diag.OcppAuditWriter;
import com.samjhana.ocpp.diag.OcppLoggers;
import com.samjhana.ocpp.diag.RecordingAuditWriter;
import com.samjhana.repository.OcppCommandLogRepository;
import com.samjhana.repository.OcppConnectionLogRepository;
import com.samjhana.repository.OcppMessageLogRepository;
import com.samjhana.repository.OcppSessionEvidenceRepository;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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
    @Autowired OcppAuditWriter auditWriter;
    @Autowired LockEvidenceTracker lockEvidence;
    @Autowired OcppAuditRetention retention;
    @Autowired OcppMessageLogRepository messageLogs;
    @Autowired OcppConnectionLogRepository connectionLogs;
    @Autowired OcppCommandLogRepository commandLogs;
    @Autowired OcppSessionEvidenceRepository evidenceLogs;

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
        token = jwtUtil.generateToken(userRepository.findByUsername("ev-flow-admin").orElseThrow());

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
        boolean hadSockets = !sockets.isEmpty();
        for (WebSocketSession socket : sockets) {
            if (socket.isOpen()) socket.close();
        }
        sockets.clear();
        handlers.clear();
        if (hadSockets) {
            // The server marks the charger OFFLINE asynchronously after the close. Saving the charger below with a
            // stale ONLINE status would otherwise overwrite that and leak ONLINE into other test classes.
            await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
                assertThat(chargerStatus(CHARGER_1)).isEqualTo("OFFLINE");
                assertThat(chargerStatus(CHARGER_2)).isEqualTo("OFFLINE");
            });
        }
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
    void shouldRunIndependentSessionsOnDifferentConnectorsOfTheSameEvse() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String firstId = startSession(CHARGER_1, "BA 1 PA 1001", 80).get("id").asText();
        JsonNode firstStart = charger.awaitCall("RequestStartTransaction");
        assertThat(firstStart.get(3).get("evseId").asInt()).isEqualTo(1);
        charger.reply(firstStart, "Accepted");

        String secondId = startSession(CHARGER_1, "BA 1 PA 1002", 80, null, 1, 2).get("id").asText();
        JsonNode secondStart = charger.awaitCall("RequestStartTransaction");
        assertThat(secondStart.get(3).get("evseId").asInt()).isEqualTo(1);
        charger.reply(secondStart, "Accepted");

        charger.call("TransactionEvent", txEvent("Started", 0, "TX-C1", 20, 0, 1, 1));
        charger.call("TransactionEvent", txEvent("Started", 0, "TX-C2", 30, 0, 1, 2));
        awaitStatus(firstId, "ACTIVE");
        awaitStatus(secondId, "ACTIVE");
        assertThat(session(firstId).get("connectorId").asInt()).isEqualTo(1);
        assertThat(session(secondId).get("connectorId").asInt()).isEqualTo(2);
        assertThat(session(firstId).get("currentSoc").asInt()).isEqualTo(20);
        assertThat(session(secondId).get("currentSoc").asInt()).isEqualTo(30);

        charger.call("TransactionEvent", txEvent("Updated", 1, "TX-C1", 41, 2_000, 1, 1));
        charger.call("TransactionEvent", txEvent("Updated", 1, "TX-C2", 63, 4_000, 1, 2));
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
            assertThat(session(firstId).get("currentSoc").asInt()).isEqualTo(41);
            assertThat(session(secondId).get("currentSoc").asInt()).isEqualTo(63);
        });

        ResponseEntity<JsonNode> duplicate = post("/api/ev/sessions/start",
                startBody(CHARGER_1, "BA 1 PA 1003", 80, 1, 2));
        assertThat(duplicate.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        post("/api/ev/sessions/" + secondId + "/stop", null);
        JsonNode stopCall = charger.awaitCall("RequestStopTransaction");
        assertThat(stopCall.get(3).get("transactionId").asText()).isEqualTo("TX-C2");
        charger.reply(stopCall, "Accepted");
        charger.call("TransactionEvent", txEvent("Ended", 2, "TX-C2", 63, 4_000, 1, 2));
        awaitStatus(secondId, "AWAITING_PAYMENT");
        post("/api/ev/sessions/" + secondId + "/mark-paid", Map.of("method", "CASH", "amount", 100));
        JsonNode unlockCall = charger.awaitCall("UnlockConnector");
        assertThat(unlockCall.get(3).get("evseId").asInt()).isEqualTo(1);
        assertThat(unlockCall.get(3).get("connectorId").asInt()).isEqualTo(2);
        charger.reply(unlockCall, "Unlocked");
        awaitStatus(secondId, "CLOSED");
    }

    // ------------------------------------------------------------------ matching charger events to sessions
    // RequestStartTransaction names only the EVSE, so the charger picks the connector itself. The
    // remoteStartId the backend sends comes back in the charger's events and is what ties them to
    // the right session, whichever connector the car ended up on.

    @Test
    void shouldShowLiveReadings_whenChargerStartsOnADifferentConnectorThanChosen() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String id = startSession(CHARGER_1, "BA 2 PA 2001", 90, null, 1, 2).get("id").asText();
        JsonNode startCall = charger.awaitCall("RequestStartTransaction");
        charger.reply(startCall, "Accepted");
        int remoteStartId = startCall.get(3).get("remoteStartId").asInt();

        charger.call("TransactionEvent", withRemoteStartId(txEvent("Started", 0, "TX-M1", 20, 5_000, 1, 1), remoteStartId));
        awaitStatus(id, "ACTIVE");
        assertThat(session(id).get("connectorId").asInt()).as("the connector the car is really on").isEqualTo(1);

        charger.call("TransactionEvent", txEvent("Updated", 1, "TX-M1", 35, 12_000, 1, 1));
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
            assertThat(session(id).get("currentSoc").asInt()).isEqualTo(35);
            assertThat(session(id).get("energyDeliveredKwh").decimalValue()).isEqualByComparingTo("7.000");
        });
    }

    @Test
    void shouldKeepEachCarsReadingsSeparate_whenTheChargerSwapsTheConnectors() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String firstId = startSession(CHARGER_1, "BA 2 PA 2002", 90, null, 1, 1).get("id").asText();
        JsonNode firstStart = charger.awaitCall("RequestStartTransaction");
        charger.reply(firstStart, "Accepted");
        String secondId = startSession(CHARGER_1, "BA 2 PA 2003", 90, null, 1, 2).get("id").asText();
        JsonNode secondStart = charger.awaitCall("RequestStartTransaction");
        charger.reply(secondStart, "Accepted");

        // The charger put the first car on connector 2 and the second on connector 1.
        charger.call("TransactionEvent", withRemoteStartId(txEvent("Started", 0, "TX-S1", 10, 0, 1, 2),
                firstStart.get(3).get("remoteStartId").asInt()));
        charger.call("TransactionEvent", withRemoteStartId(txEvent("Started", 0, "TX-S2", 50, 0, 1, 1),
                secondStart.get(3).get("remoteStartId").asInt()));
        awaitStatus(firstId, "ACTIVE");
        awaitStatus(secondId, "ACTIVE");

        charger.call("TransactionEvent", txEvent("Updated", 1, "TX-S1", 25, 3_000, 1, 2));
        charger.call("TransactionEvent", txEvent("Updated", 1, "TX-S2", 70, 9_000, 1, 1));
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
            JsonNode first = session(firstId);
            JsonNode second = session(secondId);
            assertThat(first.get("connectorId").asInt()).isEqualTo(2);
            assertThat(first.get("currentSoc").asInt()).isEqualTo(25);
            assertThat(first.get("energyDeliveredKwh").decimalValue()).isEqualByComparingTo("3.000");
            assertThat(second.get("connectorId").asInt()).isEqualTo(1);
            assertThat(second.get("currentSoc").asInt()).isEqualTo(70);
            assertThat(second.get("energyDeliveredKwh").decimalValue()).isEqualByComparingTo("9.000");
        });

        // Unlocking after payment releases the connector the car is really on.
        post("/api/ev/sessions/" + firstId + "/stop", null);
        JsonNode stopCall = charger.awaitCall("RequestStopTransaction");
        assertThat(stopCall.get(3).get("transactionId").asText()).isEqualTo("TX-S1");
        charger.reply(stopCall, "Accepted");
        charger.call("TransactionEvent", txEvent("Ended", 2, "TX-S1", 25, 3_000, 1, 2));
        awaitStatus(firstId, "AWAITING_PAYMENT");
        post("/api/ev/sessions/" + firstId + "/mark-paid", Map.of("method", "CASH", "amount", 100));
        JsonNode unlockCall = charger.awaitCall("UnlockConnector");
        assertThat(unlockCall.get(3).get("connectorId").asInt()).isEqualTo(2);
    }

    @Test
    void shouldUpdateLiveReadings_whenLaterEventsLeaveOutTheConnector() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String id = startSession(CHARGER_1, "BA 2 PA 2004", 90).get("id").asText();
        JsonNode startCall = charger.awaitCall("RequestStartTransaction");
        charger.reply(startCall, "Accepted");
        charger.call("TransactionEvent", txEvent("Started", 0, "TX-N1", 20, 1_000));
        awaitStatus(id, "ACTIVE");

        // OCPP 2.0.1 only requires the EVSE on the first event of a transaction.
        ObjectNode update = txEvent("Updated", 1, "TX-N1", 44, 16_000);
        update.remove("evse");
        charger.call("TransactionEvent", update);
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
            assertThat(session(id).get("currentSoc").asInt()).isEqualTo(44);
            assertThat(session(id).get("energyDeliveredKwh").decimalValue()).isEqualByComparingTo("15.000");
        });
    }

    @Test
    void shouldRecoverAStuckStartingSession_whenItsReadingsArrive() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String id = startSession(CHARGER_1, "BA 2 PA 2005", 90, null, 1, 2).get("id").asText();
        JsonNode startCall = charger.awaitCall("RequestStartTransaction");
        charger.reply(startCall, "Accepted");

        // The Started event was lost; the next periodic reading still names the start ID.
        charger.call("TransactionEvent", withRemoteStartId(txEvent("Updated", 3, "TX-R1", 55, 4_000, 1, 1),
                startCall.get(3).get("remoteStartId").asInt()));
        awaitStatus(id, "ACTIVE");
        JsonNode live = session(id);
        assertThat(live.get("currentSoc").asInt()).isEqualTo(55);
        assertThat(live.get("connectorId").asInt()).isEqualTo(1);
        assertThat(live.get("ocppTransactionId").asText()).isEqualTo("TX-R1");
    }

    @Test
    void shouldIgnoreAStartedEvent_whenItsStartIdBelongsToNoSession() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        String id = startSession(CHARGER_1, "BA 2 PA 2006", 90).get("id").asText();
        JsonNode startCall = charger.awaitCall("RequestStartTransaction");
        charger.reply(startCall, "Accepted");
        int ours = startCall.get(3).get("remoteStartId").asInt();

        // Same connector, but another start ID: this is some other car's transaction.
        charger.call("TransactionEvent", withRemoteStartId(txEvent("Started", 0, "TX-X1", 80, 0, 1, 1), ours + 1));
        charger.call("TransactionEvent", withRemoteStartId(txEvent("Updated", 1, "TX-X1", 85, 2_000, 1, 1), ours + 1));
        JsonNode untouched = session(id);
        assertThat(untouched.get("status").asText()).isEqualTo("STARTING");
        assertThat(untouched.get("currentSoc").isNull()).isTrue();
        assertThat(untouched.get("energyDeliveredKwh").decimalValue()).isEqualByComparingTo("0");
    }

    @Test
    void shouldSerializeSimultaneousStartsForTheSameConnector() throws Exception {
        connectAndBoot(CHARGER_1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch startTogether = new CountDownLatch(1);

        try {
            List<Future<ResponseEntity<JsonNode>>> requests = List.of(
                    executor.submit(() -> concurrentStart(ready, startTogether, "BA 4 PA 4001")),
                    executor.submit(() -> concurrentStart(ready, startTogether, "BA 4 PA 4002")));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            startTogether.countDown();

            List<Integer> responses = new ArrayList<>();
            for (Future<ResponseEntity<JsonNode>> request : requests) {
                responses.add(request.get(10, TimeUnit.SECONDS).getStatusCode().value());
            }
            assertThat(responses).containsExactlyInAnyOrder(HttpStatus.OK.value(), HttpStatus.CONFLICT.value());
            assertThat(get("/api/ev/sessions/active").getBody()).hasSize(1);
        } finally {
            startTogether.countDown();
            executor.shutdownNow();
        }
    }

    private ResponseEntity<JsonNode> concurrentStart(
            CountDownLatch ready, CountDownLatch startTogether, String plate) throws Exception {
        ready.countDown();
        if (!startTogether.await(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent start barrier timed out");
        }
        return post("/api/ev/sessions/start", startBody(CHARGER_1, plate, 80));
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
    void shouldRefuseKioskConnection_whenTicketIsMissingOrInvalid() {
        assertThatThrownBy(() -> connectKioskWithTicket("not-a-ticket")).isInstanceOf(ExecutionException.class);
        assertThatThrownBy(() -> connectKioskWithTicket("")).isInstanceOf(ExecutionException.class);
    }

    @Test
    void shouldRefuseKioskConnection_whenGivenTheLoginTokenInsteadOfATicket() {
        assertThatThrownBy(() -> connectKiosk(token, "token")).isInstanceOf(ExecutionException.class);
    }

    @Test
    void shouldRefuseKioskConnection_whenATicketIsUsedTwice() throws Exception {
        String ticket = post("/api/ev/live-ticket", Map.of()).getBody().get("ticket").asText();
        connectKioskWithTicket(ticket);
        assertThatThrownBy(() -> connectKioskWithTicket(ticket)).isInstanceOf(ExecutionException.class);
    }

    @Test
    void shouldRefuseToIssueATicket_withoutALogin() {
        ResponseEntity<JsonNode> response = rest.exchange("/api/ev/live-ticket", HttpMethod.POST,
                new HttpEntity<>(new HttpHeaders()), JsonNode.class);
        assertThat(response.getStatusCode().value()).isEqualTo(401);
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


    // ------------------------------------------------------------------ diagnostics: logs + audit trail

    @Test
    void shouldRecordTheFullAuditTrail_whenAnExplicitUnlockSessionRunsEndToEnd() throws Exception {
        java.time.Instant testStart = java.time.Instant.now();
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            SimulatedCharger charger = connectAndBoot(CHARGER_1);
            charger.call("StatusNotification", statusPayload("Occupied"));
            String id = startSession(CHARGER_1, "BA 1 PA 4521", 80, dfacId).get("id").asText();
            charger.reply(charger.awaitCall("RequestStartTransaction"), "Accepted");
            charger.call("TransactionEvent", txEvent("Started", 0, "TX-AUD", 32, 1_000_000));
            awaitStatus(id, "ACTIVE");
            charger.call("TransactionEvent", withoutSoc(txEvent("Updated", 1, "TX-AUD", 40, 1_002_000)));

            assertThat(post("/api/ev/sessions/" + id + "/stop", null).getStatusCode()).isEqualTo(HttpStatus.OK);
            charger.reply(charger.awaitCall("RequestStopTransaction"), "Accepted");
            charger.call("TransactionEvent", txEvent("Ended", 2, "TX-AUD", 50, 1_004_000));
            awaitStatus(id, "AWAITING_PAYMENT");
            charger.call("StatusNotification", statusPayload("Available")); // released by itself, before payment

            assertThat(post("/api/ev/sessions/" + id + "/mark-paid",
                    Map.of("method", "CASH", "amount", 600)).getStatusCode()).isEqualTo(HttpStatus.OK);
            charger.reply(charger.awaitCall("UnlockConnector"), "Unlocked");
            awaitStatus(id, "CLOSED");
            lockEvidence.emitAll();
            charger.session.close();
            await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> assertThat(capture.matching("DISCONNECTED chargePointId=")).isNotEmpty());

            // ---- log lines
            assertThat(capture.matching("HANDSHAKE ACCEPTED")).isNotEmpty();
            assertThat(capture.matching("BOOT reason=PowerUp vendor=Sim model=TEST serial=SN-HD-D180-CC-01")).hasSize(1);
            assertThat(capture.matching("CONNECTOR STATUS CHANGE evse=1 connector=1: Available -> Occupied")).hasSize(1);
            assertThat(capture.matching("COMMAND SENT RequestStartTransaction")).hasSize(1);
            assertThat(capture.matching("COMMAND SENT RequestStopTransaction")).hasSize(1);
            assertThat(capture.matching("COMMAND SENT UnlockConnector")).hasSize(1);
            assertThat(capture.matching("COMMAND RESULT UnlockConnector")).singleElement().asString()
                    .contains("status=Unlocked").containsPattern("latency=\\d+ms").contains("chargeSessionId=" + id);
            assertThat(capture.matching("SoC present=true value=32%")).hasSize(1);
            assertThat(capture.matching("SoC present=false (meterValue has no SoC sampledValue)")).hasSize(1);
            assertThat(capture.matching("CHARGE SESSION " + id + " on " + CHARGER_1 + ": STARTING -> ACTIVE")).hasSize(1);
            assertThat(capture.matching("CHARGE SESSION " + id + " on " + CHARGER_1 + ": AWAITING_PAYMENT -> UNLOCK_REQUESTED")).hasSize(1);
            assertThat(capture.matching("CHARGE SESSION " + id + " on " + CHARGER_1 + ": UNLOCK_REQUESTED -> CLOSED")).hasSize(1);
            assertThat(capture.matching("CHARGE POINT " + CHARGER_1 + " connector_status: ")).isNotEmpty();
            assertThat(capture.textsFrom(OcppLoggers.LOCK_EVIDENCE_NAME)).filteredOn(l -> l.contains("session=" + id))
                    .singleElement().asString()
                    .contains("TX_ENDED").contains("Occupied->Available")
                    .contains("UNLOCK_SENT").contains("UNLOCK_REPLY Unlocked").contains("verdict=RELEASED_BEFORE_OUR_UNLOCK");
            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME)).anyMatch(l -> l.startsWith("FRAME IN") && l.contains("TransactionEvent"));
            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME)).anyMatch(l -> l.startsWith("FRAME OUT") && l.contains("UnlockConnector"));
            assertThat(capture.anyContains("BA1PA4521")).as("plate (idToken) must be masked everywhere").isFalse();
            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME)).anyMatch(l -> l.contains("BA***21"));

            // ---- database rows
            drainAuditQueue();
            List<OcppMessageLog> frames = messageLogs.findAll().stream()
                    .filter(r -> CHARGER_1.equals(r.getChargePointId()) && !r.getReceivedAt().isBefore(testStart)).toList();
            assertThat(frames).extracting(OcppMessageLog::getAction).contains("BootNotification", "StatusNotification",
                    "RequestStartTransaction", "TransactionEvent", "RequestStopTransaction", "UnlockConnector");
            assertThat(frames).filteredOn(r -> "TransactionEvent".equals(r.getAction()) && "IN".equals(r.getDirection())
                    && Integer.valueOf(2).equals(r.getMessageType())).hasSize(3);
            assertThat(frames).filteredOn(r -> "UnlockConnector".equals(r.getAction()) && Integer.valueOf(3).equals(r.getMessageType()))
                    .as("the CALLRESULT is tagged with the action it answers").hasSize(1);
            assertThat(RecordingAuditWriter.dumpRows(frames)).doesNotContain("BA1PA4521").contains("BA***21");
            assertThat(frames).allSatisfy(r -> {
                assertThat(r.getWsSessionId()).isNotBlank();
                assertThat(r.getPayloadSize()).isPositive();
                assertThat(r.isDiscovery()).isFalse();
            });

            List<OcppCommandLog> commands = commandLogs.findAll().stream()
                    .filter(r -> id.equals(String.valueOf(r.getChargeSessionId()))).toList();
            assertThat(commands).extracting(OcppCommandLog::getAction)
                    .containsExactlyInAnyOrder("RequestStartTransaction", "RequestStopTransaction", "UnlockConnector");
            assertThat(commands).allSatisfy(c -> {
                assertThat(c.getOutcome()).isEqualTo(OcppCommandLog.Outcome.RESULT);
                assertThat(c.getResponseStatus()).isIn("Accepted", "Unlocked");
                assertThat(c.getLatencyMs()).isNotNull().isGreaterThanOrEqualTo(0);
                assertThat(c.getReason()).isNotBlank().isNotEqualTo("unspecified");
            });

            List<OcppSessionEvidence> evidence = evidenceLogs.findAll().stream()
                    .filter(e -> id.equals(String.valueOf(e.getChargeSessionId()))).toList();
            assertThat(evidence).singleElement().satisfies(e -> {
                assertThat(e.getOcppTransactionId()).isEqualTo("TX-AUD");
                assertThat(e.getSummary()).contains("verdict=RELEASED_BEFORE_OUR_UNLOCK");
                assertThat(e.getEvents()).contains("STOP_SENT").contains("UNLOCK_SENT");
            });

            List<OcppConnectionLog> connection = connectionLogs.findAll().stream()
                    .filter(r -> CHARGER_1.equals(r.getChargePointId()) && !r.getCreatedAt().isBefore(testStart)).toList();
            assertThat(connection).extracting(OcppConnectionLog::getEvent).contains(
                    OcppConnectionLog.Event.HANDSHAKE_ACCEPTED, OcppConnectionLog.Event.CONNECTED,
                    OcppConnectionLog.Event.DISCONNECTED);
        }
    }

    @Test
    void shouldNeverPutAPasswordOrAuthorizationValueInAnyLogLevelOrTable_whenChargersConnectAndFail() throws Exception {
        String secret = ocppProperties.secretFor(CHARGER_1);
        String wrong = "wrong-" + java.util.UUID.randomUUID();
        String queryPassword = "query-" + java.util.UUID.randomUUID();
        List<String> forbidden = new ArrayList<>();
        for (String user : List.of(CHARGER_1, "someone")) {
            for (String password : List.of(secret, wrong)) {
                String base64 = java.util.Base64.getEncoder().encodeToString((user + ":" + password).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                forbidden.add(base64);
                forbidden.add("Basic " + base64);
            }
        }
        forbidden.addAll(List.of(secret, wrong, queryPassword));

        java.time.Instant testStart = java.time.Instant.now();
        // Root at TRACE captures every statement of every library (Tomcat, Spring, Hibernate...).
        // Two libraries print request headers/URLs when their loggers are at DEBUG/TRACE: Tomcat's request dump
        // (org.apache.coyote) and Spring (org.springframework.web: AbstractHandshakeHandler and the URI parser).
        // The app warns at startup if either is enabled (ForbiddenLogSettings), so they are pinned to INFO like in
        // every real profile; everything else is captured at TRACE.
        try (LogCapture capture = LogCapture.atEveryLevel().with("org.apache.coyote", Level.INFO)
                .with("org.springframework.web", Level.INFO).with("_org.springframework.web", Level.INFO)) {
            assertThatThrownBy(() -> connect(CHARGER_1, wrong)).isInstanceOf(ExecutionException.class);
            assertThatThrownBy(() -> connect("NOT-A-CHARGER-01", wrong)).isInstanceOf(ExecutionException.class);
            SimulatedCharger charger = connectAndBoot(CHARGER_1);
            charger.call("Heartbeat", mapper.createObjectNode());
            // a near-miss URL carrying credentials in its query and header, answered 404 before our interceptor
            HttpHeaders headers = new HttpHeaders();
            headers.setBasicAuth(CHARGER_1, secret);
            rest.exchange("/ocpp/" + CHARGER_1 + "/" + CHARGER_1 + "?password=" + queryPassword, HttpMethod.GET,
                    new HttpEntity<>(headers), String.class);
            charger.session.close();
            await().atMost(5, TimeUnit.SECONDS).untilAsserted(
                    () -> assertThat(capture.matching("DISCONNECTED chargePointId=" + CHARGER_1)).isNotEmpty());

            assertThat(capture.events()).as("TRACE-level capture is really on").isNotEmpty();
            // Only server-side output is under test: the test's own HTTP client may log the headers it sends.
            List<String> serverSide = capture.events().stream()
                    .filter(e -> !e.getLoggerName().startsWith("org.springframework.web.client")
                            && !e.getLoggerName().startsWith("org.springframework.http.client")
                            && !e.getLoggerName().startsWith("org.apache.hc"))
                    .map(e -> e.getLoggerName() + " - " + e.getFormattedMessage() + " " + e.getMDCPropertyMap()
                            + (e.getThrowableProxy() == null ? "" : ch.qos.logback.classic.spi.ThrowableProxyUtil.asString(e.getThrowableProxy())))
                    .toList();
            assertThat(serverSide).isNotEmpty();
            for (String text : serverSide) {
                for (String value : forbidden) {
                    assertThat(text).as("log line must not contain a password / Authorization value").doesNotContain(value);
                }
            }
            // the charger's stored hash must not appear in any application log line either
            String hash = chargePointRepository.findByCodeAndDeletedAtIsNull(CHARGER_1).orElseThrow().getOcppAuthSecretHash();
            assertThat(capture.events().stream().filter(e -> e.getLoggerName().startsWith("com.samjhana"))
                    .map(e -> e.getFormattedMessage()).toList()).noneMatch(m -> m.contains(hash));

            drainAuditQueue();
            String tables = RecordingAuditWriter.dumpRows(messageLogs.findAll().stream().filter(r -> !r.getReceivedAt().isBefore(testStart)).toList())
                    + RecordingAuditWriter.dumpRows(connectionLogs.findAll().stream().filter(r -> !r.getCreatedAt().isBefore(testStart)).toList());
            for (String value : forbidden) assertThat(tables).doesNotContain(value);
            assertThat(tables).doesNotContain(hash);
            // and the rows are not empty, so the check above is meaningful
            assertThat(connectionLogs.findAll().stream().filter(r -> !r.getCreatedAt().isBefore(testStart)).map(OcppConnectionLog::getReason))
                    .contains("BAD_PASSWORD", "UNKNOWN_CHARGER", "ACCEPTED", "DOUBLED_CHARGE_POINT_ID");
        }
    }

    @Test
    void shouldLogAndStoreRequestsThatNeverReachTheHandshakeInterceptor_includingNearMissUrls() throws Exception {
        java.time.Instant testStart = java.time.Instant.now();
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            ResponseEntity<String> trailing = rest.getForEntity("/ocpp/" + CHARGER_1 + "/", String.class);
            ResponseEntity<String> extra = rest.getForEntity("/ocpp/" + CHARGER_1 + "/extra", String.class);
            ResponseEntity<String> doubled = rest.getForEntity("/ocpp/" + CHARGER_1 + "/" + CHARGER_1, String.class);
            ResponseEntity<String> prefix = rest.getForEntity("/ocpp2.0.1/" + CHARGER_1, String.class);
            ResponseEntity<String> plain = rest.getForEntity("/ocpp/" + CHARGER_1, String.class); // no upgrade, no subprotocol

            // The accepted URL shapes are exactly what they were: only /ocpp/<id> reaches the interceptor. Near-miss
            // URLs under /ocpp/ are answered 200 by the single-page-app fallback (index.html), not 404; a charger
            // would see a non-101 answer. Anything outside the permitted paths hits Spring Security first (401).
            assertThat(trailing.getStatusCode().value()).isEqualTo(200);
            assertThat(plain.getStatusCode().value()).isEqualTo(426);
            assertThat(capture.matching("REQUEST GET /ocpp/" + CHARGER_1 + "/ ")).singleElement().asString()
                    .contains("shape=TRAILING_SLASH").contains("-> " + trailing.getStatusCode().value());
            assertThat(capture.matching("shape=EXTRA_SEGMENT")).hasSize(1);
            assertThat(capture.matching("shape=DOUBLED_CHARGE_POINT_ID")).hasSize(1);
            assertThat(capture.matching("shape=UNKNOWN_PREFIX")).hasSize(1);
            assertThat(capture.matching("HANDSHAKE NO_SUBPROTOCOL")).hasSize(1);
            assertThat(capture.matching("REQUEST GET /ocpp/" + CHARGER_1 + " -> 426")).hasSize(1);
            // the near-miss URLs were answered before our interceptor, yet are in the log
            assertThat(extra.getStatusCode().value()).isEqualTo(200);
            assertThat(doubled.getStatusCode().value()).isEqualTo(200);
            assertThat(prefix.getStatusCode().value()).isEqualTo(401);
            assertThat(capture.matching("shape=EXTRA_SEGMENT").get(0)).contains("responseContentType=text/html");
            assertThat(capture.matching("shape=UNKNOWN_PREFIX").get(0)).contains("-> 401");

            drainAuditQueue();
            List<OcppConnectionLog> rows = connectionLogs.findAll().stream()
                    .filter(r -> !r.getCreatedAt().isBefore(testStart)).toList();
            assertThat(rows).extracting(OcppConnectionLog::getReason).contains("TRAILING_SLASH", "EXTRA_SEGMENT",
                    "DOUBLED_CHARGE_POINT_ID", "UNKNOWN_PREFIX", "NO_SUBPROTOCOL");
            assertThat(rows).filteredOn(r -> "EXTRA_SEGMENT".equals(r.getReason())).singleElement().satisfies(r -> {
                assertThat(r.getEvent()).isEqualTo(OcppConnectionLog.Event.REQUEST_NEAR_MISS);
                assertThat(r.getRequestUri()).isEqualTo("/ocpp/" + CHARGER_1 + "/extra");
                assertThat(r.getHttpStatus()).isEqualTo(extra.getStatusCode().value());
                assertThat(r.getRemoteAddr()).isNotBlank();
            });
        }
    }

    @Test
    void shouldKeepTheChargerOnlineAndItsCommandsPending_whenAStaleConnectionClosesAfterAQuickReconnect() throws Exception {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            SimulatedCharger first = connectAndBoot(CHARGER_1);
            SimulatedCharger second = connect(CHARGER_1, ocppProperties.secretFor(CHARGER_1)); // reconnect, old socket still open
            second.call("Heartbeat", mapper.createObjectNode());

            await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> assertThat(first.session.isOpen()).isFalse());
            await().atMost(5, TimeUnit.SECONDS).untilAsserted(
                    () -> assertThat(capture.matching("STALE session")).hasSize(1));

            assertThat(capture.matching("RECONNECT chargePointId=" + CHARGER_1)).hasSize(1);
            assertThat(chargerStatus(CHARGER_1)).as("a stale close must not mark the charger offline").isEqualTo("ONLINE");

            // the new connection is the one commands go to
            String id = startSession(CHARGER_1, "BA 8 PA 8888", 80).get("id").asText();
            second.reply(second.awaitCall("RequestStartTransaction"), "Accepted");
            second.call("TransactionEvent", txEvent("Started", 0, "TX-RC", 20, 0));
            awaitStatus(id, "ACTIVE");

            second.session.close();
            await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> assertThat(chargerStatus(CHARGER_1)).isEqualTo("OFFLINE"));
        }
    }

    @Test
    void shouldAcceptALargeFrame_becauseTheContainerLimitIsRaisedAboveTomcatsEightKilobyteDefault() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        ObjectNode payload = mapper.createObjectNode();
        payload.put("vendorId", "Hardhitter");
        payload.put("data", "x".repeat(40_000));

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            JsonNode reply = charger.call("DataTransfer", payload);

            assertThat(reply.get(0).asInt()).isEqualTo(4);
            assertThat(reply.get(2).asText()).isEqualTo("NotSupported");
            assertThat(chargerStatus(CHARGER_1)).isEqualTo("ONLINE");
            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME)).anyMatch(l -> l.startsWith("FRAME IN") && l.contains("size=40"));
        }
    }

    @Autowired org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor scheduledTasks;

    @Test
    void shouldHaveTheHousekeepingJobsRegisteredWithTheScheduler() {
        List<String> registered = scheduledTasks.getScheduledTasks().stream().map(task -> task.getTask().toString()).toList();

        assertThat(registered).anyMatch(t -> t.endsWith("OcppHousekeeping.tick"))
                .anyMatch(t -> t.endsWith("LockEvidenceTracker.emitQuietSessions"))
                .anyMatch(t -> t.endsWith("OcppAuditRetention.dailyJob"));
    }

    @Test
    void shouldPersistFramesWithoutManualFlush_becauseTheWriterRunsInTheBackground() throws Exception {
        java.time.Instant testStart = java.time.Instant.now();
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        charger.call("Heartbeat", mapper.createObjectNode());

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> assertThat(messageLogs.findAll().stream()
                .filter(r -> CHARGER_1.equals(r.getChargePointId()) && !r.getReceivedAt().isBefore(testStart))
                .map(OcppMessageLog::getAction)).contains("BootNotification", "Heartbeat"));
    }

    @Test
    void shouldPurgeRowsOlderThanTheRetentionWindow_andReportTheTableSizes() {
        java.time.Instant old = java.time.Instant.now().minus(java.time.Duration.ofDays(45));
        java.time.Instant recent = java.time.Instant.now().minus(java.time.Duration.ofDays(2));
        messageLogs.save(OcppMessageLog.builder().chargePointId("RET-TEST").direction("IN").action("OldFrame")
                .payload("[]").payloadSize(2).receivedAt(old).build());
        messageLogs.save(OcppMessageLog.builder().chargePointId("RET-TEST").direction("IN").action("RecentFrame")
                .payload("[]").payloadSize(2).receivedAt(recent).build());
        connectionLogs.save(OcppConnectionLog.builder().chargePointId("RET-TEST").event(OcppConnectionLog.Event.CONNECTED)
                .createdAt(old).build());

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            long deleted = retention.purge();
            long bytes = retention.reportSize();

            assertThat(deleted).isGreaterThanOrEqualTo(2);
            assertThat(messageLogs.findAll()).extracting(OcppMessageLog::getAction).doesNotContain("OldFrame").contains("RecentFrame");
            assertThat(connectionLogs.findAll()).extracting(OcppConnectionLog::getChargePointId).doesNotContain("RET-TEST");
            assertThat(bytes).isPositive();
            assertThat(capture.matching("OCPP audit size:")).singleElement().asString()
                    .contains("ocpp_message_log=").contains("% of the 500 MB database budget");
            assertThat(capture.matching("OCPP retention: deleted")).hasSize(1);
        }
    }

    // ------------------------------------------------------------------ finding P1a-03: a new secret cuts off the old connection

    @Test
    void shouldCloseTheChargersOpenConnectionAndRefuseItsOldSecret_whenAnAdminRotatesTheSecret() throws Exception {
        String originalHash = chargePointRepository.findByCodeAndDeletedAtIsNull(CHARGER_1).orElseThrow().getOcppAuthSecretHash();
        String oldSecret = ocppProperties.secretFor(CHARGER_1);
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        try {
            ResponseEntity<JsonNode> rotated = post("/api/charge-points/" + chargePointId(CHARGER_1) + "/rotate-secret", Map.of());
            assertThat(rotated.getStatusCode().value()).isEqualTo(200);
            String newSecret = rotated.getBody().get("secret").asText();

            // the connection that was opened with the old secret is closed by the server
            await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> assertThat(charger.session.isOpen()).isFalse());
            await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> assertThat(chargerStatus(CHARGER_1)).isEqualTo("OFFLINE"));
            // the old secret no longer gets in, the new one does
            assertThatThrownBy(() -> connect(CHARGER_1, oldSecret)).isInstanceOf(ExecutionException.class);
            SimulatedCharger again = connect(CHARGER_1, newSecret);
            assertThat(again.session.isOpen()).isTrue();
        } finally {
            restoreSecretHash(CHARGER_1, originalHash);
        }
    }

    @Test
    void shouldCloseOnlyTheRotatedChargersConnection_andLeaveTheOtherChargerOnline() throws Exception {
        String originalHash = chargePointRepository.findByCodeAndDeletedAtIsNull(CHARGER_1).orElseThrow().getOcppAuthSecretHash();
        SimulatedCharger first = connectAndBoot(CHARGER_1);
        SimulatedCharger second = connectAndBoot(CHARGER_2);
        try {
            post("/api/charge-points/" + chargePointId(CHARGER_1) + "/rotate-secret", Map.of());

            await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> assertThat(first.session.isOpen()).isFalse());
            assertThat(second.session.isOpen()).isTrue();
            assertThat(chargerStatus(CHARGER_2)).isEqualTo("ONLINE");
        } finally {
            restoreSecretHash(CHARGER_1, originalHash);
        }
    }

    @Test
    void shouldLeaveTheConnectionOpen_whenSomeoneWithoutAdminRightsTriesToRotateTheSecret() throws Exception {
        SimulatedCharger charger = connectAndBoot(CHARGER_1);
        User staff = userRepository.findByUsername("ev-flow-staff").orElseGet(() -> userRepository.save(User.builder()
                .username("ev-flow-staff").passwordHash(passwordEncoder.encode("not-used")).fullName("EV Flow Staff")
                .fullNameNepali("कर्मचारी").role(User.UserRole.STAFF).build()));
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtUtil.generateToken(staff));
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<JsonNode> refused = rest.exchange("/api/charge-points/" + chargePointId(CHARGER_1) + "/rotate-secret",
                HttpMethod.POST, new HttpEntity<>(Map.of(), headers), JsonNode.class);

        assertThat(refused.getStatusCode().value()).isEqualTo(403);
        assertThat(charger.session.isOpen()).isTrue();
        assertThat(chargerStatus(CHARGER_1)).isEqualTo("ONLINE");
    }

    /** Puts the charger's stored secret back, so the other tests (which connect with the configured secret) still get in. */
    private void restoreSecretHash(String code, String hash) {
        ChargePoint point = chargePointRepository.findByCodeAndDeletedAtIsNull(code).orElseThrow();
        point.setOcppAuthSecretHash(hash);
        chargePointRepository.save(point);
    }

    private void drainAuditQueue() {
        int guard = 0;
        while (auditWriter.flush() > 0 && guard++ < 1000) {
            // keep going until the queue is empty
        }
    }

    private ObjectNode statusPayload(String connectorStatus) {
        ObjectNode status = mapper.createObjectNode();
        status.put("timestamp", OffsetDateTime.now().toString());
        status.put("connectorStatus", connectorStatus);
        status.put("evseId", 1);
        status.put("connectorId", 1);
        return status;
    }

    private ObjectNode withoutSoc(ObjectNode event) {
        ArrayNode samples = (ArrayNode) event.get("meterValue").get(0).get("sampledValue");
        for (int i = samples.size() - 1; i >= 0; i--) {
            if ("SoC".equals(samples.get(i).get("measurand").asText())) samples.remove(i);
        }
        return event;
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
        return startBody(code, plate, targetPercent, 1, 1);
    }

    private Map<String, Object> startBody(
            String code, String plate, int targetPercent, int evseId, int connectorId) {
        return Map.of("chargePointId", chargePointId(code), "plateNumber", plate, "targetPercent", targetPercent,
                "evseId", evseId, "connectorId", connectorId);
    }

    private JsonNode startSession(String code, String plate, int targetPercent) {
        return startSession(code, plate, targetPercent, null);
    }

    private JsonNode startSession(String code, String plate, int targetPercent, String vehicleCatalogId) {
        return startSession(code, plate, targetPercent, vehicleCatalogId, 1, 1);
    }

    private JsonNode startSession(
            String code, String plate, int targetPercent, String vehicleCatalogId, int evseId, int connectorId) {
        Map<String, Object> body = new java.util.HashMap<>(
                startBody(code, plate, targetPercent, evseId, connectorId));
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
        return txEvent(eventType, seqNo, transactionId, soc, energyWh, 1, 1);
    }

    private ObjectNode txEvent(
            String eventType, int seqNo, String transactionId, int soc, long energyWh, int evseId, int connectorId) {
        ObjectNode payload = mapper.createObjectNode();
        payload.put("eventType", eventType);
        payload.put("timestamp", OffsetDateTime.now().toString());
        payload.put("triggerReason", "Trigger");
        payload.put("seqNo", seqNo);
        payload.putObject("evse").put("id", evseId).put("connectorId", connectorId);
        payload.putObject("transactionInfo").put("transactionId", transactionId);
        ObjectNode meterValue = payload.putArray("meterValue").addObject();
        meterValue.putArray("sampledValue").addObject().put("value", soc).put("measurand", "SoC");
        meterValue.withArray("sampledValue").addObject()
                .put("value", energyWh).put("measurand", "Energy.Active.Import.Register");
        return payload;
    }

    private ObjectNode withRemoteStartId(ObjectNode event, int remoteStartId) {
        ((ObjectNode) event.get("transactionInfo")).put("remoteStartId", remoteStartId);
        return event;
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

    /** Connects the way the app does: swap the login token for a one-time ticket, then open the socket. */
    private KioskListener connectKiosk(String jwt) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt);
        String ticket = rest.exchange("/api/ev/live-ticket", HttpMethod.POST, new HttpEntity<>(headers), JsonNode.class)
                .getBody().get("ticket").asText();
        return connectKioskWithTicket(ticket);
    }

    private KioskListener connectKioskWithTicket(String ticket) throws Exception {
        return connectKiosk(ticket, "ticket");
    }

    private KioskListener connectKiosk(String credential, String param) throws Exception {
        KioskListener kiosk = new KioskListener();
        WebSocketSession socket = new StandardWebSocketClient()
                .execute(kiosk, new WebSocketHttpHeaders(), URI.create("ws://localhost:" + port + "/ws/ev?" + param + "=" + credential))
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

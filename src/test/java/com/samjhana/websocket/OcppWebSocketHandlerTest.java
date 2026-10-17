package com.samjhana.websocket;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.OcppCommandLog;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.entity.OcppMessageLog;
import com.samjhana.ocpp.OcppConnectionRegistry;
import com.samjhana.ocpp.diag.FrameRateLimiter;
import com.samjhana.ocpp.diag.JsonMasker;
import com.samjhana.ocpp.diag.LockEvidenceTracker;
import com.samjhana.ocpp.diag.LogCapture;
import com.samjhana.ocpp.diag.OcppCommandAudit;
import com.samjhana.ocpp.diag.OcppConnectionState;
import com.samjhana.ocpp.diag.OcppFrameLogger;
import com.samjhana.ocpp.diag.OcppFrameSender;
import com.samjhana.ocpp.diag.OcppLoggers;
import com.samjhana.ocpp.diag.OcppLoggingProperties;
import com.samjhana.ocpp.diag.OcppMessageLogger;
import com.samjhana.ocpp.diag.RecordingAuditWriter;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.repository.ChargeSessionRepository;
import com.samjhana.service.ChargePointService;
import com.samjhana.service.ChargeSessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The handler with real logging/auditing collaborators and mocked business services. */
class OcppWebSocketHandlerTest {

    private static final String CP = "HD-D180-CC-01";

    private final ObjectMapper mapper = new ObjectMapper();
    private OcppLoggingProperties properties;
    private RecordingAuditWriter writer;
    private ChargePointService chargePointService;
    private ChargeSessionService chargeSessionService;
    private OcppConnectionRegistry registry;
    private OcppWebSocketHandler handler;
    private final List<String> sent = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        properties = new OcppLoggingProperties();
        writer = new RecordingAuditWriter(properties);
        chargePointService = mock(ChargePointService.class);
        chargeSessionService = mock(ChargeSessionService.class);
        JsonMasker masker = new JsonMasker(mapper);
        OcppFrameLogger frames = new OcppFrameLogger(properties, masker, writer);
        OcppFrameSender sender = new OcppFrameSender(frames);
        LockEvidenceTracker evidence = new LockEvidenceTracker(writer, mock(ChargeSessionRepository.class), properties, mapper);
        OcppCommandAudit commandAudit = new OcppCommandAudit(writer, evidence);
        registry = new OcppConnectionRegistry(sender, commandAudit);
        OcppMessageLogger messageLogger = new OcppMessageLogger(properties, mock(ChargePointRepository.class), evidence, masker);
        handler = new OcppWebSocketHandler(mapper, registry, chargePointService, chargeSessionService, frames, sender,
                messageLogger, commandAudit, writer, properties, masker);
    }

    private WebSocketSession open(String id) throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        Map<String, Object> attributes = new HashMap<>();
        attributes.put(OcppHandshakeInterceptor.CHARGE_POINT_CODE, CP);
        attributes.put(OcppHandshakeInterceptor.ATTR_REMOTE, "203.0.113.9");
        attributes.put(OcppHandshakeInterceptor.ATTR_FORWARDED_FOR, "198.51.100.7");
        attributes.put(OcppHandshakeInterceptor.ATTR_USER_AGENT, "HardhitterFirmware/1.0");
        attributes.put(OcppHandshakeInterceptor.ATTR_OFFERED, "ocpp2.0.1");
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        when(session.getAttributes()).thenReturn(attributes);
        when(session.getAcceptedProtocol()).thenReturn("ocpp2.0.1");
        when(session.getRemoteAddress()).thenReturn(new InetSocketAddress("203.0.113.9", 50000));
        org.mockito.Mockito.doAnswer(invocation -> {
            sent.add(((TextMessage) invocation.getArgument(0)).getPayload());
            return null;
        }).when(session).sendMessage(any(WebSocketMessage.class));
        handler.afterConnectionEstablished(session);
        return session;
    }

    private void receive(WebSocketSession session, String payload) throws Exception {
        handler.handleTextMessage(session, new TextMessage(payload));
    }

    private JsonNode lastSent() throws Exception {
        return mapper.readTree(sent.get(sent.size() - 1));
    }

    // ---------------------------------------------------------------- failures

    @Test
    void shouldLogMalformedJsonWithRawPayloadStackAndChargePoint_andAnswerFormationViolation() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "{this is :: not json");

            List<ILoggingEvent> warns = capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN);
            assertThat(warns).hasSize(1);
            ILoggingEvent warn = warns.get(0);
            assertThat(warn.getFormattedMessage()).contains("MALFORMED JSON from " + CP).contains("{this is :: not json");
            assertThat(warn.getThrowableProxy()).as("stack trace attached").isNotNull();
            assertThat(warn.getMDCPropertyMap()).containsEntry("chargePointId", CP).containsEntry("sessionId", "ws-1");
            // the raw frame was logged before parsing
            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME)).anyMatch(l -> l.startsWith("FRAME IN") && l.endsWith("{this is :: not json"));
        }
        assertThat(lastSent().get(0).asInt()).isEqualTo(4);
        assertThat(lastSent().get(2).asText()).isEqualTo("FormationViolation");
    }

    @Test
    void shouldWarnAboutInvalidFrames_andAnswerFormationViolation() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "{\"not\":\"an array\"}");
            receive(session, "[2,\"short\"]");
            receive(session, "[\"two\",\"id\",\"Heartbeat\",{}]");

            assertThat(capture.matching("INVALID OCPP-J FRAME from " + CP)).hasSize(3);
            assertThat(capture.matching("INVALID OCPP-J FRAME").get(0)).contains("{\"not\":\"an array\"}");
        }
        assertThat(sent).filteredOn(s -> s.contains("FormationViolation")).hasSize(3);
    }

    @Test
    void shouldWarnAboutUnknownMessageType_andNotReply() throws Exception {
        WebSocketSession session = open("ws-1");
        int before = sent.size();

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "[9,\"id-9\",\"Heartbeat\",{}]");

            assertThat(capture.matching("UNKNOWN MESSAGE TYPE 9 from " + CP)).hasSize(1);
        }
        assertThat(sent).hasSize(before);
    }

    @Test
    void shouldWarnWithFullPayload_andAnswerNotSupported_forAnUnknownAction() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "[2,\"id-1\",\"DataTransfer\",{\"vendorId\":\"Hardhitter\",\"data\":\"abc\"}]");

            assertThat(capture.matching("UNKNOWN ACTION 'DataTransfer' from " + CP)).singleElement().asString()
                    .contains("\"vendorId\":\"Hardhitter\"").contains("\"data\":\"abc\"");
        }
        assertThat(lastSent().get(2).asText()).isEqualTo("NotSupported");
        assertThat(lastSent().get(1).asText()).isEqualTo("id-1");
    }

    @Test
    void shouldLogStackAndSendInternalError_whenTheHandlerThrows_withoutClosingTheSocket() throws Exception {
        WebSocketSession session = open("ws-1");
        doThrow(new IllegalStateException("database exploded")).when(chargePointService).recordHeartbeat(CP);

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "[2,\"hb-1\",\"Heartbeat\",{}]");

            List<ILoggingEvent> errors = capture.events(OcppWebSocketHandler.class.getName(), Level.ERROR);
            assertThat(errors).hasSize(1);
            assertThat(errors.get(0).getFormattedMessage()).contains("action Heartbeat").contains(CP)
                    .contains("messageId=hb-1").contains("sessionId=ws-1");
            assertThat(errors.get(0).getThrowableProxy().getMessage()).isEqualTo("database exploded");
            assertThat(errors.get(0).getMDCPropertyMap()).containsEntry("chargePointId", CP).containsEntry("messageId", "hb-1")
                    .containsEntry("action", "Heartbeat");
        }
        assertThat(lastSent().get(0).asInt()).isEqualTo(4);
        assertThat(lastSent().get(1).asText()).isEqualTo("hb-1");
        assertThat(lastSent().get(2).asText()).isEqualTo("InternalError");
        verify(session, never()).close(any());
    }

    @Test
    void shouldWarnAboutMissingRequiredFields_butStillProcessTheFrame() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "[2,\"b-1\",\"BootNotification\",{}]");

            assertThat(capture.matching("MISSING REQUIRED FIELD(S) in BootNotification from " + CP)).hasSize(1);
        }
        verify(chargePointService).recordBoot(CP, null);
        assertThat(lastSent().get(2).get("status").asText()).isEqualTo("Accepted");
        assertThat(lastSent().get(2).get("interval").asInt()).isEqualTo(30);
    }

    @Test
    void shouldLogBinaryFrames_andCloseTheSession() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.handleBinaryMessage(session, new BinaryMessage(new byte[]{1, 2, 3}));

            assertThat(capture.matching("BINARY FRAME from " + CP)).hasSize(1);
            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME)).anyMatch(l -> l.contains("BINARY size=3B"));
        }
        verify(session).close(any(CloseStatus.class));
    }

    @Test
    void shouldLogTransportErrorsWithFullThrowableChargePointAndSessionId_thenClose() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.handleTransportError(session, new java.io.EOFException("peer reset"));

            ILoggingEvent event = capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN).get(0);
            assertThat(event.getFormattedMessage()).contains("TRANSPORT ERROR chargePointId=" + CP).contains("sessionId=ws-1");
            assertThat(event.getThrowableProxy().getClassName()).isEqualTo("java.io.EOFException");
        }
        verify(session).close(CloseStatus.SERVER_ERROR);
    }

    // ---------------------------------------------------------------- command results

    private String sendCommand(UUID chargeSessionId, String action) {
        return registry.send(CP, action, chargeSessionId, "[2,\"__MESSAGE_ID__\",\"" + action + "\",{\"evseId\":1}]",
                new OcppConnectionRegistry.CommandInfo(1, 1, null, "test reason", null));
    }

    @Test
    void shouldMatchCallResultByMessageId_withLatencyStatusAndReasonCode() throws Exception {
        WebSocketSession session = open("ws-1");
        UUID chargeSessionId = UUID.randomUUID();
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            String messageId = sendCommand(chargeSessionId, "RequestStartTransaction");
            Thread.sleep(20);
            receive(session, "[3,\"" + messageId + "\",{\"status\":\"Rejected\",\"statusInfo\":{\"reasonCode\":\"NoCable\",\"additionalInfo\":\"plug in first\"}}]");

            String line = capture.matching("COMMAND RESULT RequestStartTransaction").get(0);
            assertThat(line).contains("messageId=" + messageId).contains("chargeSessionId=" + chargeSessionId)
                    .contains("status=Rejected").contains("reasonCode=NoCable").contains("additionalInfo=plug in first");
            assertThat(line).containsPattern("latency=\\d+ms");
            assertThat(capture.matching("COMMAND SENT RequestStartTransaction")).singleElement().asString()
                    .contains("evse=1").contains("connector=1").contains("reason=\"test reason\"");
            ArgumentCaptor<OcppConnectionRegistry.PendingCommand> command = ArgumentCaptor.forClass(OcppConnectionRegistry.PendingCommand.class);
            verify(chargeSessionService).handleCommandResult(command.capture(), any(JsonNode.class), eq(null));
            assertThat(command.getValue().messageId()).isEqualTo(messageId);
        }
        OcppCommandLog row = writer.rows(OcppCommandLog.class).get(0);
        assertThat(row.getOutcome()).isEqualTo(OcppCommandLog.Outcome.RESULT);
        assertThat(row.getResponseStatus()).isEqualTo("Rejected");
        assertThat(row.getReasonCode()).isEqualTo("NoCable");
        assertThat(row.getLatencyMs()).isGreaterThanOrEqualTo(15);
        assertThat(row.getChargeSessionId()).isEqualTo(chargeSessionId);
    }

    @Test
    void shouldCaptureCallErrorCodeDescriptionAndDetails() throws Exception {
        WebSocketSession session = open("ws-1");
        UUID chargeSessionId = UUID.randomUUID();
        String messageId = sendCommand(chargeSessionId, "UnlockConnector");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "[4,\"" + messageId + "\",\"GenericError\",\"lock motor jammed\",{\"motor\":\"stuck\"}]");

            String line = capture.matching("COMMAND ERROR UnlockConnector").get(0);
            assertThat(line).contains("errorCode=GenericError").contains("errorDescription=\"lock motor jammed\"")
                    .contains("errorDetails={\"motor\":\"stuck\"}").contains("messageId=" + messageId);
            assertThat(capture.events(OcppLoggers.COMMANDS_NAME, Level.WARN)).hasSize(1);
        }
        // business behaviour unchanged: the description is what the session service receives
        verify(chargeSessionService).handleCommandResult(any(), eq(null), eq("lock motor jammed"));
        OcppCommandLog row = writer.rows(OcppCommandLog.class).get(0);
        assertThat(row.getOutcome()).isEqualTo(OcppCommandLog.Outcome.ERROR);
        assertThat(row.getErrorCode()).isEqualTo("GenericError");
        assertThat(row.getErrorDescription()).isEqualTo("lock motor jammed");
        assertThat(row.getDetail()).contains("stuck");
    }

    @Test
    void shouldWarnWithPayload_whenAReplyMatchesNoPendingCommand() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "[3,\"ghost-1\",{\"status\":\"Accepted\"}]");
            receive(session, "[4,\"ghost-2\",\"InternalError\",\"x\",{}]");

            assertThat(capture.matching("UNMATCHED CALLRESULT messageId=ghost-1")).singleElement().asString()
                    .contains("{\"status\":\"Accepted\"}");
            assertThat(capture.matching("UNMATCHED CALLERROR messageId=ghost-2")).hasSize(1);
            assertThat(capture.events(OcppLoggers.COMMANDS_NAME, Level.WARN)).hasSize(2);
        }
        verify(chargeSessionService, never()).handleCommandResult(any(), any(), any());
    }

    @Test
    void shouldRecognizeALateReply_afterTheCommandTimedOut() throws Exception {
        WebSocketSession session = open("ws-1");
        String messageId = sendCommand(UUID.randomUUID(), "RequestStopTransaction");
        registry.expire(Duration.ZERO);

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "[3,\"" + messageId + "\",{\"status\":\"Accepted\"}]");

            assertThat(capture.matching("LATE REPLY to RequestStopTransaction messageId=" + messageId)).hasSize(1);
        }
        verify(chargeSessionService, never()).handleCommandResult(any(), any(), any());
    }

    @Test
    void shouldLogAndSurvive_whenApplyingAReplyFails() throws Exception {
        WebSocketSession session = open("ws-1");
        String messageId = sendCommand(UUID.randomUUID(), "UnlockConnector");
        doThrow(new IllegalStateException("cannot save")).when(chargeSessionService).handleCommandResult(any(), any(), any());

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "[3,\"" + messageId + "\",{\"status\":\"Unlocked\"}]");

            assertThat(capture.events(OcppWebSocketHandler.class.getName(), Level.ERROR)).hasSize(1);
        }
        verify(session, never()).close(any());
    }

    // ---------------------------------------------------------------- lifecycle and the reconnect fix

    @Test
    void shouldLogConnectWithSessionRemoteSubprotocolAndBothClocks_andStoreIt() throws Exception {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            open("ws-1");

            String line = capture.matching("CONNECTED chargePointId=" + CP).get(0);
            assertThat(line).contains("sessionId=ws-1").contains("remote=203.0.113.9").contains("negotiatedSubprotocol=ocpp2.0.1")
                    .contains("serverTimeUtc=").contains("serverTimeNepal=").contains("+05:45");
        }
        verify(chargePointService).markConnected(CP);
        OcppConnectionLog row = writer.rows(OcppConnectionLog.class).get(0);
        assertThat(row.getEvent()).isEqualTo(OcppConnectionLog.Event.CONNECTED);
        assertThat(row.getWsSessionId()).isEqualTo("ws-1");
        assertThat(row.getRemoteAddr()).isEqualTo("203.0.113.9");
        assertThat(row.getForwardedFor()).isEqualTo("198.51.100.7");
    }

    @Test
    void shouldLogDisconnectWithCloseCodeReasonDurationFramesAndIdleTime() throws Exception {
        WebSocketSession session = open("ws-1");
        receive(session, "[2,\"hb-1\",\"Heartbeat\",{}]");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.afterConnectionClosed(session, new CloseStatus(1006, "no close frame"));

            String line = capture.matching("DISCONNECTED chargePointId=" + CP).get(0);
            assertThat(line).contains("sessionId=ws-1").contains("closeCode=1006").contains("abnormal closure")
                    .contains("reason=\"no close frame\"").contains("framesIn=1").contains("framesOut=1")
                    .contains("sinceLastFrame=").contains("duration=").contains("wasCurrentSession=true");
            assertThat(capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN)).hasSize(1);
        }
        verify(chargePointService).markDisconnected(CP);
        OcppConnectionLog row = writer.rows(OcppConnectionLog.class).stream()
                .filter(r -> r.getEvent() == OcppConnectionLog.Event.DISCONNECTED).findFirst().orElseThrow();
        assertThat(row.getCloseCode()).isEqualTo(1006);
        assertThat(row.getDetail()).contains("framesIn=1").contains("closeReason=no close frame");
    }

    @Test
    void shouldLogANormalCloseAtInfo() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.afterConnectionClosed(session, CloseStatus.NORMAL);

            assertThat(capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN)).isEmpty();
            assertThat(capture.matching("closeCode=1000 (normal closure)")).hasSize(1);
        }
    }

    @Test
    void shouldKeepTheChargerOnline_whenAStaleSessionClosesAfterAQuickReconnect() throws Exception {
        WebSocketSession stale = open("ws-old");
        String pendingOnOldConnection = sendCommand(UUID.randomUUID(), "UnlockConnector");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            WebSocketSession fresh = open("ws-new"); // the charger reconnected before the old close arrived

            assertThat(capture.matching("RECONNECT chargePointId=" + CP)).singleElement().asString()
                    .contains("newSessionId=ws-new").contains("oldSessionId=ws-old").contains("last frame");
            verify(stale).close(any(CloseStatus.class)); // the replaced socket is closed

            handler.afterConnectionClosed(stale, new CloseStatus(1006));

            assertThat(capture.matching("STALE session ws-old")).hasSize(1);
            assertThat(capture.matching("wasCurrentSession=false")).hasSize(1);
            verify(chargePointService, never()).markDisconnected(CP);
            assertThat(registry.isConnected(CP)).isTrue();
            // the new connection's own pending commands were not wiped
            String onNew = sendCommand(UUID.randomUUID(), "RequestStopTransaction");
            handler.afterConnectionClosed(stale, new CloseStatus(1006));
            assertThat(registry.pendingCount(CP)).isEqualTo(2);
            assertThat(onNew).isNotEqualTo(pendingOnOldConnection);

            // when the CURRENT session finally closes, the charger goes offline and its commands are reported lost
            handler.afterConnectionClosed(fresh, CloseStatus.GOING_AWAY);
            verify(chargePointService, times(1)).markDisconnected(CP);
            assertThat(registry.isConnected(CP)).isFalse();
            assertThat(capture.matching("COMMAND LOST")).hasSize(2);
        }
        assertThat(writer.rows(OcppConnectionLog.class)).extracting(OcppConnectionLog::getEvent)
                .contains(OcppConnectionLog.Event.RECONNECT);
        assertThat(writer.rows(OcppCommandLog.class)).extracting(OcppCommandLog::getOutcome)
                .containsOnly(OcppCommandLog.Outcome.DISCONNECTED);
    }

    @Test
    void shouldLogEveryPong_atDebugWithTheDelaySinceOurPing() throws Exception {
        WebSocketSession session = open("ws-1");
        OcppConnectionState state = (OcppConnectionState) session.getAttributes().get(OcppConnectionState.ATTRIBUTE);
        state.lastPingAt(java.time.Instant.now().minusMillis(40));

        try (LogCapture capture = LogCapture.atEveryLevel().with(OcppLoggers.LIFECYCLE_NAME, Level.DEBUG)) {
            handler.handlePongMessage(session, new PongMessage(ByteBuffer.allocate(0)));

            assertThat(capture.matching("PONG received from " + CP)).hasSize(1);
        }
        assertThat(state.lastPongAt()).isNotNull();
    }

    // ---------------------------------------------------------------- frames end to end through the handler

    @Test
    void shouldLogAndStoreEveryInboundAndOutboundFrame_includingTheReplies() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, "[2,\"s-1\",\"StatusNotification\",{\"timestamp\":\"2026-10-15T10:00:00Z\",\"connectorStatus\":\"Occupied\",\"evseId\":1,\"connectorId\":1}]");

            List<String> frames = capture.textsFrom(OcppLoggers.FRAMES_NAME);
            assertThat(frames).hasSize(2);
            assertThat(frames.get(0)).startsWith("FRAME IN ");
            assertThat(frames.get(1)).startsWith("FRAME OUT").endsWith("[3,\"s-1\",{}]");
        }
        assertThat(writer.rows(OcppMessageLog.class)).extracting(OcppMessageLog::getDirection, OcppMessageLog::getAction)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("IN", "StatusNotification"),
                        org.assertj.core.groups.Tuple.tuple("OUT", "StatusNotification"));
        verify(chargePointService).recordStatus(CP, "Occupied");
    }

    @Test
    void shouldGoThroughOneChokePoint_forEveryOutboundFrame() throws Exception {
        WebSocketSession session = open("ws-1");
        receive(session, "[2,\"x\",\"Nope\",{}]");                      // CALLERROR NotSupported
        receive(session, "garbage");                                    // CALLERROR FormationViolation
        receive(session, "[2,\"h\",\"Heartbeat\",{}]");                 // CALLRESULT
        sendCommand(UUID.randomUUID(), "UnlockConnector");              // command

        assertThat(sent).hasSize(4);
        long outRows = writer.rows(OcppMessageLog.class).stream().filter(r -> r.getDirection().equals("OUT")).count();
        assertThat(outRows).as("every frame handed to the socket has an OUT row").isEqualTo(sent.size());
    }
    // ---------------------------------------------------------------- finding D-05: what a charger may make the app store

    private String statusNotification(String connectorStatus) throws Exception {
        return mapper.createArrayNode().add(2).add("s-" + sent.size()).add("StatusNotification")
                .add(mapper.createObjectNode().put("timestamp", "2026-10-15T10:00:00Z").put("connectorStatus", connectorStatus)
                        .put("evseId", 1).put("connectorId", 1)).toString();
    }

    private String bootNotification(String serialNumber) throws Exception {
        com.fasterxml.jackson.databind.node.ObjectNode station = mapper.createObjectNode().put("model", "HD-D180").put("vendorName", "V");
        if (serialNumber != null) station.put("serialNumber", serialNumber);
        return mapper.createArrayNode().add(2).add("b-" + sent.size()).add("BootNotification")
                .add(mapper.createObjectNode().put("reason", "PowerUp").set("chargingStation", station)).toString();
    }

    private String transactionEvent(String transactionId) throws Exception {
        com.fasterxml.jackson.databind.node.ObjectNode payload = mapper.createObjectNode();
        payload.put("eventType", "Updated").put("timestamp", "2026-10-15T10:00:00Z").put("triggerReason", "MeterValuePeriodic").put("seqNo", 1);
        payload.putObject("transactionInfo").put("transactionId", transactionId);
        return mapper.createArrayNode().add(2).add("t-" + sent.size()).add("TransactionEvent").add(payload).toString();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Available", "Occupied", "Reserved", "Unavailable", "Faulted"})
    void shouldStoreEachStandardConnectorStatus(String status) throws Exception {
        WebSocketSession session = open("ws-1");

        receive(session, statusNotification(status));

        verify(chargePointService).recordStatus(CP, status);
        assertThat(lastSent().get(0).asInt()).isEqualTo(3);
    }

    @Test
    void shouldAnswerPropertyConstraintViolation_andStoreNothing_whenTheConnectorStatusIsNotAStandardOne() throws Exception {
        WebSocketSession session = open("ws-1");

        receive(session, statusNotification("Y".repeat(200)));
        receive(session, statusNotification("Charging"));

        assertThat(sent).hasSize(2);
        for (String frame : sent) {
            JsonNode reply = mapper.readTree(frame);
            assertThat(reply.get(0).asInt()).isEqualTo(4);
            assertThat(reply.get(2).asText()).isEqualTo("PropertyConstraintViolation");
            assertThat(reply.get(3).asText()).doesNotContain("YYYYY").doesNotContain("Charging");
        }
        verify(chargePointService, never()).recordStatus(any(), any());
        verify(session, never()).close();
        verify(session, never()).close(any());
    }

    @Test
    void shouldAnswerFormationViolation_whenTheConnectorStatusIsMissingOrNotText() throws Exception {
        WebSocketSession session = open("ws-1");

        receive(session, "[2,\"s-1\",\"StatusNotification\",{\"timestamp\":\"2026-10-15T10:00:00Z\",\"evseId\":1,\"connectorId\":1}]");
        receive(session, "[2,\"s-2\",\"StatusNotification\",{\"connectorStatus\":null}]");
        receive(session, "[2,\"s-3\",\"StatusNotification\",{\"connectorStatus\":12}]");

        assertThat(sent).hasSize(3);
        for (String frame : sent) {
            JsonNode reply = mapper.readTree(frame);
            assertThat(reply.get(0).asInt()).isEqualTo(4);
            assertThat(reply.get(2).asText()).isEqualTo("FormationViolation");
        }
        verify(chargePointService, never()).recordStatus(any(), any());
    }

    @Test
    void shouldKeepAnsweringAfterARefusedStatus_andNeverShowTheBadValueAsAConnectorChange() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, statusNotification("W".repeat(200)));
            receive(session, "[2,\"hb-1\",\"Heartbeat\",{}]");
            receive(session, statusNotification("Occupied"));

            assertThat(capture.matching("CONNECTOR STATUS CHANGE")).as("only the real status is tracked").hasSize(1);
            assertThat(capture.matching("REJECTED StatusNotification from " + CP)).hasSize(1);
            assertThat(capture.matching("REJECTED StatusNotification")).singleElement().asString().doesNotContain("W".repeat(70));
        }
        assertThat(sent).hasSize(3);
        assertThat(mapper.readTree(sent.get(1)).get(0).asInt()).isEqualTo(3);
        verify(chargePointService).recordHeartbeat(CP);
        verify(chargePointService).recordStatus(CP, "Occupied");
    }

    @Test
    void shouldAcceptTheBootButNotStoreASerialThatDoesNotFit() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, bootNotification("S".repeat(26)));
            receive(session, bootNotification("has a space"));

            assertThat(capture.matching("serial number does not fit")).hasSize(2);
            assertThat(capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN).stream()
                    .map(ILoggingEvent::getFormattedMessage).filter(m -> m.contains("serial number does not fit")))
                    .noneMatch(m -> m.contains("S".repeat(40)));
        }
        verify(chargePointService, times(2)).recordBoot(CP, null);
        for (String frame : sent) {
            JsonNode reply = mapper.readTree(frame);
            assertThat(reply.get(0).asInt()).isEqualTo(3);
            assertThat(reply.get(2).get("status").asText()).isEqualTo("Accepted");
        }
    }

    @Test
    void shouldStoreAValidSerial_andStaySilentAboutAMissingOrBlankOne() throws Exception {
        WebSocketSession session = open("ws-1");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, bootNotification("SN-123.a_b"));
            receive(session, bootNotification(null));
            receive(session, bootNotification("  "));

            assertThat(capture.matching("serial number does not fit")).isEmpty();
        }
        verify(chargePointService).recordBoot(CP, "SN-123.a_b");
        verify(chargePointService, times(2)).recordBoot(CP, null);
    }

    @Test
    void shouldAnswerPropertyConstraintViolation_andChangeNoSession_whenATransactionIdIsLongerThan36() throws Exception {
        WebSocketSession session = open("ws-1");

        receive(session, transactionEvent("T".repeat(37)));

        JsonNode reply = lastSent();
        assertThat(reply.get(0).asInt()).isEqualTo(4);
        assertThat(reply.get(2).asText()).isEqualTo("PropertyConstraintViolation");
        assertThat(reply.get(3).asText()).doesNotContain("TTTTT");
        verify(chargeSessionService, never()).handleTransactionEvent(any(), any());
        verify(session, never()).close(any());
    }

    @Test
    void shouldPassATransactionIdOf36CharactersOn() throws Exception {
        WebSocketSession session = open("ws-1");

        receive(session, transactionEvent("T".repeat(36)));

        assertThat(lastSent().get(0).asInt()).isEqualTo(3);
        verify(chargeSessionService).handleTransactionEvent(eq(CP), any());
    }

    @Test
    void shouldSayTheCommandFailed_whenAChargersErrorAnswerCarriesNoText() throws Exception {
        WebSocketSession session = open("ws-1");
        String messageId = sendCommand(UUID.randomUUID(), "RequestStartTransaction");

        receive(session, "[4,\"" + messageId + "\",\"GenericError\"]");

        verify(chargeSessionService).handleCommandResult(any(), eq(null), eq("OCPP command failed"));
    }

    @Test
    void shouldCutAChargersErrorText_beforeItReachesTheSessionAndTheStoredRow() throws Exception {
        WebSocketSession session = open("ws-1");
        String messageId = sendCommand(UUID.randomUUID(), "RequestStartTransaction");

        receive(session, "[4,\"" + messageId + "\",\"" + "C".repeat(300) + "\",\"" + "D".repeat(5000) + "\",{}]");

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(chargeSessionService).handleCommandResult(any(), eq(null), text.capture());
        assertThat(text.getValue()).startsWith("D".repeat(200)).endsWith("...(5000 chars)").hasSizeLessThanOrEqualTo(230);
        OcppCommandLog row = writer.rows(OcppCommandLog.class).get(0);
        assertThat(row.getErrorCode()).as("the stored column holds 64").isEqualTo("C".repeat(64));
        assertThat(row.getErrorDescription()).as("fits the 500-character column").startsWith("D".repeat(200)).hasSizeLessThanOrEqualTo(230);
    }

    // ---------------------------------------------------------------- finding D-04: a connection that floods or goes silent

    private String heartbeat(int n) {
        return "[2,\"hb-" + n + "\",\"Heartbeat\",{}]";
    }

    private OcppConnectionState stateOf(WebSocketSession session) {
        return OcppConnectionState.of(session, CP);
    }

    private static final CloseStatus SILENT = new CloseStatus(OcppWebSocketHandler.SILENT_CLOSE_CODE, "no messages from the charger");

    @Test
    void shouldGiveEachNewConnectionTheConfiguredAllowance() throws Exception {
        properties.setMaxFramesPerSecond(0.001); // practically no refill: only the burst counts
        properties.setFrameBurst(5);
        WebSocketSession session = open("ws-1");

        FrameRateLimiter limiter = stateOf(session).frameLimiter();

        assertThat(limiter).as("a connection gets a limiter when the rate is set").isNotNull();
        assertThat(limiter.perSecond()).as("the configured rate").isEqualTo(0.001);
        assertThat(limiter.burst()).as("the configured burst").isEqualTo(5);
        for (int i = 0; i < 5; i++) assertThat(limiter.tryAcquire()).isTrue();
        assertThat(limiter.tryAcquire()).isFalse();
    }

    @Test
    void shouldNotLimitAConnection_whenTheRateIsSwitchedOff() throws Exception {
        properties.setMaxFramesPerSecond(0);
        WebSocketSession session = open("ws-1");

        assertThat(stateOf(session).frameLimiter()).isNull();
        for (int i = 0; i < 300; i++) receive(session, heartbeat(i));

        verify(chargePointService, times(300)).recordHeartbeat(CP);
        verify(session, never()).close(any(CloseStatus.class));
    }

    @Test
    void shouldHandleAStartUpBurstOfFortyFrames_underTheDefaultAllowance() throws Exception {
        WebSocketSession session = open("ws-1");

        for (int i = 0; i < 40; i++) receive(session, heartbeat(i));

        verify(chargePointService, times(40)).recordHeartbeat(CP);
        verify(session, never()).close(any(CloseStatus.class));
        assertThat(sent).hasSize(40);
    }

    @Test
    void shouldCloseWith1008AndHandleNothingMore_whenAChargerSendsMoreThanItsAllowance() throws Exception {
        WebSocketSession session = open("ws-1");
        stateOf(session).frameLimiter(new FrameRateLimiter(20, 5, () -> 0L)); // a frozen clock: exactly 5 frames fit

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            for (int i = 0; i < 8; i++) receive(session, heartbeat(i));

            verify(chargePointService, times(5)).recordHeartbeat(CP);
            ArgumentCaptor<CloseStatus> closed = ArgumentCaptor.forClass(CloseStatus.class);
            verify(session, times(1)).close(closed.capture());
            assertThat(closed.getValue().getCode()).isEqualTo(1008);
            assertThat(closed.getValue().getReason()).isEqualTo("too many messages");
            assertThat(capture.matching("FLOOD chargePointId=" + CP)).as("one line, not one per frame").singleElement()
                    .asString().contains("sessionId=ws-1").contains("20.0 frames/s").contains("burst 5").contains("1008");
            assertThat(capture.matching("FRAME IN")).as("the refused frames are not even logged").hasSize(5);
            assertThat(capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN)).anyMatch(e -> e.getFormattedMessage().startsWith("FLOOD"));
        }
        assertThat(sent).as("only the five accepted frames were answered").hasSize(5);
        verify(chargePointService, times(1)).markDisconnected(CP);
        assertThat(registry.isConnected(CP)).isFalse();
        assertThat(writer.rows(OcppConnectionLog.class)).filteredOn(r -> r.getEvent() == OcppConnectionLog.Event.DISCONNECTED)
                .singleElement().satisfies(row -> assertThat(row.getCloseCode()).isEqualTo(1008));
    }

    @Test
    void shouldKeepCountingFramesOverTime_soASlowTrickleIsNeverRefused() throws Exception {
        WebSocketSession session = open("ws-1");
        long[] now = {0};
        stateOf(session).frameLimiter(new FrameRateLimiter(20, 5, () -> now[0]));

        for (int i = 0; i < 100; i++) {
            now[0] += 100_000_000L; // 10 frames a second
            receive(session, heartbeat(i));
        }

        verify(chargePointService, times(100)).recordHeartbeat(CP);
        verify(session, never()).close(any(CloseStatus.class));
    }

    @Test
    void shouldIgnoreFramesThatArriveAfterTheConnectionWasDropped() throws Exception {
        WebSocketSession session = open("ws-1");
        handler.dropConnection(session, SILENT);

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            receive(session, heartbeat(1));

            assertThat(capture.events()).as("nothing is logged for a frame the app has stopped listening to").isEmpty();
        }
        verify(chargePointService, never()).recordHeartbeat(CP);
        assertThat(sent).isEmpty();
    }

    @Test
    void shouldCloseTheSocketMarkTheChargerOfflineAndFailItsCommands_whenAConnectionIsDropped() throws Exception {
        WebSocketSession session = open("ws-1");
        sendCommand(UUID.randomUUID(), "UnlockConnector");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.dropConnection(session, SILENT);

            ArgumentCaptor<CloseStatus> closed = ArgumentCaptor.forClass(CloseStatus.class);
            verify(session).close(closed.capture());
            assertThat(closed.getValue().getCode()).isEqualTo(4002);
            verify(chargePointService, times(1)).markDisconnected(CP);
            assertThat(registry.isConnected(CP)).isFalse();
            assertThat(capture.matching("COMMAND LOST")).hasSize(1);
            assertThat(capture.matching("DISCONNECTED chargePointId=" + CP)).singleElement().asString()
                    .contains("closeCode=4002").contains("no messages from the charger for too long")
                    .contains("reason=\"no messages from the charger\"").contains("wasCurrentSession=true");
            assertThat(capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN)).as("a dropped connection is a warning").isNotEmpty();
        }
        assertThat(writer.rows(OcppConnectionLog.class)).filteredOn(r -> r.getEvent() == OcppConnectionLog.Event.DISCONNECTED)
                .singleElement().satisfies(row -> {
                    assertThat(row.getCloseCode()).isEqualTo(4002);
                    assertThat(row.getDetail()).contains("closeReason=no messages from the charger");
                });
    }

    @Test
    void shouldRunTheCloseBookkeepingOnce_whenTheContainerReportsTheCloseAfterwards() throws Exception {
        WebSocketSession session = open("ws-1");
        handler.dropConnection(session, SILENT);

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.afterConnectionClosed(session, new CloseStatus(1006, "no close frame")); // the late report

            assertThat(capture.matching("DISCONNECTED chargePointId=")).as("no second DISCONNECTED line").isEmpty();
            assertThat(capture.matching("STALE session")).isEmpty();
        }
        verify(chargePointService, times(1)).markDisconnected(CP);
        assertThat(writer.rows(OcppConnectionLog.class)).filteredOn(r -> r.getEvent() == OcppConnectionLog.Event.DISCONNECTED)
                .hasSize(1);
    }

    @Test
    void shouldRunTheCloseBookkeepingOnce_whenTheContainerReportsTheSameCloseTwice() throws Exception {
        WebSocketSession session = open("ws-1");

        handler.afterConnectionClosed(session, CloseStatus.GOING_AWAY);
        handler.afterConnectionClosed(session, CloseStatus.GOING_AWAY);

        verify(chargePointService, times(1)).markDisconnected(CP);
        assertThat(writer.rows(OcppConnectionLog.class)).filteredOn(r -> r.getEvent() == OcppConnectionLog.Event.DISCONNECTED)
                .hasSize(1);
    }

    @Test
    void shouldStillRunTheBookkeeping_whenTheSocketCannotBeClosed() throws Exception {
        WebSocketSession session = open("ws-1");
        doThrow(new IOException("broken pipe")).when(session).close(any(CloseStatus.class));

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.dropConnection(session, SILENT);

            assertThat(capture.matching("Could not close session ws-1 of " + CP)).singleElement().asString().contains("broken pipe");
        }
        verify(chargePointService, times(1)).markDisconnected(CP);
        assertThat(registry.isConnected(CP)).isFalse();
    }

    @Test
    void shouldStillRunTheBookkeeping_whenClosingTheSocketThrowsAnUncheckedError() throws Exception {
        WebSocketSession session = open("ws-1");
        doThrow(new IllegalStateException("session already closed")).when(session).close(any(CloseStatus.class));

        handler.dropConnection(session, SILENT);

        verify(chargePointService, times(1)).markDisconnected(CP);
        assertThat(registry.isConnected(CP)).isFalse();
    }

    @Test
    void shouldNotAskASocketThatIsAlreadyClosedToCloseAgain_butStillRunTheBookkeeping() throws Exception {
        WebSocketSession session = open("ws-1");
        when(session.isOpen()).thenReturn(false);

        handler.dropConnection(session, SILENT);

        verify(session, never()).close(any(CloseStatus.class));
        verify(chargePointService, times(1)).markDisconnected(CP);
    }

    @Test
    void shouldLeaveTheNewerConnectionAlone_whenAnOlderOneIsDropped() throws Exception {
        WebSocketSession old = open("ws-old");
        open("ws-new"); // the charger reconnected: this one is the registered connection now

        handler.dropConnection(old, SILENT);

        verify(chargePointService, never()).markDisconnected(CP);
        assertThat(registry.isConnected(CP)).isTrue();
    }
}

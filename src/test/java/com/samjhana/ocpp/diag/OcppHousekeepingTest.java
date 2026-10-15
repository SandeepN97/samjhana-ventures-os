package com.samjhana.ocpp.diag;

import ch.qos.logback.classic.Level;
import com.samjhana.entity.OcppCommandLog;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.ocpp.OcppConnectionRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
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

class OcppHousekeepingTest {

    private OcppLoggingProperties properties;
    private RecordingAuditWriter writer;
    private OcppConnectionRegistry registry;
    private OcppHousekeeping housekeeping;
    private OcppFrameSender sender;

    @BeforeEach
    void setUp() {
        properties = new OcppLoggingProperties();
        writer = new RecordingAuditWriter(properties);
        sender = mock(OcppFrameSender.class);
        LockEvidenceTracker evidence = mock(LockEvidenceTracker.class);
        OcppCommandAudit audit = new OcppCommandAudit(writer, evidence);
        registry = new OcppConnectionRegistry(sender, audit);
        housekeeping = new OcppHousekeeping(registry, audit, writer, properties);
    }

    private WebSocketSession socket(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        Map<String, Object> attributes = new HashMap<>();
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        when(session.getAttributes()).thenReturn(attributes);
        return session;
    }

    private OcppConnectionState connect(String code, WebSocketSession session, Instant connectedAt) {
        OcppConnectionState state = new OcppConnectionState(session.getId(), code, "10.0.0.5", "ocpp2.0.1", connectedAt, 30);
        registry.register(code, session, state);
        return state;
    }

    // ---------------------------------------------------------------- idle detector

    @Test
    void shouldWarnOnce_whenNoFrameArrivesForMoreThanTwiceTheHeartbeatInterval() {
        connect("CP-1", socket("ws-1"), Instant.now().minusSeconds(61));

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            housekeeping.checkIdle();
            housekeeping.checkIdle(); // same idle episode: no second warning

            assertThat(capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN)).hasSize(1);
            assertThat(capture.matching("IDLE chargePointId=CP-1")).singleElement().asString()
                    .contains("threshold 60s").contains("2.0 x heartbeat interval 30s");
            assertThat(capture.events().get(0).getMDCPropertyMap()).containsEntry("chargePointId", "CP-1");
        }
        assertThat(writer.rows(OcppConnectionLog.class)).singleElement().satisfies(row -> {
            assertThat(row.getEvent()).isEqualTo(OcppConnectionLog.Event.IDLE_WARNING);
            assertThat(row.getChargePointId()).isEqualTo("CP-1");
            assertThat(row.getReason()).startsWith("NO_FRAME_");
        });
    }

    @Test
    void shouldStayQuiet_whenFramesAreArrivingInTime_andRewarnAfterAnIdleEpisodeEnds() {
        OcppConnectionState state = connect("CP-1", socket("ws-1"), Instant.now().minusSeconds(61));
        housekeeping.checkIdle();
        assertThat(state.idleWarnedAt()).isNotNull();

        state.lastFrameAt(Instant.now()); // the charger spoke again
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            housekeeping.checkIdle();
            assertThat(capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN)).isEmpty();
        }
        assertThat(state.idleWarnedAt()).isNull();

        state.lastFrameAt(Instant.now().minusSeconds(120)); // and went silent again
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            housekeeping.checkIdle();
            assertThat(capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN)).hasSize(1);
        }
    }

    @Test
    void shouldFollowTheHeartbeatIntervalTheChargerWasGiven() {
        OcppConnectionState state = connect("CP-1", socket("ws-1"), Instant.now().minusSeconds(61));
        state.heartbeatIntervalSeconds(300); // threshold becomes 600s

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            housekeeping.checkIdle();
            assertThat(capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN)).isEmpty();
        }
    }

    // ---------------------------------------------------------------- command timeout

    @Test
    void shouldWarnAndRecordTimedOut_whenACommandGetsNoReply() throws Exception {
        connect("CP-1", socket("ws-1"), Instant.now());
        UUID chargeSessionId = UUID.randomUUID();
        String messageId = registry.send("CP-1", "RequestStartTransaction", chargeSessionId,
                "[2,\"__MESSAGE_ID__\",\"RequestStartTransaction\",{}]",
                new OcppConnectionRegistry.CommandInfo(1, null, "BA***21", "staff started a charging session", null));
        properties.setCommandTimeout(Duration.ofMillis(1));
        Thread.sleep(15);

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            housekeeping.sweepCommands();
            housekeeping.sweepCommands(); // already swept

            assertThat(capture.matching("COMMAND TIMEOUT RequestStartTransaction messageId=" + messageId)).hasSize(1);
            assertThat(capture.events(OcppLoggers.COMMANDS_NAME, Level.WARN)).hasSize(1);
        }
        assertThat(writer.rows(OcppCommandLog.class)).singleElement().satisfies(row -> {
            assertThat(row.getOutcome()).isEqualTo(OcppCommandLog.Outcome.TIMED_OUT);
            assertThat(row.getMessageId()).isEqualTo(messageId);
            assertThat(row.getChargeSessionId()).isEqualTo(chargeSessionId);
            assertThat(row.getReason()).isEqualTo("staff started a charging session");
            assertThat(row.getEvseId()).isEqualTo(1);
        });
        assertThat(registry.consumePending("CP-1", messageId)).isNull();
        assertThat(registry.findRecentlyExpired("CP-1", messageId)).isNotNull();
    }

    @Test
    void shouldNotTimeOutACommand_beforeTheTimeoutHasPassed() {
        connect("CP-1", socket("ws-1"), Instant.now());
        registry.send("CP-1", "UnlockConnector", UUID.randomUUID(), "[2,\"__MESSAGE_ID__\",\"UnlockConnector\",{}]");

        housekeeping.sweepCommands();

        assertThat(writer.rows(OcppCommandLog.class)).isEmpty();
        assertThat(registry.pendingCount("CP-1")).isEqualTo(1);
    }

    // ---------------------------------------------------------------- pings

    @Test
    void shouldNotPing_byDefault() throws Exception {
        WebSocketSession session = socket("ws-1");
        connect("CP-1", session, Instant.now());

        housekeeping.sendPings();

        verify(session, never()).sendMessage(any());
    }

    @Test
    void shouldPingAtTheConfiguredInterval_andLogIt() throws Exception {
        properties.setPingInterval(Duration.ofSeconds(60));
        WebSocketSession session = socket("ws-1");
        OcppConnectionState state = connect("CP-1", session, Instant.now());

        try (LogCapture capture = LogCapture.atEveryLevel().with(OcppLoggers.LIFECYCLE_NAME, Level.DEBUG)) {
            housekeeping.sendPings();
            housekeeping.sendPings(); // not due yet

            verify(session, times(1)).sendMessage(any(PingMessage.class));
            assertThat(capture.matching("PING sent to CP-1")).hasSize(1);
        }
        assertThat(state.lastPingAt()).isNotNull();
    }

    @Test
    void shouldSurviveAFailingPing() throws Exception {
        properties.setPingInterval(Duration.ofSeconds(1));
        WebSocketSession session = socket("ws-1");
        doThrow(new java.io.IOException("broken pipe")).when(session).sendMessage(any());
        connect("CP-1", session, Instant.now());

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            housekeeping.sendPings();
            assertThat(capture.matching("PING to CP-1 failed")).hasSize(1);
        }
    }

    @Test
    void shouldRunEveryCheckFromTheTick() {
        connect("CP-1", socket("ws-1"), Instant.now().minusSeconds(120));

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            housekeeping.tick();
            assertThat(capture.matching("IDLE chargePointId=CP-1")).hasSize(1);
        }
    }
}

package com.samjhana.websocket;

import ch.qos.logback.classic.Level;
import com.samjhana.ocpp.OcppConnectionRegistry;
import com.samjhana.ocpp.diag.LockEvidenceTracker;
import com.samjhana.ocpp.diag.LogCapture;
import com.samjhana.ocpp.diag.OcppCommandAudit;
import com.samjhana.ocpp.diag.OcppConnectionState;
import com.samjhana.ocpp.diag.OcppFrameSender;
import com.samjhana.ocpp.diag.OcppLoggers;
import com.samjhana.ocpp.diag.OcppLoggingProperties;
import com.samjhana.ocpp.diag.RecordingAuditWriter;
import com.samjhana.service.ChargePointService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Finding D-04: a charger whose connection has gone quiet is hung up on and shown OFFLINE (it used to stay ONLINE for as long as
 * the dead connection was open), and a charger the database still calls ONLINE with no connection is corrected.
 */
class OcppLivenessSweepTest {

    private OcppLoggingProperties properties;
    private OcppConnectionRegistry registry;
    private OcppWebSocketHandler handler;
    private ChargePointService chargePointService;
    private OcppLivenessSweep sweep;

    @BeforeEach
    void setUp() {
        properties = new OcppLoggingProperties();
        RecordingAuditWriter writer = new RecordingAuditWriter(properties);
        OcppCommandAudit audit = new OcppCommandAudit(writer, mock(LockEvidenceTracker.class));
        registry = new OcppConnectionRegistry(mock(OcppFrameSender.class), audit);
        handler = mock(OcppWebSocketHandler.class);
        chargePointService = mock(ChargePointService.class);
        sweep = new OcppLivenessSweep(registry, handler, chargePointService, properties);
    }

    private WebSocketSession socket(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        Map<String, Object> attributes = new HashMap<>();
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        when(session.getAttributes()).thenReturn(attributes);
        return session;
    }

    /** Registers a connection whose last frame was {@code silentFor} ago. */
    private WebSocketSession connect(String code, Duration silentFor) {
        WebSocketSession session = socket("ws-" + code);
        registry.register(code, session, new OcppConnectionState(session.getId(), code, "10.0.0.5", "ocpp2.0.1",
                Instant.now().minus(silentFor), 30));
        return session;
    }

    private CloseStatus droppedWith(WebSocketSession session) {
        ArgumentCaptor<CloseStatus> status = ArgumentCaptor.forClass(CloseStatus.class);
        verify(handler).dropConnection(eq(session), status.capture());
        return status.getValue();
    }

    // ---------------------------------------------------------------- silent connections

    @Test
    void shouldDropAConnection_thatHasSentNothingForMoreThanThreeHeartbeatIntervals() {
        WebSocketSession silent = connect("CP-1", Duration.ofSeconds(95)); // limit: 3 x 30 s = 90 s

        sweep.closeSilentConnections();

        CloseStatus status = droppedWith(silent);
        assertThat(status.getCode()).isEqualTo(4002);
        assertThat(status.getReason()).isEqualTo("no messages from the charger");
    }

    @Test
    void shouldLeaveAConnectionAlone_thatIsStillInsideTheLimit() {
        connect("CP-1", Duration.ofSeconds(80));
        connect("CP-2", Duration.ofSeconds(2));

        sweep.closeSilentConnections();

        verify(handler, never()).dropConnection(any(), any());
    }

    @Test
    void shouldFollowTheHeartbeatIntervalTheChargerWasGiven() {
        WebSocketSession session = socket("ws-CP-1");
        OcppConnectionState state = new OcppConnectionState("ws-CP-1", "CP-1", "10.0.0.5", "ocpp2.0.1",
                Instant.now().minusSeconds(600), 300); // told to check in every 300 s: the limit is 900 s
        registry.register("CP-1", session, state);

        sweep.closeSilentConnections();
        verify(handler, never()).dropConnection(any(), any());

        state.lastFrameAt(Instant.now().minusSeconds(901));
        sweep.closeSilentConnections();
        droppedWith(session);
    }

    @Test
    void shouldFollowTheConfiguredFactor() {
        properties.setCloseFactor(5.0); // 150 s
        WebSocketSession session = connect("CP-1", Duration.ofSeconds(120));

        sweep.closeSilentConnections();
        verify(handler, never()).dropConnection(any(), any());

        registry.connections().get(0).state().lastFrameAt(Instant.now().minusSeconds(151));
        sweep.closeSilentConnections();
        droppedWith(session);
    }

    @Test
    void shouldNeverDrop_whenTheFactorIsZero() {
        properties.setCloseFactor(0);
        connect("CP-1", Duration.ofHours(5));

        sweep.closeSilentConnections();

        verify(handler, never()).dropConnection(any(), any());
    }

    @Test
    void shouldNeverDrop_whenTheFactorIsNotANumber() {
        properties.setCloseFactor(Double.NaN);
        connect("CP-1", Duration.ofHours(5));

        sweep.closeSilentConnections();

        verify(handler, never()).dropConnection(any(), any());
    }

    @Test
    void shouldNeverDrop_whenTheConnectionWasGivenNoHeartbeatInterval() {
        WebSocketSession session = socket("ws-CP-1");
        registry.register("CP-1", session, new OcppConnectionState("ws-CP-1", "CP-1", "10.0.0.5", "ocpp2.0.1",
                Instant.now().minus(Duration.ofHours(5)), 0));

        sweep.closeSilentConnections();

        verify(handler, never()).dropConnection(any(), any());
    }

    @Test
    void shouldDropOnlyTheSilentOnes_andPassTheContainersOwnSession() {
        WebSocketSession silent = connect("CP-1", Duration.ofMinutes(10));
        connect("CP-2", Duration.ofSeconds(5));
        WebSocketSession silentToo = connect("CP-3", Duration.ofMinutes(4));

        sweep.closeSilentConnections();

        droppedWith(silent);
        droppedWith(silentToo);
        verify(handler, org.mockito.Mockito.times(2)).dropConnection(any(), any());
    }

    @Test
    void shouldSpareAConnectionThatSpokeJustBeforeItWasDropped() {
        WebSocketSession session = socket("ws-CP-1");
        Instant longAgo = Instant.now().minus(Duration.ofMinutes(5));
        // the first look says "silent", the look right before dropping finds a frame that just arrived
        OcppConnectionState state = new OcppConnectionState("ws-CP-1", "CP-1", "10.0.0.5", "ocpp2.0.1", longAgo, 30) {
            private int looks;

            @Override
            public Instant lastFrameAt() {
                return looks++ == 0 ? longAgo : Instant.now();
            }
        };
        registry.register("CP-1", session, state);

        sweep.closeSilentConnections();

        verify(handler, never()).dropConnection(any(), any());
    }

    @Test
    void shouldCarryOnWithTheNextConnection_whenDroppingOneFails() {
        WebSocketSession first = connect("CP-1", Duration.ofMinutes(10));
        WebSocketSession second = connect("CP-2", Duration.ofMinutes(10));
        doThrow(new IllegalStateException("boom")).when(handler).dropConnection(eq(first), any());
        doThrow(new IllegalStateException("boom")).when(handler).dropConnection(eq(second), any());

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            sweep.closeSilentConnections();

            assertThat(capture.matching("Could not drop")).as("each failure is reported, neither stops the other").hasSize(2);
        }
        verify(handler).dropConnection(eq(first), any());
        verify(handler).dropConnection(eq(second), any());
    }

    @Test
    void shouldWarnWithTheChargerTheSilenceAndTheLimit_whenItDropsAConnection() {
        connect("CP-1", Duration.ofSeconds(130));

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            sweep.closeSilentConnections();

            assertThat(capture.matching("DEAD CONNECTION chargePointId=CP-1")).singleElement().asString()
                    .contains("sessionId=ws-CP-1").contains("no frame for 130s").contains("limit 90s")
                    .contains("3.0 x heartbeat interval 30s").contains("4002");
            assertThat(capture.events(OcppLoggers.LIFECYCLE_NAME, Level.WARN)).hasSize(1);
            assertThat(capture.events().get(0).getMDCPropertyMap()).containsEntry("chargePointId", "CP-1");
        }
    }

    // ---------------------------------------------------------------- ONLINE rows with no connection

    @Test
    void shouldCorrectAnOnlineRowThatHasNoConnection_andLeaveAConnectedChargerAlone() {
        connect("CP-2", Duration.ofSeconds(1));
        when(chargePointService.onlineChargerCodes()).thenReturn(List.of("CP-1", "CP-2"));
        LocalDateTime before = LocalDateTime.now();

        sweep.correctStaleOnlineRows();

        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(chargePointService).markOfflineIfStale(eq("CP-1"), cutoff.capture());
        verify(chargePointService, never()).markOfflineIfStale(eq("CP-2"), any());
        // "not heard from for 3 x 30 s"
        assertThat(cutoff.getValue()).isBetween(before.minusSeconds(90), LocalDateTime.now().minusSeconds(90));
    }

    @Test
    void shouldUseTheConfiguredHeartbeatInterval_forTheRowCutoff() {
        properties.setHeartbeatInterval(Duration.ofSeconds(60)); // 3 x 60 s = 180 s
        when(chargePointService.onlineChargerCodes()).thenReturn(List.of("CP-1"));
        LocalDateTime before = LocalDateTime.now();

        sweep.correctStaleOnlineRows();

        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(chargePointService).markOfflineIfStale(eq("CP-1"), cutoff.capture());
        assertThat(cutoff.getValue()).isBetween(before.minusSeconds(180), LocalDateTime.now().minusSeconds(180));
    }

    @Test
    void shouldDoNothingToRows_whenThereIsNoHeartbeatIntervalToMeasureAgainst() {
        properties.setHeartbeatInterval(Duration.ZERO);
        when(chargePointService.onlineChargerCodes()).thenReturn(List.of("CP-1"));

        sweep.correctStaleOnlineRows();

        verify(chargePointService, never()).markOfflineIfStale(anyString(), any());
    }

    @Test
    void shouldDoNothingToRows_whenTheFactorIsZero() {
        properties.setCloseFactor(0);
        when(chargePointService.onlineChargerCodes()).thenReturn(List.of("CP-1"));

        sweep.correctStaleOnlineRows();

        verify(chargePointService, never()).markOfflineIfStale(anyString(), any());
    }

    @Test
    void shouldCarryOnWithTheNextRow_whenCorrectingOneFails() {
        when(chargePointService.onlineChargerCodes()).thenReturn(List.of("CP-1", "CP-2"));
        doThrow(new IllegalStateException("database down")).when(chargePointService).markOfflineIfStale(eq("CP-1"), any());

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            sweep.correctStaleOnlineRows();

            assertThat(capture.matching("Could not correct")).singleElement().asString().contains("CP-1");
        }
        verify(chargePointService).markOfflineIfStale(eq("CP-2"), any());
    }

    // ---------------------------------------------------------------- the schedule

    @Test
    void shouldRunBothChecksFromOneSweep_andNotStopAtAFailure() {
        WebSocketSession silent = connect("CP-1", Duration.ofMinutes(10));
        doThrow(new IllegalStateException("boom")).when(handler).dropConnection(eq(silent), any());
        when(chargePointService.onlineChargerCodes()).thenReturn(List.of("CP-9"));

        sweep.sweep();

        verify(chargePointService).markOfflineIfStale(eq("CP-9"), any());
    }

    @Test
    void shouldStillCorrectTheRows_whenTheConnectionCheckFailsAsAWhole() {
        OcppLoggingProperties flaky = new OcppLoggingProperties() {
            private int reads;

            @Override
            public double getCloseFactor() {
                if (reads++ == 0) throw new IllegalStateException("settings unreadable"); // only the first check
                return super.getCloseFactor();
            }
        };
        sweep = new OcppLivenessSweep(registry, handler, chargePointService, flaky);
        when(chargePointService.onlineChargerCodes()).thenReturn(List.of("CP-9"));

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            sweep.sweep();

            assertThat(capture.matching("Liveness sweep: closing silent connections failed")).hasSize(1);
        }
        verify(chargePointService).markOfflineIfStale(eq("CP-9"), any());
    }

    @Test
    void shouldRunTheSweepFromTheScheduledTick() {
        WebSocketSession silent = connect("CP-1", Duration.ofMinutes(10));
        when(chargePointService.onlineChargerCodes()).thenReturn(List.of("CP-9"));

        sweep.tick();

        droppedWith(silent);
        verify(chargePointService).markOfflineIfStale(eq("CP-9"), any());
    }

    @Test
    void shouldNotLetAnUnexpectedErrorEscapeTheScheduledTick() {
        when(chargePointService.onlineChargerCodes()).thenThrow(new IllegalStateException("database down"));

        sweep.tick(); // an exception here would be swallowed by the scheduler, but must not even be thrown
    }

    @Test
    void shouldBeScheduledEveryFifteenSeconds() throws Exception {
        Scheduled scheduled = OcppLivenessSweep.class.getDeclaredMethod("tick").getAnnotation(Scheduled.class);

        assertThat(scheduled).as("tick() must be a scheduled task").isNotNull();
        assertThat(Duration.parse(scheduled.fixedDelayString())).isEqualTo(Duration.ofSeconds(15));
    }
}

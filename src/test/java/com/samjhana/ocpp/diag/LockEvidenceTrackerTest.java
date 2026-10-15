package com.samjhana.ocpp.diag;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.OcppSessionEvidence;
import com.samjhana.ocpp.OcppConnectionRegistry.PendingCommand;
import com.samjhana.repository.ChargeSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class LockEvidenceTrackerTest {

    private static final String CP = "CP-1";
    private final UUID sessionId = UUID.randomUUID();
    private RecordingAuditWriter writer;
    private LockEvidenceTracker tracker;

    @BeforeEach
    void setUp() {
        OcppLoggingProperties properties = new OcppLoggingProperties();
        writer = new RecordingAuditWriter(properties);
        tracker = new LockEvidenceTracker(writer, mock(ChargeSessionRepository.class), properties, new ObjectMapper());
    }

    private PendingCommand command(String action, String txId) {
        return new PendingCommand("m-" + action, action, sessionId, LocalDateTime.now(), Instant.now(), CP, "ws-1",
                1, 1, null, "test", txId);
    }

    @Test
    void shouldReportReleasedBeforeOurUnlock_whenConnectorBecomesAvailableAfterStop() throws Exception {
        tracker.commandSent(command("RequestStopTransaction", "TX-1"));
        tracker.commandAnswered(command("RequestStopTransaction", "TX-1"), "Accepted");
        tracker.transactionEnded(CP, "TX-1", "Local", "StopAuthorized");
        tracker.connectorStatus(CP, 1, 1, "Occupied", "Available");
        Thread.sleep(5);
        tracker.commandSent(command("UnlockConnector", null));
        tracker.commandAnswered(command("UnlockConnector", null), "Unlocked");
        tracker.connectorStatus(CP, 1, 1, "Available", "Occupied");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            tracker.emitAll();

            String line = capture.textsFrom(OcppLoggers.LOCK_EVIDENCE_NAME).get(0);
            assertThat(capture.textsFrom(OcppLoggers.LOCK_EVIDENCE_NAME)).hasSize(1);
            assertThat(line).contains("session=" + sessionId).contains("cp=CP-1").contains("tx=TX-1")
                    .contains("STOP_SENT").contains("STOP_REPLY Accepted").contains("TX_ENDED stoppedReason=Local")
                    .contains("CONNECTOR_STATUS evse=1 connector=1 Occupied->Available").contains("UNLOCK_SENT")
                    .contains("UNLOCK_REPLY Unlocked").contains("STATUS_AFTER_UNLOCK")
                    .contains("verdict=RELEASED_BEFORE_OUR_UNLOCK");
        }
        OcppSessionEvidence row = writer.rows(OcppSessionEvidence.class).get(0);
        assertThat(row.getChargeSessionId()).isEqualTo(sessionId);
        assertThat(row.getOcppTransactionId()).isEqualTo("TX-1");
        assertThat(row.getEvents()).contains("\"kind\":\"UNLOCK_SENT\"");
    }

    @Test
    void shouldReportReleasedAfterOurUnlock_whenConnectorOnlyFreesAfterTheUnlockReply() {
        tracker.commandSent(command("RequestStopTransaction", "TX-1"));
        tracker.transactionEnded(CP, "TX-1", "Local", "StopAuthorized");
        tracker.commandSent(command("UnlockConnector", null));
        tracker.commandAnswered(command("UnlockConnector", null), "Unlocked");
        tracker.connectorStatus(CP, 1, 1, "Occupied", "Available");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            tracker.emitAll();

            assertThat(capture.textsFrom(OcppLoggers.LOCK_EVIDENCE_NAME).get(0)).contains("verdict=RELEASED_AFTER_OUR_UNLOCK");
        }
    }

    @Test
    void shouldSayReleaseNotObserved_whenNoAvailableStatusFollows() {
        tracker.commandSent(command("RequestStopTransaction", "TX-1"));
        tracker.commandAnswered(command("RequestStopTransaction", "TX-1"), "Rejected");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            tracker.emitAll();

            assertThat(capture.textsFrom(OcppLoggers.LOCK_EVIDENCE_NAME).get(0))
                    .contains("STOP_REPLY Rejected").contains("verdict=RELEASE_NOT_OBSERVED");
        }
    }

    @Test
    void shouldIgnoreStatusChangesOnOtherConnectors() {
        tracker.commandSent(command("RequestStopTransaction", "TX-1"));
        tracker.connectorStatus(CP, 1, 2, "Occupied", "Available");
        tracker.connectorStatus("OTHER-CP", 1, 1, "Occupied", "Available");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            tracker.emitAll();

            assertThat(capture.textsFrom(OcppLoggers.LOCK_EVIDENCE_NAME).get(0)).contains("verdict=RELEASE_NOT_OBSERVED")
                    .doesNotContain("Occupied->Available");
        }
    }

    @Test
    void shouldEmitOnlySessionsThatWentQuiet() {
        OcppLoggingProperties properties = new OcppLoggingProperties();
        properties.setLockEvidenceQuiet(java.time.Duration.ofMillis(-1)); // everything counts as quiet
        LockEvidenceTracker quick = new LockEvidenceTracker(writer, mock(ChargeSessionRepository.class), properties, new ObjectMapper());
        quick.commandSent(command("RequestStopTransaction", "TX-1"));

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            quick.emitQuietSessions();
            quick.emitQuietSessions(); // already emitted: nothing more

            assertThat(capture.textsFrom(OcppLoggers.LOCK_EVIDENCE_NAME)).hasSize(1);
        }
    }

    @Test
    void shouldStartEvidenceAtEnded_whenNoStopWasSentByUs() {
        tracker.transactionEnded(CP, "TX-9", "EVDisconnected", "EVCommunicationLost");

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            tracker.emitAll();

            assertThat(capture.textsFrom(OcppLoggers.LOCK_EVIDENCE_NAME).get(0)).contains("tx=TX-9")
                    .contains("TX_ENDED stoppedReason=EVDisconnected");
        }
    }
}

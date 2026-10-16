package com.samjhana.ocpp.diag;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.OcppMessageLog;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OcppFrameLoggerTest {

    private OcppLoggingProperties properties;
    private RecordingAuditWriter writer;
    private OcppFrameLogger frames;
    private OcppConnectionState state;

    @BeforeEach
    void setUp() {
        properties = new OcppLoggingProperties();
        writer = new RecordingAuditWriter(properties);
        frames = new OcppFrameLogger(properties, new JsonMasker(new ObjectMapper()), writer);
        state = new OcppConnectionState("ws-1", "CP-1", "10.0.0.5", "ocpp2.0.1", Instant.now(), 30);
    }

    @Test
    void shouldLogInboundFrameInFull_withChargePointDirectionAndSize() {
        String frame = "[2,\"m-1\",\"BootNotification\",{\"reason\":\"PowerUp\"}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            frames.inbound(state, frame);

            List<String> lines = capture.textsFrom(OcppLoggers.FRAMES_NAME);
            assertThat(lines).hasSize(1);
            assertThat(lines.get(0)).startsWith("FRAME IN ").contains("size=" + frame.length() + "B").endsWith(frame);
            assertThat(capture.events().get(0).getMDCPropertyMap())
                    .containsEntry("chargePointId", "CP-1").containsEntry("sessionId", "ws-1")
                    .containsEntry("messageId", "m-1").containsEntry("action", "BootNotification");
        }
        OcppMessageLog row = writer.rows(OcppMessageLog.class).get(0);
        assertThat(row.getChargePointId()).isEqualTo("CP-1");
        assertThat(row.getDirection()).isEqualTo("IN");
        assertThat(row.getAction()).isEqualTo("BootNotification");
        assertThat(row.getMessageType()).isEqualTo(2);
        assertThat(row.getMessageId()).isEqualTo("m-1");
        assertThat(row.getPayload()).isEqualTo(frame);
        assertThat(row.getPayloadSize()).isEqualTo(frame.length());
        assertThat(row.isDiscovery()).isFalse();
        assertThat(state.framesIn().get()).isEqualTo(1);
    }

    @Test
    void shouldTagResponsesWithTheActionTheyAnswer() {
        frames.inbound(state, "[2,\"m-1\",\"StatusNotification\",{}]");
        frames.outbound(state, "[3,\"m-1\",{}]");
        frames.outbound(state, "[2,\"c-1\",\"UnlockConnector\",{\"evseId\":1}]");
        frames.inbound(state, "[3,\"c-1\",{\"status\":\"Unlocked\"}]");

        assertThat(writer.rows(OcppMessageLog.class)).extracting(OcppMessageLog::getDirection, OcppMessageLog::getAction,
                        OcppMessageLog::getMessageType)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("IN", "StatusNotification", 2),
                        org.assertj.core.groups.Tuple.tuple("OUT", "StatusNotification", 3),
                        org.assertj.core.groups.Tuple.tuple("OUT", "UnlockConnector", 2),
                        org.assertj.core.groups.Tuple.tuple("IN", "UnlockConnector", 3));
        assertThat(state.framesOut().get()).isEqualTo(2);
    }

    @Test
    void shouldMaskIdTokenInLogAndDatabase() {
        String frame = "[2,\"m-2\",\"RequestStartTransaction\",{\"idToken\":{\"idToken\":\"BA1PA4521\",\"type\":\"Central\"}}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            frames.outbound(state, frame);

            assertThat(capture.anyContains("BA1PA4521")).isFalse();
            assertThat(capture.anyContains("BA***21")).isTrue();
        }
        assertThat(writer.rows(OcppMessageLog.class).get(0).getPayload()).contains("BA***21").doesNotContain("BA1PA4521");
    }

    @Test
    void shouldLogMalformedJsonExactlyAsReceived() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            frames.inbound(state, "this is not json");

            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME)).singleElement().asString().endsWith("this is not json");
        }
        OcppMessageLog row = writer.rows(OcppMessageLog.class).get(0);
        assertThat(row.getMessageType()).isNull();
        assertThat(row.getPayload()).isEqualTo("this is not json");
    }

    @Test
    void shouldSampleHeartbeats_firstNInFullThenOneSummaryPerTen() {
        properties.setHeartbeatFullFrames(3);
        properties.setHeartbeatSummaryEvery(10);

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            for (int i = 1; i <= 33; i++) {
                frames.inbound(state, "[2,\"hb-" + i + "\",\"Heartbeat\",{}]");
                frames.outbound(state, "[3,\"hb-" + i + "\",{\"currentTime\":\"2026-01-01T00:00:00Z\"}]");
            }

            List<String> lines = capture.textsFrom(OcppLoggers.FRAMES_NAME);
            long inFull = lines.stream().filter(l -> l.startsWith("FRAME IN")).count();
            long outFull = lines.stream().filter(l -> l.startsWith("FRAME OUT")).count();
            List<String> summaries = lines.stream().filter(l -> l.startsWith("HEARTBEAT summary")).toList();
            assertThat(inFull).isEqualTo(3);
            assertThat(outFull).isEqualTo(3);
            assertThat(summaries).hasSize(3); // heartbeats #13, #23 and #33
            assertThat(summaries.get(0)).contains("13 Heartbeats");
        }
        assertThat(writer.rows(OcppMessageLog.class)).hasSize(6);
        assertThat(state.framesIn().get()).isEqualTo(33); // counters still count every frame
        assertThat(state.framesOut().get()).isEqualTo(33);
    }

    @Test
    void shouldLogEveryHeartbeat_whenSamplingLimitIsHigh() {
        properties.setHeartbeatFullFrames(20);
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            for (int i = 1; i <= 20; i++) frames.inbound(state, "[2,\"hb-" + i + "\",\"Heartbeat\",{}]");
            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME)).hasSize(20);
        }
    }

    @Test
    void shouldFlagOversizedFramesAsWarn_andTruncateTheLogLine() {
        properties.setMaxFrameBytes(100);
        properties.setOversizedLogChars(50);
        String big = "[2,\"m\",\"NotifyReport\",{\"x\":\"" + "a".repeat(500) + "\"}]";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            frames.inbound(state, big);

            assertThat(capture.events(OcppLoggers.FRAMES_NAME, ch.qos.logback.classic.Level.WARN)).hasSize(1);
            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME).get(0)).contains("OVERSIZED").contains("limit 100B");
        }
        assertThat(writer.rows(OcppMessageLog.class).get(0).getPayloadSize()).isEqualTo(big.length());
    }

    @Test
    void shouldCutStoredPayloads_beyondTheConfiguredLimit() {
        properties.setMaxStoredPayloadChars(40);
        frames.inbound(state, "[2,\"m\",\"NotifyReport\",{\"x\":\"" + "a".repeat(200) + "\"}]");

        assertThat(writer.rows(OcppMessageLog.class).get(0).getPayload()).endsWith("...[truncated]").hasSize(40 + 14);
    }

    @Test
    void shouldLogBinaryFramesAsWarnWithHexPreview() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            frames.binary(state, new byte[]{0x01, 0x02, (byte) 0xff});

            assertThat(capture.events(OcppLoggers.FRAMES_NAME, ch.qos.logback.classic.Level.WARN)).hasSize(1);
            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME).get(0)).contains("BINARY size=3B").contains("0102ff");
        }
        assertThat(writer.rows(OcppMessageLog.class).get(0).getPayload()).contains("binary frame, 3 bytes");
    }

    @Test
    void shouldKeepAFrameOnOneLogLine_butStoreItByteForByte() {
        String forged = "[2,\"m\",\"Heartbeat\",{}]\n2026-10-15T10:00:00.000+05:45 [x] INFO FORGED LINE\r\nmore";

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            frames.inbound(state, forged);

            String line = capture.textsFrom(OcppLoggers.FRAMES_NAME).get(0);
            assertThat(line).doesNotContain("\n").doesNotContain("\r").contains("\\nmore").contains("FORGED LINE");
        }
        assertThat(writer.rows(OcppMessageLog.class).get(0).getPayload()).isEqualTo(forged);
    }

    @Test
    void shouldLogNonArrayJson_andStillRecordIt() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            frames.inbound(state, "{\"hello\":\"world\"}");

            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME)).singleElement().asString().contains("{\"hello\":\"world\"}");
        }
        assertThat(writer.rows(OcppMessageLog.class).get(0).getMessageType()).isNull();
    }
}

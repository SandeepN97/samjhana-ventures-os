package com.samjhana.ocpp.diag;

import com.samjhana.entity.OcppCommandLog;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.entity.OcppMessageLog;
import com.samjhana.repository.OcppCommandLogRepository;
import com.samjhana.repository.OcppConnectionLogRepository;
import com.samjhana.repository.OcppMessageLogRepository;
import com.samjhana.repository.OcppSessionEvidenceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OcppAuditWriterTest {

    private OcppMessageLogRepository messages;
    private OcppConnectionLogRepository connections;
    private OcppLoggingProperties properties;
    private OcppAuditWriter writer;

    @BeforeEach
    void setUp() {
        messages = mock(OcppMessageLogRepository.class);
        connections = mock(OcppConnectionLogRepository.class);
        properties = new OcppLoggingProperties();
        properties.getPersistence().setQueueCapacity(5);
        writer = new OcppAuditWriter(messages, connections, mock(OcppCommandLogRepository.class),
                mock(OcppSessionEvidenceRepository.class), properties);
    }

    @Test
    void shouldWriteQueuedRowsInBatches_whenFlushed() {
        writer.enqueue(message("BootNotification"));
        writer.enqueue(connection());

        int taken = writer.flush();

        assertThat(taken).isEqualTo(2);
        verify(messages).saveAll(anyList());
        verify(connections).saveAll(anyList());
        assertThat(writer.queueSize()).isZero();
    }

    @Test
    void shouldDropOldestHeartbeatRowsFirst_whenQueueOverflows() {
        writer.enqueue(message("BootNotification"));
        writer.enqueue(message("Heartbeat"));
        writer.enqueue(message("StatusNotification"));
        writer.enqueue(message("Heartbeat"));
        writer.enqueue(message("TransactionEvent"));
        assertThat(writer.queueSize()).isEqualTo(5);

        writer.enqueue(message("TransactionEvent")); // overflow: oldest Heartbeat goes
        writer.enqueue(message("TransactionEvent")); // overflow: the second Heartbeat goes

        assertThat(writer.queueSize()).isEqualTo(5);
        assertThat(writer.droppedSinceLastReport()).isEqualTo(2);
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            writer.flush();
            assertThat(capture.matching("dropped 2 rows (Heartbeat rows first)")).hasSize(1);
        }
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<OcppMessageLog>> saved = ArgumentCaptor.forClass(List.class);
        verify(messages).saveAll(saved.capture());
        assertThat(saved.getValue()).extracting(OcppMessageLog::getAction).doesNotContain("Heartbeat");
    }

    @Test
    void shouldDropOldestRowOfAnyKind_whenQueueFullOfNonHeartbeats() {
        for (int i = 0; i < 6; i++) writer.enqueue(message("TransactionEvent"));

        assertThat(writer.queueSize()).isEqualTo(5);
        assertThat(writer.droppedSinceLastReport()).isEqualTo(1);
    }

    @Test
    void shouldNeverThrowAtTheCaller_whenTheInsertFails() {
        when(messages.saveAll(anyList())).thenThrow(new IllegalStateException("db down"));
        when(messages.save(any())).thenThrow(new IllegalStateException("db down"));
        writer.enqueue(message("BootNotification"));
        writer.enqueue(connection());

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            assertThatCode(() -> writer.flush()).doesNotThrowAnyException();
            assertThat(capture.matching("OCPP audit insert failed for 1 rows")).hasSize(1);
            assertThat(capture.matching("charger connection is unaffected")).hasSize(1);
        }
        // the other row type was still written
        verify(connections).saveAll(anyList());
    }

    @Test
    void shouldRetryRowByRow_soOneBadRowDoesNotHideTheOthers() {
        OcppMessageLog bad = message("Bad");
        OcppMessageLog good = message("Good");
        when(messages.saveAll(anyList())).thenThrow(new IllegalStateException("batch failed"));
        when(messages.save(bad)).thenThrow(new IllegalStateException("bad row"));
        writer.enqueue(bad);
        writer.enqueue(good);

        writer.flush();

        verify(messages).save(good);
        verify(messages, times(1)).save(bad);
    }

    @Test
    void shouldIgnoreRowsAndNullsWhenPersistenceDisabled() {
        properties.getPersistence().setEnabled(false);

        writer.enqueue(message("BootNotification"));
        writer.enqueue(null);

        assertThat(writer.queueSize()).isZero();
        verify(messages, never()).saveAll(anyList());
    }

    @Test
    void shouldNotBlockTheCaller_whenThousandsOfRowsArrive() {
        properties.getPersistence().setQueueCapacity(100);

        long started = System.nanoTime();
        for (int i = 0; i < 20_000; i++) writer.enqueue(message("TransactionEvent"));

        assertThat((System.nanoTime() - started) / 1_000_000).isLessThan(2_000);
        assertThat(writer.queueSize()).isEqualTo(100);
    }

    @Test
    void shouldAcceptCommandRowsToo() {
        writer.enqueue(OcppCommandLog.builder().chargePointId("X").messageId("m").action("A")
                .sentAt(Instant.now()).outcome(OcppCommandLog.Outcome.TIMED_OUT).build());

        assertThat(writer.flush()).isEqualTo(1);
    }

    @Test
    void shouldMakeAManualFlushWaitForAnInsertAlreadyInFlight_andNeverBlockEnqueue() throws Exception {
        java.util.concurrent.CountDownLatch insertStarted = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch releaseInsert = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.atomic.AtomicBoolean insertCommitted = new java.util.concurrent.atomic.AtomicBoolean();
        when(messages.saveAll(anyList())).thenAnswer(invocation -> {
            insertStarted.countDown();
            releaseInsert.await(5, java.util.concurrent.TimeUnit.SECONDS);
            insertCommitted.set(true);
            return invocation.getArgument(0);
        });
        writer.enqueue(message("TransactionEvent"));
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            // the "background thread": takes the batch off the queue and starts a slow insert
            java.util.concurrent.Future<Integer> background = pool.submit(writer::flush);
            assertThat(insertStarted.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            assertThat(writer.queueSize()).as("the batch is out of the queue, the insert is still running").isZero();

            // a caller that enqueues meanwhile is not held up by the in-flight insert
            long started = System.nanoTime();
            writer.enqueue(message("Heartbeat"));
            assertThat((System.nanoTime() - started) / 1_000_000).isLessThan(500);

            // a manual flush (a test, or shutdown) must wait for that insert instead of returning early
            java.util.concurrent.Future<Integer> manual = pool.submit(writer::flush);
            Thread.sleep(300);
            assertThat(manual.isDone()).as("manual flush must wait while an insert is in flight").isFalse();
            assertThat(insertCommitted).isFalse();

            releaseInsert.countDown();
            manual.get(5, java.util.concurrent.TimeUnit.SECONDS);
            assertThat(background.get(5, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(1);
            assertThat(insertCommitted).isTrue();
        } finally {
            releaseInsert.countDown();
            pool.shutdownNow();
        }
    }

    private static OcppMessageLog message(String action) {
        return OcppMessageLog.builder().chargePointId("CP").direction("IN").action(action).payload("[]")
                .payloadSize(2).receivedAt(Instant.now()).build();
    }

    private static OcppConnectionLog connection() {
        return OcppConnectionLog.builder().chargePointId("CP").event(OcppConnectionLog.Event.CONNECTED)
                .createdAt(Instant.now()).build();
    }
}

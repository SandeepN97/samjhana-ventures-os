package com.samjhana.ocpp.diag;

import com.samjhana.entity.OcppCommandLog;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.entity.OcppMessageLog;
import com.samjhana.entity.OcppSessionEvidence;
import com.samjhana.repository.OcppCommandLogRepository;
import com.samjhana.repository.OcppConnectionLogRepository;
import com.samjhana.repository.OcppMessageLogRepository;
import com.samjhana.repository.OcppSessionEvidenceRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Writes the OCPP audit rows to the database without ever slowing or breaking a charger connection.
 *
 * <p>Callers only {@link #enqueue(Object)}: a short lock, no I/O. A single background thread drains the
 * bounded queue in batches. When the queue is full the oldest Heartbeat message row is dropped first (then
 * the oldest row of any kind) and the drop count is reported with a WARN. A failing insert is logged and
 * the batch is retried row by row so one bad row cannot hide the others; nothing is ever thrown back at
 * the caller.
 */
@Component
@Slf4j
public class OcppAuditWriter {

    private static final long WARN_EVERY_MS = 30_000;

    private final OcppMessageLogRepository messages;
    private final OcppConnectionLogRepository connections;
    private final OcppCommandLogRepository commands;
    private final OcppSessionEvidenceRepository evidence;
    private final OcppLoggingProperties properties;

    private final Deque<Object> queue = new ArrayDeque<>();
    private final Object lock = new Object();
    private long dropped;
    private long failedRows;
    private long lastWarnAt;
    private ScheduledExecutorService worker;

    public OcppAuditWriter(OcppMessageLogRepository messages, OcppConnectionLogRepository connections,
                           OcppCommandLogRepository commands, OcppSessionEvidenceRepository evidence,
                           OcppLoggingProperties properties) {
        this.messages = messages;
        this.connections = connections;
        this.commands = commands;
        this.evidence = evidence;
        this.properties = properties;
    }

    @PostConstruct
    void start() {
        if (!properties.getPersistence().isEnabled()) {
            log.warn("OCPP audit persistence is disabled (ocpp.logging.persistence.enabled=false): "
                    + "frames and connection events will only exist in the log output");
            return;
        }
        worker = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "ocpp-audit-writer");
            thread.setDaemon(true);
            return thread;
        });
        long interval = Math.max(50, properties.getPersistence().getFlushInterval().toMillis());
        worker.scheduleWithFixedDelay(this::flushSafely, interval, interval, TimeUnit.MILLISECONDS);
    }

    @PreDestroy
    void stop() {
        if (worker != null) worker.shutdown();
        flushSafely();
    }

    /** Never blocks on I/O and never throws. */
    public void enqueue(Object row) {
        if (row == null || !properties.getPersistence().isEnabled()) return;
        synchronized (lock) {
            if (queue.size() >= properties.getPersistence().getQueueCapacity()) makeRoom();
            queue.addLast(row);
        }
    }

    private void makeRoom() {
        for (Iterator<Object> it = queue.iterator(); it.hasNext(); ) {
            Object row = it.next();
            if (row instanceof OcppMessageLog message && "Heartbeat".equals(message.getAction())) {
                it.remove();
                dropped++;
                return;
            }
        }
        queue.pollFirst();
        dropped++;
    }

    public int queueSize() {
        synchronized (lock) {
            return queue.size();
        }
    }

    public long droppedSinceLastReport() {
        synchronized (lock) {
            return dropped;
        }
    }

    private void flushSafely() {
        try {
            while (flush() > 0) {
                // keep draining until the queue is empty
            }
        } catch (RuntimeException ex) {
            log.warn("OCPP audit writer iteration failed: {}", ex.toString());
        }
    }

    /** Writes up to one batch; returns how many rows were taken from the queue. Public for tests and shutdown. */
    public int flush() {
        List<Object> batch = new ArrayList<>();
        long droppedNow;
        synchronized (lock) {
            int max = properties.getPersistence().getBatchSize();
            while (batch.size() < max && !queue.isEmpty()) batch.add(queue.pollFirst());
            droppedNow = dropped;
            dropped = 0;
        }
        if (droppedNow > 0) {
            log.warn("OCPP audit queue was full: dropped {} rows (Heartbeat rows first). "
                    + "The database is not keeping up; frames are still in the log output.", droppedNow);
        }
        if (batch.isEmpty()) return 0;
        List<OcppMessageLog> messageRows = new ArrayList<>();
        List<OcppConnectionLog> connectionRows = new ArrayList<>();
        List<OcppCommandLog> commandRows = new ArrayList<>();
        List<OcppSessionEvidence> evidenceRows = new ArrayList<>();
        for (Object row : batch) {
            if (row instanceof OcppMessageLog r) messageRows.add(r);
            else if (row instanceof OcppConnectionLog r) connectionRows.add(r);
            else if (row instanceof OcppCommandLog r) commandRows.add(r);
            else if (row instanceof OcppSessionEvidence r) evidenceRows.add(r);
        }
        save(messageRows, messages);
        save(connectionRows, connections);
        save(commandRows, commands);
        save(evidenceRows, evidence);
        return batch.size();
    }

    /** One batch insert; if it fails, retry row by row so a single bad row does not hide the rest. */
    private <T> void save(List<T> rows, JpaRepository<T, Long> repository) {
        if (rows.isEmpty()) return;
        try {
            repository.saveAll(rows);
        } catch (RuntimeException batchFailure) {
            int failed = 0;
            RuntimeException last = batchFailure;
            for (T row : rows) {
                try {
                    repository.save(row);
                } catch (RuntimeException rowFailure) {
                    failed++;
                    last = rowFailure;
                }
            }
            if (failed > 0) reportFailure(failed, last);
        }
    }

    private void reportFailure(int failed, RuntimeException last) {
        failedRows += failed;
        long now = System.currentTimeMillis();
        if (now - lastWarnAt >= WARN_EVERY_MS) {
            lastWarnAt = now;
            log.warn("OCPP audit insert failed for {} rows ({} since start); the charger connection is unaffected. Cause: {}",
                    failed, failedRows, rootMessage(last));
        }
    }

    private static String rootMessage(Throwable throwable) {
        Throwable root = throwable;
        while (root.getCause() != null && root.getCause() != root) root = root.getCause();
        return root.getClass().getSimpleName() + ": " + root.getMessage();
    }
}

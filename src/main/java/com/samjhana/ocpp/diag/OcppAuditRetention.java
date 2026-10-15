package com.samjhana.ocpp.diag;

import org.slf4j.Logger;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Deletes audit rows past the retention window (in bounded chunks, by indexed timestamp) and reports how
 * much database space the OCPP tables use, so the Supabase free-tier budget is never a surprise.
 */
@Component
public class OcppAuditRetention {

    private static final Logger LIFECYCLE = OcppLoggers.LIFECYCLE;
    private static final List<String[]> TABLES = List.of(
            new String[]{"ocpp_message_log", "received_at"},
            new String[]{"ocpp_connection_log", "created_at"},
            new String[]{"ocpp_command_log", "sent_at"},
            new String[]{"ocpp_session_evidence", "created_at"});

    private final JdbcTemplate jdbc;
    private final OcppLoggingProperties properties;

    public OcppAuditRetention(JdbcTemplate jdbc, OcppLoggingProperties properties) {
        this.jdbc = jdbc;
        this.properties = properties;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void reportAtStartup() {
        reportSize();
    }

    @Scheduled(cron = "${ocpp.logging.persistence.retention-cron:0 30 3 * * *}", zone = "Asia/Kathmandu")
    public void dailyJob() {
        purge();
        reportSize();
    }

    /** Returns the number of rows deleted. */
    public long purge() {
        Instant cutoff = Instant.now().minus(properties.getPersistence().getRetentionDays(), ChronoUnit.DAYS);
        long total = 0;
        for (String[] table : TABLES) {
            try {
                int deleted;
                do {
                    deleted = jdbc.update("delete from " + table[0] + " where id in (select id from " + table[0]
                                    + " where " + table[1] + " < ? order by id limit ?)",
                            cutoff.atOffset(java.time.ZoneOffset.UTC), properties.getPersistence().getRetentionChunk());
                    total += deleted;
                } while (deleted >= properties.getPersistence().getRetentionChunk());
            } catch (RuntimeException ex) {
                LIFECYCLE.warn("OCPP retention could not purge {}: {}", table[0], ex.toString());
            }
        }
        LIFECYCLE.info("OCPP retention: deleted {} rows older than {} days", total,
                properties.getPersistence().getRetentionDays());
        return total;
    }

    /** Logs rows and approximate size per table against the configured database budget. */
    public long reportSize() {
        long totalBytes = 0;
        StringBuilder detail = new StringBuilder();
        for (String[] table : TABLES) {
            try {
                Long rows = jdbc.queryForObject("select count(*) from " + table[0], Long.class);
                long bytes = tableBytes(table[0], rows == null ? 0 : rows);
                totalBytes += bytes;
                detail.append(' ').append(table[0]).append('=').append(rows).append(" rows/~")
                        .append(bytes / 1024).append("KB");
            } catch (RuntimeException ex) {
                detail.append(' ').append(table[0]).append("=unavailable(").append(ex.getClass().getSimpleName()).append(')');
            }
        }
        long budgetBytes = properties.getPersistence().getDbBudgetMb() * 1024 * 1024;
        double percent = budgetBytes == 0 ? 0 : 100.0 * totalBytes / budgetBytes;
        String line = "OCPP audit size:{} total ~{}KB = {}% of the {} MB database budget";
        if (percent >= 80) {
            LIFECYCLE.warn(line + ". Lower ocpp.logging.persistence.retention-days or purge now.", detail,
                    totalBytes / 1024, String.format("%.1f", percent), properties.getPersistence().getDbBudgetMb());
        } else {
            LIFECYCLE.info(line, detail, totalBytes / 1024, String.format("%.1f", percent),
                    properties.getPersistence().getDbBudgetMb());
        }
        return totalBytes;
    }

    private long tableBytes(String table, long rows) {
        try {
            Long bytes = jdbc.queryForObject("select pg_total_relation_size('" + table + "')", Long.class);
            if (bytes != null) return bytes;
        } catch (RuntimeException notPostgres) {
            // H2 (dev/test): estimate below
        }
        return rows * 600; // rough average row incl. index overhead
    }
}

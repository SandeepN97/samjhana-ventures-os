package com.samjhana.ocpp.diag;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Knobs for OCPP diagnostic logging and the database audit trail ({@code ocpp.logging.*}).
 * Every default is chosen for the first real-charger test window; see
 * docs/ocpp-first-connection-runbook.md for how to dial things down afterwards.
 */
@Component
@ConfigurationProperties(prefix = "ocpp.logging")
@Getter
@Setter
public class OcppLoggingProperties {

    /** The first N Heartbeat frames of a connection are logged in full. */
    private int heartbeatFullFrames = 20;
    /** After that, one summary line per this many Heartbeats (the frames themselves are not logged). */
    private int heartbeatSummaryEvery = 10;
    /** Frames larger than this are flagged WARN and logged truncated (see oversizedLogChars). */
    private int maxFrameBytes = 65_536;
    private int oversizedLogChars = 4_096;
    /** Payloads longer than this are cut before they are written to the database. */
    private int maxStoredPayloadChars = 65_536;
    /**
     * Largest text/binary frame the WebSocket container accepts. Tomcat's default is 8 KB, which would
     * close the connection (1009) on a big NotifyReport; raising it keeps the audit trail complete.
     */
    private int webSocketMaxMessageBytes = 131_072;

    private Duration commandTimeout = Duration.ofSeconds(30);
    private Duration commandSweepInterval = Duration.ofSeconds(5);

    /** Server-sent WebSocket pings. Zero (the default) = off; the charger's Heartbeat keeps the link alive. */
    private Duration pingInterval = Duration.ZERO;
    private Duration idleCheckInterval = Duration.ofSeconds(15);
    /** Idle WARN when no frame has arrived for this many heartbeat intervals. */
    private double idleFactor = 2.0;
    /** Heartbeat interval we hand out in BootNotification responses. */
    private Duration heartbeatInterval = Duration.ofSeconds(30);
    /**
     * A connection is closed, and the charger shown OFFLINE, when no frame has arrived for this many heartbeat intervals
     * (finding D-04). The charger reconnects by itself. Zero = never close a silent connection.
     */
    private double closeFactor = 3.0;
    /** The most frames per second one connection may keep sending; above it the connection is closed (1008). Zero = no limit. */
    private double maxFramesPerSecond = 20;
    /** How many frames one connection may send in one go before the rate above applies (a charger's start-up burst). */
    private int frameBurst = 60;
    private long clockSkewWarnSeconds = 60;

    /** A lock-evidence summary is emitted after this long without a new event for the session. */
    private Duration lockEvidenceQuiet = Duration.ofSeconds(120);

    private Persistence persistence = new Persistence();

    @Getter
    @Setter
    public static class Persistence {
        private boolean enabled = true;
        private int queueCapacity = 10_000;
        private int batchSize = 200;
        private Duration flushInterval = Duration.ofMillis(500);
        private int retentionDays = 30;
        /** Cron (Nepal time) for the daily retention + size report. */
        private String retentionCron = "0 30 3 * * *";
        /** Database size budget used for the size report, in MB (Supabase free tier = 500 MB). */
        private long dbBudgetMb = 500;
        private int retentionChunk = 5_000;
    }
}

package com.samjhana.websocket;

import com.samjhana.ocpp.OcppConnectionRegistry;
import com.samjhana.ocpp.diag.OcppConnectionState;
import com.samjhana.ocpp.diag.OcppLoggers;
import com.samjhana.ocpp.diag.OcppLoggingProperties;
import com.samjhana.ocpp.diag.OcppMdc;
import com.samjhana.service.ChargePointService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Keeps the charger status honest (finding D-04). A charger is shown ONLINE while its connection is open, but a connection can
 * go dead without a goodbye (power, Wi-Fi, a router), and nothing used to notice: the charger stayed ONLINE until it reconnected,
 * and a worker could send a customer to a dead charger. Every 15 seconds this
 * <ul>
 *   <li>closes any connection that has sent no frame for {@code close-factor} heartbeat intervals (3 x 30 s = 90 s by default),
 *       which marks the charger OFFLINE at once and lets it reconnect by itself, and</li>
 *   <li>corrects a charger the database shows ONLINE although it has no connection and has not been heard from for that long
 *       (for instance when marking it OFFLINE failed while the connection closed).</li>
 * </ul>
 * Both are switched off by {@code close-factor: 0}.
 */
@Component
public class OcppLivenessSweep {

    private static final Logger LIFECYCLE = OcppLoggers.LIFECYCLE;
    private static final Logger log = LoggerFactory.getLogger(OcppLivenessSweep.class);

    private final OcppConnectionRegistry registry;
    private final OcppWebSocketHandler handler;
    private final ChargePointService chargePointService;
    private final OcppLoggingProperties properties;

    public OcppLivenessSweep(OcppConnectionRegistry registry, OcppWebSocketHandler handler,
                             ChargePointService chargePointService, OcppLoggingProperties properties) {
        this.registry = registry;
        this.handler = handler;
        this.chargePointService = chargePointService;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "PT15S", initialDelayString = "PT15S")
    void tick() {
        sweep();
    }

    /** Both checks; a failure in one never stops the other, and nothing escapes to the scheduler. */
    public void sweep() {
        try {
            closeSilentConnections();
        } catch (RuntimeException ex) {
            log.error("Liveness sweep: closing silent connections failed", ex);
        }
        try {
            correctStaleOnlineRows();
        } catch (RuntimeException ex) {
            log.error("Liveness sweep: correcting charger rows failed", ex);
        }
    }

    /** Closes every connection that has sent no frame for more than {@code close-factor} x the heartbeat interval it was given. */
    public void closeSilentConnections() {
        double factor = properties.getCloseFactor();
        if (!(factor > 0)) return; // zero (or nonsense) switches it off
        for (OcppConnectionRegistry.Connection connection : registry.connections()) {
            OcppConnectionState state = connection.state();
            if (state.heartbeatIntervalSeconds() <= 0) continue; // no interval to measure the silence against
            long limitMs = (long) (state.heartbeatIntervalSeconds() * 1000 * factor);
            Duration silent = Duration.between(state.lastFrameAt(), Instant.now());
            if (silent.toMillis() <= limitMs) continue;
            String code = state.chargePointCode();
            try (OcppMdc mdc = OcppMdc.open().chargePoint(code).session(state.wsSessionId())) {
                // a frame may have arrived since the look above: a connection that has just spoken is not dropped
                if (Duration.between(state.lastFrameAt(), Instant.now()).toMillis() <= limitMs) continue;
                LIFECYCLE.warn("DEAD CONNECTION chargePointId={} sessionId={}: no frame for {}s (limit {}s = {} x heartbeat "
                                + "interval {}s); closing it with {} so the charger is shown OFFLINE and reconnects",
                        code, state.wsSessionId(), silent.toSeconds(), limitMs / 1000, factor,
                        state.heartbeatIntervalSeconds(), OcppWebSocketHandler.SILENT_CLOSE_CODE);
                handler.dropConnection(connection.raw(),
                        new CloseStatus(OcppWebSocketHandler.SILENT_CLOSE_CODE, "no messages from the charger"));
            } catch (RuntimeException ex) {
                LIFECYCLE.warn("Could not drop the connection of {} (session {}): {}", code, state.wsSessionId(), ex.toString());
            }
        }
    }

    /** Marks OFFLINE any charger the database shows ONLINE that has no connection and has been silent as long as the limit. */
    public void correctStaleOnlineRows() {
        double factor = properties.getCloseFactor();
        Duration interval = properties.getHeartbeatInterval();
        if (!(factor > 0) || interval == null || interval.isZero() || interval.isNegative()) return;
        Duration silentFor = Duration.ofMillis((long) (interval.toMillis() * factor));
        LocalDateTime lastHeardBefore = LocalDateTime.now().minus(silentFor);
        for (String code : chargePointService.onlineChargerCodes()) {
            if (registry.isConnected(code)) continue;
            try {
                chargePointService.markOfflineIfStale(code, lastHeardBefore);
            } catch (RuntimeException ex) {
                LIFECYCLE.warn("Could not correct the status of charger {}: {}", code, ex.toString());
            }
        }
    }
}

package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Connection-level audit trail: every handshake attempt (accepted or rejected), requests that never
 * reached the handshake (404s, near-miss URLs), connects, disconnects, reconnects and idle warnings.
 */
@Entity
@Table(name = "ocpp_connection_log", indexes = {
        @Index(name = "idx_ocpp_conn_cp_time", columnList = "charge_point_id, created_at"),
        @Index(name = "idx_ocpp_conn_time", columnList = "created_at")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OcppConnectionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "charge_point_id", length = 64)
    private String chargePointId;

    @Column(name = "ws_session_id", length = 64)
    private String wsSessionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event", nullable = false, length = 30)
    private Event event;

    @Column(name = "reason", length = 64)
    private String reason;

    @Column(name = "close_code")
    private Integer closeCode;

    @Column(name = "remote_addr", length = 64)
    private String remoteAddr;

    @Column(name = "forwarded_for", length = 255)
    private String forwardedFor;

    @Column(name = "offered_protocols", length = 255)
    private String offeredProtocols;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "request_uri", length = 1000)
    private String requestUri;

    @Column(name = "http_status")
    private Integer httpStatus;

    @Column(name = "detail", columnDefinition = "TEXT")
    private String detail;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public enum Event {
        HANDSHAKE_ACCEPTED,
        HANDSHAKE_REJECTED,
        REQUEST_NEAR_MISS,
        CONNECTED,
        DISCONNECTED,
        RECONNECT,
        IDLE_WARNING
    }
}

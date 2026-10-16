package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Outcome of one command we sent to a charger (RequestStartTransaction, RequestStopTransaction,
 * UnlockConnector...), written once when it resolves: answered, rejected, timed out, or lost to a
 * disconnect.
 */
@Entity
@Table(name = "ocpp_command_log", indexes = {
        @Index(name = "idx_ocpp_cmd_cp_time", columnList = "charge_point_id, sent_at"),
        @Index(name = "idx_ocpp_cmd_session", columnList = "charge_session_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OcppCommandLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "charge_point_id", nullable = false, length = 64)
    private String chargePointId;

    @Column(name = "ws_session_id", length = 64)
    private String wsSessionId;

    @Column(name = "message_id", nullable = false, length = 64)
    private String messageId;

    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @Column(name = "charge_session_id")
    private UUID chargeSessionId;

    @Column(name = "evse_id")
    private Integer evseId;

    @Column(name = "connector_id")
    private Integer connectorId;

    @Column(name = "reason", length = 255)
    private String reason;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "latency_ms")
    private Long latencyMs;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", nullable = false, length = 20)
    private Outcome outcome;

    /** CALLRESULT {@code status} (Accepted, Rejected, Unlocked...). */
    @Column(name = "response_status", length = 64)
    private String responseStatus;

    /** statusInfo.reasonCode of a CALLRESULT. */
    @Column(name = "reason_code", length = 64)
    private String reasonCode;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "error_description", length = 500)
    private String errorDescription;

    @Column(name = "detail", columnDefinition = "TEXT")
    private String detail;

    public enum Outcome {
        RESULT,
        ERROR,
        TIMED_OUT,
        DISCONNECTED,
        SEND_FAILED
    }
}

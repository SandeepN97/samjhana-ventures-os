package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * One OCPP WebSocket frame, as received from or sent to a charger. Append-only audit trail:
 * rows are never updated, only removed in bulk by the retention job. The payload is stored with
 * idToken values already masked.
 */
@Entity
@Table(name = "ocpp_message_log", indexes = {
        @Index(name = "idx_ocpp_msg_cp_time", columnList = "charge_point_id, received_at"),
        @Index(name = "idx_ocpp_msg_time", columnList = "received_at")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OcppMessageLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The charge point code from the URL. Not a foreign key: unknown chargers are logged too. */
    @Column(name = "charge_point_id", nullable = false, length = 64)
    private String chargePointId;

    @Column(name = "ws_session_id", length = 64)
    private String wsSessionId;

    @Column(name = "direction", nullable = false, length = 8)
    private String direction;

    @Column(name = "action", length = 64)
    private String action;

    /** OCPP-J message type: 2 CALL, 3 CALLRESULT, 4 CALLERROR; null when the frame was not parseable. */
    @Column(name = "message_type")
    private Integer messageType;

    @Column(name = "message_id", length = 64)
    private String messageId;

    @Column(name = "payload", columnDefinition = "TEXT")
    private String payload;

    @Column(name = "payload_size", nullable = false)
    private Integer payloadSize;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Builder.Default
    @Column(name = "discovery", nullable = false)
    private boolean discovery = false;
}

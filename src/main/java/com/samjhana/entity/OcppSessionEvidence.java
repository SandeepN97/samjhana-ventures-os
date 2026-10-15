package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Lock evidence for one charge session: the timestamped stop / Ended / connector-status / unlock
 * sequence, so we can tell afterwards whether the connector released by itself or only after our
 * UnlockConnector.
 */
@Entity
@Table(name = "ocpp_session_evidence", indexes = {
        @Index(name = "idx_ocpp_evidence_session", columnList = "charge_session_id"),
        @Index(name = "idx_ocpp_evidence_time", columnList = "created_at")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OcppSessionEvidence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "charge_session_id")
    private UUID chargeSessionId;

    @Column(name = "charge_point_id", nullable = false, length = 64)
    private String chargePointId;

    @Column(name = "ocpp_transaction_id", length = 64)
    private String ocppTransactionId;

    /** The one-line summary that was logged. */
    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    /** The individual timestamped events, as a JSON array. */
    @Column(name = "events", columnDefinition = "TEXT")
    private String events;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}

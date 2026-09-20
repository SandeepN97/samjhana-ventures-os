package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One physical DC fast charger at the site (see docs/EV-CHARGING-ARCHITECTURE.md).
 *
 * <p>{@code code} is the stable charge point ID. It is what the charger will later
 * put in its OCPP URL ({@code wss://<host>/ocpp/<code>}), so sessions recorded today
 * keep pointing at the same charger once the CSMS module exists.
 *
 * <p>The authentication secret is stored as a BCrypt hash. The clear-text secret is
 * only supplied to the physical charger during provisioning and is never returned by
 * the API.
 */
@Entity
@Table(name = "charge_points")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChargePoint {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 64)
    private String code;

    @Column(name = "model", nullable = false)
    private String model;

    @Column(name = "serial_number", unique = true, length = 100)
    private String serialNumber;

    @Column(name = "ocpp_auth_secret_hash", length = 100)
    private String ocppAuthSecretHash;

    @Column(name = "max_power_kw", nullable = false, precision = 6, scale = 2)
    private BigDecimal maxPowerKw;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    // DB-level default so `ddl-auto: update` can add this NOT NULL column to a table
    // that already holds charger rows (created before OCPP support existed).
    @ColumnDefault("'OFFLINE'")
    @Column(name = "connection_status", nullable = false, length = 20)
    private ConnectionStatus connectionStatus = ConnectionStatus.OFFLINE;

    @Column(name = "connector_status", length = 40)
    private String connectorStatus;

    @Column(name = "last_heartbeat_at")
    private LocalDateTime lastHeartbeatAt;

    @Column(name = "last_connected_at")
    private LocalDateTime lastConnectedAt;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @ColumnDefault("'EXPLICIT_UNLOCK'")
    @Column(name = "lock_behavior", nullable = false, length = 30)
    private LockBehavior lockBehavior = LockBehavior.EXPLICIT_UNLOCK;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    /** Soft delete — rows are never hard-deleted. */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum ConnectionStatus {
        OFFLINE,
        ONLINE
    }

    /**
     * EXPLICIT_UNLOCK is the preferred hardware behavior: stopping power leaves the
     * cable locked until the CSMS sends UnlockConnector after payment.
     * AUTO_UNLOCK_ON_STOP keeps the charge running until payment is confirmed, then
     * sends RequestStopTransaction because the hardware unlocks as part of stopping.
     */
    public enum LockBehavior {
        EXPLICIT_UNLOCK,
        AUTO_UNLOCK_ON_STOP
    }
}

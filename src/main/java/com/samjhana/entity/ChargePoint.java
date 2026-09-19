package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
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
 * <p>OCPP-only columns (serial number, auth secret, live connection status) are
 * deliberately not here yet — they belong to the CSMS phase.
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

    @Column(name = "max_power_kw", nullable = false, precision = 6, scale = 2)
    private BigDecimal maxPowerKw;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

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
}

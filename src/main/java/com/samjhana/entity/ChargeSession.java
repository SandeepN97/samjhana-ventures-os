package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "charge_sessions", indexes = {
        @Index(name = "idx_charge_session_status", columnList = "status"),
        @Index(name = "idx_charge_session_charge_point", columnList = "charge_point_id"),
        @Index(name = "idx_charge_session_paid_at", columnList = "paid_at"),
        @Index(name = "idx_charge_session_ocpp_tx", columnList = "ocpp_transaction_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChargeSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "charge_point_id", nullable = false)
    private ChargePoint chargePoint;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vehicle_id", nullable = false)
    private EvCustomerVehicle vehicle;

    /** Optional catalog entry used for rate and capacity suggestions. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_catalog_id")
    private EvVehicle vehicleCatalog;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "started_by", nullable = false)
    private User startedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "paid_by")
    private User paidBy;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", unique = true)
    private Transaction transaction;

    @Column(name = "connector_id", nullable = false)
    @Builder.Default
    private Integer connectorId = 1;

    @Column(name = "target_percent", nullable = false)
    private Integer targetPercent;

    @Column(name = "start_soc")
    private Integer startSoc;

    @Column(name = "current_soc")
    private Integer currentSoc;

    @Column(name = "start_meter_wh", precision = 18, scale = 3)
    private BigDecimal startMeterWh;

    @Column(name = "last_meter_wh", precision = 18, scale = 3)
    private BigDecimal lastMeterWh;

    @Builder.Default
    @Column(name = "energy_delivered_kwh", nullable = false, precision = 15, scale = 3)
    private BigDecimal energyDeliveredKwh = BigDecimal.ZERO;

    /**
     * Price (NPR) per 1% of battery charged, snapshotted from the chosen vehicle type when the
     * session starts so a later price edit can't change an open bill. Customers are charged by
     * car type and percentage: amount = ratePerPercent × (currentSoc − startSoc). Null for a
     * walk-in with no vehicle type — staff then enter the amount by hand.
     */
    @Column(name = "rate_per_percent", precision = 12, scale = 2)
    private BigDecimal ratePerPercent;

    @Column(name = "amount", precision = 15, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 20)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Status status;

    @Column(name = "ocpp_transaction_id", length = 100)
    private String ocppTransactionId;

    @Column(name = "last_sequence_number")
    private Integer lastSequenceNumber;

    @Column(name = "status_message", length = 500)
    private String statusMessage;

    @Column(length = 1000)
    private String notes;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "stop_requested_at")
    private LocalDateTime stopRequestedAt;

    @Column(name = "stopped_at")
    private LocalDateTime stoppedAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Version
    private Long version;

    public enum Status {
        STARTING,
        ACTIVE,
        STOP_REQUESTED,
        AWAITING_PAYMENT,
        PAID,
        UNLOCK_REQUESTED,
        CLOSED,
        FAILED,
        CANCELLED
    }

    public enum PaymentMethod {
        CASH,
        ESEWA,
        KHALTI
    }
}

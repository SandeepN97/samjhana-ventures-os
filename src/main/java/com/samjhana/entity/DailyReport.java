package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "daily_reports", indexes = {
        @Index(name = "idx_daily_report_date", columnList = "report_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "report_date", nullable = false, unique = true)
    private LocalDate reportDate;

    @Column(name = "petrol_sales", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal petrolSales = BigDecimal.ZERO;

    @Column(name = "petrol_liters", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal petrolLiters = BigDecimal.ZERO;

    @Column(name = "diesel_sales", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal dieselSales = BigDecimal.ZERO;

    @Column(name = "diesel_liters", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal dieselLiters = BigDecimal.ZERO;

    @Column(name = "ev_sales", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal evSales = BigDecimal.ZERO;

    @Column(name = "ev_units", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal evUnits = BigDecimal.ZERO;

    @Column(name = "rental_sales", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal rentalSales = BigDecimal.ZERO;

    @Column(name = "other_sales", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal otherSales = BigDecimal.ZERO;

    @Column(name = "total_system_sales", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalSystemSales = BigDecimal.ZERO;

    @Column(name = "total_cash_sales", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalCashSales = BigDecimal.ZERO;

    @Column(name = "total_bank_sales", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalBankSales = BigDecimal.ZERO;

    @Column(name = "cash_counted", precision = 15, scale = 2, nullable = false)
    private BigDecimal cashCounted;

    @Column(name = "discrepancy", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal discrepancy = BigDecimal.ZERO;

    @Column(length = 500)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by", nullable = false)
    private User closedBy;

    @Column(name = "closed_at", nullable = false)
    private LocalDateTime closedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", length = 20)
    @Builder.Default
    private VerificationStatus verificationStatus = VerificationStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by")
    private User verifiedBy;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "verification_notes", length = 1000)
    private String verificationNotes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum VerificationStatus {
        PENDING,
        VERIFIED
    }
}

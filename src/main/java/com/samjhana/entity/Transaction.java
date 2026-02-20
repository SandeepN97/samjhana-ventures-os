package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Transaction Entity - Universal transaction record for all businesses.
 * 
 * Uses a JSON column (customFields) for business-specific dynamic attributes,
 * allowing "Modular Fields" without database migrations.
 * 
 * Example customFields by business:
 * 
 * PETROL:
 * {
 *   "liters": 500.5,
 *   "density": 0.785,
 *   "fuelType": "diesel",
 *   "ratePerLiter": 182.50,
 *   "openingStock": 2000,
 *   "closingStock": 1500
 * }
 * 
 * EV:
 * {
 *   "openingMeter": 15234,
 *   "closingMeter": 15456,
 *   "unitRate": 13.50,
 *   "neaBillRef": "NEA-2024-001"
 * }
 * 
 * RENTAL:
 * {
 *   "roomNo": "A-101",
 *   "tenantName": "राम बहादुर",
 *   "monthlyRent": 15000,
 *   "paidMonths": ["2024-01", "2024-02"]
 * }
 */
@Entity
@Table(name = "transactions", indexes = {
    @Index(name = "idx_transaction_business", columnList = "business_id"),
    @Index(name = "idx_transaction_date", columnList = "transaction_date"),
    @Index(name = "idx_transaction_status", columnList = "status"),
    @Index(name = "idx_transaction_type", columnList = "transaction_type")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private BusinessUnit business;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "entered_by", nullable = false)
    private User enteredBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransactionType transactionType;

    @Column(nullable = false)
    private LocalDate transactionDate;

    @Column(precision = 15, scale = 2)
    private BigDecimal amount;

    /**
     * Dynamic fields stored as JSON string.
     * H2 doesn't have native JSONB, so we store as CLOB and parse in application.
     */
    @Column(columnDefinition = "CLOB")
    private String customFields;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TransactionStatus status = TransactionStatus.APPROVED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    private LocalDateTime reviewedAt;

    @Column(length = 500)
    private String reviewNotes;

    @Column(length = 1000)
    private String notes;

    @Column(length = 100)
    private String referenceNumber;  // Bill number, receipt number, etc.

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    /**
     * Transaction types applicable across all businesses
     */
    public enum TransactionType {
        SALE,           // Revenue generating
        PURCHASE,       // Stock/inventory purchase
        EXPENSE,        // Operating expense
        INCOME,         // Non-sale income (interest, etc.)
        PAYMENT,        // Payment received (rental, loan)
        DISBURSEMENT,   // Loan disbursement
        ADJUSTMENT,     // Stock/balance adjustment
        OPENING_BALANCE // Initial balance entry
    }

    /**
     * Review workflow status
     * Dad creates entries as PENDING_REVIEW
     * Son reviews and moves to APPROVED or REJECTED
     */
    public enum TransactionStatus {
        PENDING_REVIEW,  // Created by Dad, awaiting Son's review
        APPROVED,        // Reviewed and approved by Son
        REJECTED,        // Rejected with notes for correction
        CORRECTED,       // Resubmitted after rejection
        ARCHIVED         // Old transaction, no longer active
    }
}

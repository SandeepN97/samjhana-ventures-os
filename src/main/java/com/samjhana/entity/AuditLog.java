package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * AuditLog Entity - Tracks all changes for accountability and review.
 * 
 * Every create, update, delete, and approval action is logged here.
 * This is essential for the Dad-Son review workflow where the Son needs
 * to see what changes were made by Dad.
 */
@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_entity", columnList = "entity_type, entity_id"),
    @Index(name = "idx_audit_user", columnList = "user_id"),
    @Index(name = "idx_audit_date", columnList = "created_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EntityType entityType;

    @Column(nullable = false)
    private UUID entityId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AuditAction action;

    /**
     * Previous state of the entity (JSON)
     */
    @Column(columnDefinition = "CLOB")
    private String oldValues;

    /**
     * New state of the entity (JSON)
     */
    @Column(columnDefinition = "CLOB")
    private String newValues;

    @Column(length = 500)
    private String description;

    @Column(length = 45)
    private String ipAddress;

    @Column(length = 500)
    private String userAgent;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    /**
     * Entity types that can be audited
     */
    public enum EntityType {
        TRANSACTION,
        RESOURCE,
        BUSINESS_UNIT,
        FIELD_TEMPLATE,
        USER,
        IMAGE_ATTACHMENT
    }

    /**
     * Audit actions
     */
    public enum AuditAction {
        CREATE,
        UPDATE,
        DELETE,
        APPROVE,
        REJECT,
        RESTORE,
        LOGIN,
        LOGOUT
    }

    // =========================================================================
    // Factory Methods for Common Audit Events
    // =========================================================================

    public static AuditLog createEvent(User user, EntityType entityType, UUID entityId, String newValues) {
        return AuditLog.builder()
                .user(user)
                .entityType(entityType)
                .entityId(entityId)
                .action(AuditAction.CREATE)
                .newValues(newValues)
                .description("Created new " + entityType.name().toLowerCase())
                .build();
    }

    public static AuditLog updateEvent(User user, EntityType entityType, UUID entityId, 
                                       String oldValues, String newValues) {
        return AuditLog.builder()
                .user(user)
                .entityType(entityType)
                .entityId(entityId)
                .action(AuditAction.UPDATE)
                .oldValues(oldValues)
                .newValues(newValues)
                .description("Updated " + entityType.name().toLowerCase())
                .build();
    }

    public static AuditLog approvalEvent(User user, UUID transactionId, String status) {
        return AuditLog.builder()
                .user(user)
                .entityType(EntityType.TRANSACTION)
                .entityId(transactionId)
                .action(AuditAction.APPROVE)
                .description("Transaction " + status.toLowerCase())
                .build();
    }
}

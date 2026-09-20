package com.samjhana.entity;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** The audit trail must say what actually happened: an approval is APPROVE, a rejection is REJECT. */
class AuditLogTest {

    private final User reviewer = User.builder().username("manager").passwordHash("x").fullName("Manager")
            .role(User.UserRole.MANAGER).build();
    private final UUID transactionId = UUID.randomUUID();

    @Test
    void shouldLogTheApproveAction_whenTheTransactionWasApproved() {
        AuditLog entry = AuditLog.approvalEvent(reviewer, transactionId, "APPROVED");

        assertEquals(AuditLog.AuditAction.APPROVE, entry.getAction());
        assertEquals("Transaction approved", entry.getDescription());
    }

    @Test
    void shouldLogTheRejectAction_whenTheTransactionWasRejected() {
        AuditLog entry = AuditLog.approvalEvent(reviewer, transactionId, "REJECTED");

        assertEquals(AuditLog.AuditAction.REJECT, entry.getAction());
        assertEquals("Transaction rejected", entry.getDescription());
    }

    @Test
    void shouldRecogniseTheRejectedStatusInAnyCase() {
        assertEquals(AuditLog.AuditAction.REJECT, AuditLog.approvalEvent(reviewer, transactionId, "rejected").getAction());
    }

    @Test
    void shouldRecordTheReviewerTheTransactionAndTheEntityType() {
        AuditLog entry = AuditLog.approvalEvent(reviewer, transactionId, "REJECTED");

        assertEquals(reviewer, entry.getUser());
        assertEquals(transactionId, entry.getEntityId());
        assertEquals(AuditLog.EntityType.TRANSACTION, entry.getEntityType());
    }

    @Test
    void shouldFail_whenNoStatusIsGiven() {
        assertThrows(NullPointerException.class, () -> AuditLog.approvalEvent(reviewer, transactionId, null));
    }
}

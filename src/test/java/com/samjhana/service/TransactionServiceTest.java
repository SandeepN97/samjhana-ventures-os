package com.samjhana.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.exception.TransactionNotFoundException;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The review workflow now records who decided and writes an audit entry for every approval or rejection. */
@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock TransactionRepository transactionRepository;
    @Mock BusinessUnitRepository businessUnitRepository;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock CalculationEngine calculationEngine;

    private TransactionService service;
    private User staff;
    private User manager;
    private Transaction pending;

    @BeforeEach
    void setUp() {
        service = new TransactionService(transactionRepository, businessUnitRepository, furnitureItemRepository,
                auditLogRepository, calculationEngine, new ObjectMapper());
        staff = User.builder().username("staff").passwordHash("x").fullName("Staff Member").role(User.UserRole.STAFF).build();
        manager = User.builder().username("manager").passwordHash("x").fullName("Shop Manager").role(User.UserRole.MANAGER).build();
        pending = Transaction.builder()
                .id(UUID.randomUUID())
                .business(BusinessUnit.builder().code("petrol").name("Petrol Pump").build())
                .enteredBy(staff)
                .transactionType(Transaction.TransactionType.SALE)
                .transactionDate(LocalDate.now())
                .amount(new BigDecimal("1500.00"))
                .status(Transaction.TransactionStatus.PENDING_REVIEW)
                .build();
        lenient().when(transactionRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        lenient().when(transactionRepository.save(any(Transaction.class))).then(returnsFirstArg());
    }

    private AuditLog savedAuditEntry() {
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(audit.capture());
        return audit.getValue();
    }

    @Test
    void shouldMarkApprovedAndRecordTheReviewer_whenAManagerApproves() {
        TransactionResponse response = service.approve(pending.getId(), manager);

        assertEquals("APPROVED", response.getStatus());
        assertEquals("Shop Manager", response.getReviewedByName());
        assertNotNull(response.getReviewedAt());
        assertEquals(manager, pending.getReviewedBy());
    }

    @Test
    void shouldWriteAnApprovalAuditEntry_whenATransactionIsApproved() {
        service.approve(pending.getId(), manager);

        AuditLog entry = savedAuditEntry();
        assertEquals(manager, entry.getUser());
        assertEquals(AuditLog.EntityType.TRANSACTION, entry.getEntityType());
        assertEquals(pending.getId(), entry.getEntityId());
        assertEquals(AuditLog.AuditAction.APPROVE, entry.getAction());
        assertEquals("Transaction approved", entry.getDescription());
    }

    @Test
    void shouldThrowNotFoundAndWriteNoAuditEntry_whenApprovingAnUnknownTransaction() {
        UUID unknown = UUID.randomUUID();
        when(transactionRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThrows(TransactionNotFoundException.class, () -> service.approve(unknown, manager));

        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }

    @Test
    void shouldMarkRejectedWithTheReasonAndReviewer_whenAManagerRejects() {
        TransactionResponse response = service.reject(pending.getId(), "amount does not match the receipt", manager);

        assertEquals("REJECTED", response.getStatus());
        assertEquals("amount does not match the receipt", response.getReviewNotes());
        assertEquals("Shop Manager", response.getReviewedByName());
        assertNotNull(response.getReviewedAt());
    }

    @Test
    void shouldWriteARejectionAuditEntryForTheReviewer_whenATransactionIsRejected() {
        service.reject(pending.getId(), "duplicate", manager);

        AuditLog entry = savedAuditEntry();
        assertEquals(manager, entry.getUser());
        assertEquals(AuditLog.EntityType.TRANSACTION, entry.getEntityType());
        assertEquals(pending.getId(), entry.getEntityId());
        assertEquals(AuditLog.AuditAction.REJECT, entry.getAction());
        assertEquals("Transaction rejected", entry.getDescription());
    }

    @Test
    void shouldLeaveTheReviewNotesEmpty_whenRejectedWithoutAReason() {
        TransactionResponse response = service.reject(pending.getId(), null, manager);

        assertEquals("REJECTED", response.getStatus());
        assertNull(response.getReviewNotes());
    }

    @Test
    void shouldThrowNotFoundAndWriteNoAuditEntry_whenRejectingAnUnknownTransaction() {
        UUID unknown = UUID.randomUUID();
        when(transactionRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThrows(TransactionNotFoundException.class, () -> service.reject(unknown, "x", manager));

        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }
}

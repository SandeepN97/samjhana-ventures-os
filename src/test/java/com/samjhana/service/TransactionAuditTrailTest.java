package com.samjhana.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.DailyReportRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.SystemSettingRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.strategy.BusinessCalculationStrategy.ValidationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Findings P0-03 and P1b-03: an edit used to skip the checks a new entry gets (amount above zero, date not in the
 * future), and the audit row of an edit, approval or rejection left out what mattered: the old amount, type, date,
 * notes and reference, the previous status, and the reason. Now every change leaves a before and after.
 */
@ExtendWith(MockitoExtension.class)
class TransactionAuditTrailTest {

    @Mock TransactionRepository transactionRepository;
    @Mock BusinessUnitRepository businessUnitRepository;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock CalculationEngine calculationEngine;
    @Mock DailyReportRepository dailyReportRepository;
    @Mock SystemSettingRepository systemSettingRepository;
    @Mock BeekeepingService beekeepingService;
    @Mock LoanReceiptService loanReceiptService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private TransactionService service;
    private final LocalDate today = LocalDate.now(ZoneId.of("Asia/Kathmandu"));

    private final User manager = User.builder().username("mgr").passwordHash("x").fullName("Manager").role(User.UserRole.MANAGER).build();
    private final User earlierReviewer = User.builder().username("old-reviewer").passwordHash("x").fullName("Old").role(User.UserRole.ADMIN).build();
    private final BusinessUnit petrol = BusinessUnit.builder().code("petrol").name("Petrol").build();
    private final BusinessUnit loan = BusinessUnit.builder().code("loan").name("Loan").build();

    private Transaction entry;

    @BeforeEach
    void setUp() {
        service = new TransactionService(transactionRepository, businessUnitRepository, furnitureItemRepository,
                auditLogRepository, calculationEngine, objectMapper, dailyReportRepository, systemSettingRepository,
                beekeepingService, loanReceiptService);
        lenient().when(calculationEngine.validate(anyString(), anyMap())).thenReturn(ValidationResult.valid());
        lenient().when(transactionRepository.save(any(Transaction.class))).then(inv -> inv.getArgument(0));
        entry = Transaction.builder().id(UUID.randomUUID()).business(petrol).enteredBy(manager)
                .transactionType(Transaction.TransactionType.SALE).transactionDate(today).amount(new BigDecimal("1000"))
                .notes("first note").referenceNumber("R-1").status(Transaction.TransactionStatus.APPROVED)
                .customFields("{\"liters\":10}").build();
        lenient().when(transactionRepository.findById(entry.getId())).thenReturn(Optional.of(entry));
    }

    private static TransactionRequest edit() {
        return new TransactionRequest();
    }

    private AuditLog theAuditRow() {
        ArgumentCaptor<AuditLog> row = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(row.capture());
        return row.getValue();
    }

    private JsonNode json(String text) throws Exception {
        return objectMapper.readTree(text);
    }

    // ---- an edit gets the same checks as a new entry ----

    @ParameterizedTest
    @ValueSource(strings = {"0", "0.00", "-5", "-0.01"})
    void shouldRefuseAnEdit_thatMakesTheAmountZeroOrLess(String amount) {
        TransactionRequest request = edit();
        request.setAmount(new BigDecimal(amount));

        assertThatThrownBy(() -> service.update(entry.getId(), request, manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Amount must be greater than zero");

        assertThat(entry.getAmount()).isEqualByComparingTo("1000");
        verify(transactionRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void shouldRefuseAnEdit_thatMovesTheDateMoreThanADayAhead() {
        TransactionRequest request = edit();
        request.setTransactionDate(today.plusDays(2));

        assertThatThrownBy(() -> service.update(entry.getId(), request, manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Transaction date cannot be in the future");

        assertThat(entry.getTransactionDate()).isEqualTo(today);
        verify(transactionRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void shouldAcceptAnEdit_thatMovesTheDateToTomorrowOrToThePast() {
        TransactionRequest tomorrow = edit();
        tomorrow.setTransactionDate(today.plusDays(1));
        service.update(entry.getId(), tomorrow, manager);
        assertThat(entry.getTransactionDate()).isEqualTo(today.plusDays(1));

        TransactionRequest past = edit();
        past.setTransactionDate(today.minusDays(40));
        service.update(entry.getId(), past, manager);
        assertThat(entry.getTransactionDate()).isEqualTo(today.minusDays(40));
    }

    @Test
    void shouldKeepTheAmountAndDate_whenTheEditOnlyChangesTheNotes() {
        TransactionRequest request = edit();
        request.setNotes("only the note");

        service.update(entry.getId(), request, manager);

        assertThat(entry.getAmount()).isEqualByComparingTo("1000");
        assertThat(entry.getTransactionDate()).isEqualTo(today);
        assertThat(entry.getNotes()).isEqualTo("only the note");
    }

    // ---- what the audit row of an edit holds ----

    @Test
    void shouldRecordTheOldAndNewValueOfEveryEditableField_inTheAuditRow() throws Exception {
        TransactionRequest request = edit();
        request.setAmount(new BigDecimal("10"));
        request.setTransactionType("EXPENSE");
        request.setTransactionDate(today.minusDays(1));
        request.setNotes("second note");
        request.setReferenceNumber("R-2");
        request.setCustomFields(Map.of("liters", 5));

        service.update(entry.getId(), request, manager);

        AuditLog row = theAuditRow();
        assertThat(row.getAction()).isEqualTo(AuditLog.AuditAction.UPDATE);
        assertThat(row.getEntityType()).isEqualTo(AuditLog.EntityType.TRANSACTION);
        assertThat(row.getEntityId()).isEqualTo(entry.getId());
        assertThat(row.getUser()).isSameAs(manager);
        JsonNode before = json(row.getOldValues());
        JsonNode after = json(row.getNewValues());
        assertThat(before.get("amount").asText()).isEqualTo("1000");
        assertThat(before.get("transactionType").asText()).isEqualTo("SALE");
        assertThat(before.get("transactionDate").asText()).isEqualTo(today.toString());
        assertThat(before.get("notes").asText()).isEqualTo("first note");
        assertThat(before.get("referenceNumber").asText()).isEqualTo("R-1");
        assertThat(before.get("status").asText()).isEqualTo("APPROVED");
        assertThat(before.get("customFields").get("liters").asInt()).isEqualTo(10);
        assertThat(after.get("amount").asText()).isEqualTo("10");
        assertThat(after.get("transactionType").asText()).isEqualTo("EXPENSE");
        assertThat(after.get("transactionDate").asText()).isEqualTo(today.minusDays(1).toString());
        assertThat(after.get("notes").asText()).isEqualTo("second note");
        assertThat(after.get("referenceNumber").asText()).isEqualTo("R-2");
        assertThat(after.get("status").asText()).isEqualTo("APPROVED");
        assertThat(after.get("customFields").get("liters").asInt()).isEqualTo(5);
    }

    @Test
    void shouldRecordTheOldAmount_evenWhenOnlyTheAmountChanged() throws Exception {
        TransactionRequest request = edit();
        request.setAmount(new BigDecimal("1"));

        service.update(entry.getId(), request, manager);

        AuditLog row = theAuditRow();
        assertThat(json(row.getOldValues()).get("amount").asText()).isEqualTo("1000");
        assertThat(json(row.getNewValues()).get("amount").asText()).isEqualTo("1");
        assertThat(json(row.getNewValues()).get("notes").asText()).isEqualTo("first note");
    }

    @Test
    void shouldNameTheChangedFields_inTheAuditDescription() {
        TransactionRequest request = edit();
        request.setAmount(new BigDecimal("1"));
        request.setTransactionDate(today.minusDays(3));

        service.update(entry.getId(), request, manager);

        assertThat(theAuditRow().getDescription()).isEqualTo("Updated transaction (changed: amount, transactionDate)");
    }

    @Test
    void shouldNotCountTheSameAmountWrittenWithMoreDecimalsAsAChange() {
        TransactionRequest request = edit();
        request.setAmount(new BigDecimal("1000.00"));
        request.setNotes("second note");

        service.update(entry.getId(), request, manager);

        assertThat(theAuditRow().getDescription()).isEqualTo("Updated transaction (changed: notes)");
    }

    @Test
    void shouldSayNothingChanged_whenTheEditChangesNothing() {
        service.update(entry.getId(), edit(), manager);

        assertThat(theAuditRow().getDescription()).isEqualTo("Updated transaction (changed: nothing)");
    }

    @Test
    void shouldCompareTheExtraDetailsByContent_notByTheOrderOfTheirKeys() {
        entry.setCustomFields("{\"a\":1,\"b\":2}");
        TransactionRequest request = edit();
        request.setCustomFields(new java.util.LinkedHashMap<>(Map.of("b", 2, "a", 1)));

        service.update(entry.getId(), request, manager);

        assertThat(theAuditRow().getDescription()).isEqualTo("Updated transaction (changed: nothing)");
    }

    // ---- what the audit row of an approval or a rejection holds ----

    @Test
    void shouldRecordThePreviousStatusAndTheAmount_whenAnEntryIsApproved() throws Exception {
        entry.setStatus(Transaction.TransactionStatus.PENDING_REVIEW);

        service.approve(entry.getId(), manager);

        AuditLog row = theAuditRow();
        assertThat(row.getAction()).isEqualTo(AuditLog.AuditAction.APPROVE);
        assertThat(row.getDescription()).isEqualTo("Transaction approved");
        assertThat(json(row.getOldValues()).get("status").asText()).isEqualTo("PENDING_REVIEW");
        assertThat(json(row.getNewValues()).get("status").asText()).isEqualTo("APPROVED");
        assertThat(json(row.getOldValues()).get("amount").asText()).isEqualTo("1000");
        assertThat(json(row.getNewValues()).get("amount").asText()).isEqualTo("1000");
        assertThat(json(row.getNewValues()).get("transactionDate").asText()).isEqualTo(today.toString());
        assertThat(json(row.getNewValues()).get("transactionType").asText()).isEqualTo("SALE");
    }

    @Test
    void shouldRecordThePreviousStatusAndTheReason_whenAnApprovedEntryIsRejected() throws Exception {
        service.reject(entry.getId(), "entered twice", manager);

        AuditLog row = theAuditRow();
        assertThat(row.getAction()).isEqualTo(AuditLog.AuditAction.REJECT);
        assertThat(row.getDescription()).isEqualTo("Transaction rejected");
        assertThat(json(row.getOldValues()).get("status").asText()).isEqualTo("APPROVED");
        assertThat(json(row.getNewValues()).get("status").asText()).isEqualTo("REJECTED");
        assertThat(json(row.getNewValues()).get("reviewNotes").asText()).isEqualTo("entered twice");
        assertThat(json(row.getOldValues()).get("amount").asText()).isEqualTo("1000");
    }

    @Test
    void shouldKeepTheEarlierReasonInTheAuditRow_whenARejectionIsRejectedAgain() throws Exception {
        entry.setStatus(Transaction.TransactionStatus.REJECTED);
        entry.setReviewNotes("first reason");
        entry.setReviewedBy(earlierReviewer);

        service.reject(entry.getId(), "second reason", manager);

        AuditLog row = theAuditRow();
        assertThat(json(row.getOldValues()).get("reviewNotes").asText()).isEqualTo("first reason");
        assertThat(json(row.getOldValues()).get("reviewedBy").asText()).isEqualTo("old-reviewer");
        assertThat(json(row.getNewValues()).get("reviewNotes").asText()).isEqualTo("second reason");
        assertThat(json(row.getNewValues()).get("reviewedBy").asText()).isEqualTo("mgr");
        assertThat(entry.getReviewNotes()).isEqualTo("second reason");
    }

    @Test
    void shouldRecordThatAnApprovalReversedARejection() throws Exception {
        entry.setStatus(Transaction.TransactionStatus.REJECTED);
        entry.setReviewNotes("looked wrong");
        entry.setReviewedAt(LocalDateTime.now().minusDays(1));

        service.approve(entry.getId(), manager);

        AuditLog row = theAuditRow();
        assertThat(json(row.getOldValues()).get("status").asText()).isEqualTo("REJECTED");
        assertThat(json(row.getOldValues()).get("reviewNotes").asText()).isEqualTo("looked wrong");
        assertThat(json(row.getNewValues()).get("status").asText()).isEqualTo("APPROVED");
    }

    @Test
    void shouldStillAllowARejectionWithoutAReason_forAnOrdinarySale_andRecordNoReason() throws Exception {
        service.reject(entry.getId(), null, manager);

        AuditLog row = theAuditRow();
        assertThat(json(row.getNewValues()).get("status").asText()).isEqualTo("REJECTED");
        assertThat(json(row.getNewValues()).get("reviewNotes").isNull()).isTrue();
    }

    @Test
    void shouldStillDemandAReason_forALoanEntry_andWriteNoAuditRowWithoutIt() {
        entry.setBusiness(loan);

        assertThatThrownBy(() -> service.reject(entry.getId(), "  ", manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Say why this loan entry is rejected");

        verify(auditLogRepository, never()).save(any());
        assertThat(entry.getStatus()).isEqualTo(Transaction.TransactionStatus.APPROVED);
    }
}

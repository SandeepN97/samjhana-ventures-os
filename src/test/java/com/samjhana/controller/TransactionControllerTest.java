package com.samjhana.controller;

import com.samjhana.dto.TransactionRequest;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.User;
import com.samjhana.service.TransactionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Role checks on the transaction review workflow: only managers and admins may approve, reject or edit. */
@ExtendWith(MockitoExtension.class)
class TransactionControllerTest {

    @Mock TransactionService transactionService;

    private TransactionController controller;
    private User staff;
    private User manager;
    private User admin;
    private final String id = UUID.randomUUID().toString();

    @BeforeEach
    void setUp() {
        controller = new TransactionController(transactionService);
        staff = user("staff", User.UserRole.STAFF);
        manager = user("manager", User.UserRole.MANAGER);
        admin = user("admin", User.UserRole.ADMIN);
    }

    private static User user(String username, User.UserRole role) {
        return User.builder().username(username).passwordHash("x").fullName(username).role(role).build();
    }

    private static String message(ResponseEntity<?> response) {
        return String.valueOf(((Map<?, ?>) response.getBody()).get("message"));
    }

    // ---- approve ---------------------------------------------------------------------------------

    @Test
    void shouldForbidApproval_whenTheCallerIsStaff() {
        ResponseEntity<?> response = controller.approve(id, staff);

        assertEquals(403, response.getStatusCode().value());
        assertTrue(message(response).contains("approve"));
        verifyNoInteractions(transactionService);
    }

    @Test
    void shouldForbidApproval_whenThereIsNoAuthenticatedUser() {
        ResponseEntity<?> response = controller.approve(id, null);

        assertEquals(403, response.getStatusCode().value());
        verifyNoInteractions(transactionService);
    }

    @Test
    void shouldCheckTheRoleBeforeParsingTheId_whenStaffSendsAMalformedId() {
        // A 400 here would tell an unauthorised caller more than a 403 should.
        ResponseEntity<?> response = controller.approve("not-a-uuid", staff);

        assertEquals(403, response.getStatusCode().value());
        verifyNoInteractions(transactionService);
    }

    @Test
    void shouldApproveAndPassTheReviewer_whenTheCallerIsAManagerOrAdmin() {
        TransactionResponse approved = TransactionResponse.builder().id(id).status("APPROVED").build();
        when(transactionService.approve(UUID.fromString(id), manager)).thenReturn(approved);
        when(transactionService.approve(UUID.fromString(id), admin)).thenReturn(approved);

        ResponseEntity<?> byManager = controller.approve(id, manager);
        ResponseEntity<?> byAdmin = controller.approve(id, admin);

        assertEquals(200, byManager.getStatusCode().value());
        assertSame(approved, byManager.getBody());
        assertEquals(200, byAdmin.getStatusCode().value());
        verify(transactionService).approve(UUID.fromString(id), manager);
        verify(transactionService).approve(UUID.fromString(id), admin);
    }

    // ---- reject ----------------------------------------------------------------------------------

    @Test
    void shouldForbidRejection_whenTheCallerIsStaffOrAnonymous() {
        ResponseEntity<?> byStaff = controller.reject(id, Map.of("reason", "nope"), staff);
        ResponseEntity<?> anonymous = controller.reject(id, null, null);

        assertEquals(403, byStaff.getStatusCode().value());
        assertTrue(message(byStaff).contains("reject"));
        assertEquals(403, anonymous.getStatusCode().value());
        verifyNoInteractions(transactionService);
    }

    @Test
    void shouldRejectWithTheReasonAndReviewer_whenTheCallerIsAManager() {
        TransactionResponse rejected = TransactionResponse.builder().id(id).status("REJECTED").build();
        when(transactionService.reject(UUID.fromString(id), "duplicate entry", manager)).thenReturn(rejected);

        ResponseEntity<?> response = controller.reject(id, Map.of("reason", "duplicate entry"), manager);

        assertEquals(200, response.getStatusCode().value());
        assertSame(rejected, response.getBody());
    }

    @Test
    void shouldRejectWithoutAReason_whenTheRequestHasNoBody() {
        when(transactionService.reject(UUID.fromString(id), null, admin))
                .thenReturn(TransactionResponse.builder().id(id).status("REJECTED").build());

        ResponseEntity<?> response = controller.reject(id, null, admin);

        assertEquals(200, response.getStatusCode().value());
        verify(transactionService).reject(UUID.fromString(id), null, admin);
    }

    // ---- update / create (also tightened) --------------------------------------------------------

    @Test
    void shouldForbidEditing_whenTheCallerIsStaffOrAnonymous() {
        ResponseEntity<?> byStaff = controller.update(id, new TransactionRequest(), staff);
        ResponseEntity<?> anonymous = controller.update(id, new TransactionRequest(), null);

        assertEquals(403, byStaff.getStatusCode().value());
        assertEquals(403, anonymous.getStatusCode().value());
        verifyNoInteractions(transactionService);
    }

    @Test
    void shouldRequireAuthentication_whenCreatingATransaction() {
        ResponseEntity<?> response = controller.create(new TransactionRequest(), null);

        assertEquals(401, response.getStatusCode().value());
        verifyNoInteractions(transactionService);
    }

    @Test
    void shouldForbidLoanEntries_whenTheCallerIsStaff() {
        TransactionRequest loan = new TransactionRequest();
        loan.setBusinessCode("loan");

        ResponseEntity<?> response = controller.create(loan, staff);

        assertEquals(403, response.getStatusCode().value());
        verifyNoInteractions(transactionService);
    }

    @Test
    void shouldLetStaffCreateOrdinaryEntries() {
        TransactionRequest sale = new TransactionRequest();
        sale.setBusinessCode("furniture");
        TransactionResponse created = TransactionResponse.builder().id(id).status("PENDING_REVIEW").build();
        when(transactionService.create(any(TransactionRequest.class), any(User.class))).thenReturn(created);

        ResponseEntity<?> response = controller.create(sale, staff);

        assertEquals(200, response.getStatusCode().value());
        assertSame(created, response.getBody());
    }
}

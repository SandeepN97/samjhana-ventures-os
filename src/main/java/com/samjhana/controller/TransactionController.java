package com.samjhana.controller;

import com.samjhana.dto.TransactionRequest;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.User;
import com.samjhana.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;

    private static final Map<String, String> LOAN_ADMIN_ONLY =
            Map.of("message", "Only an admin can add a new loan or change loan entries");

    /** The one loan entry a manager may add: money paid to the bank (type SALE) marked as a PAYMENT. */
    private static boolean isLoanPayment(TransactionRequest request) {
        if (!"SALE".equalsIgnoreCase(request.getTransactionType())) return false;
        Map<String, Object> fields = request.getCustomFields();
        return fields != null && "PAYMENT".equals(String.valueOf(fields.get("loanType")));
    }

    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody TransactionRequest request,
            @AuthenticationPrincipal User user) {

        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Authentication required"));
        }
        if ("loan".equalsIgnoreCase(request.getBusinessCode())) {
            if (user.getRole() == User.UserRole.STAFF) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Staff members do not have access to loan management"));
            }
            // A manager records payments made to the bank. A new loan, or anything else on a loan, is the admin's.
            if (!user.isAdmin() && !isLoanPayment(request)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(LOAN_ADMIN_ONLY);
            }
        }

        TransactionResponse response = transactionService.create(request, user);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<TransactionResponse>> list(
            @RequestParam(required = false) String businessCode,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(transactionService.list(businessCode, user));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(transactionService.get(UUID.fromString(id), user));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable String id,
            @RequestBody TransactionRequest request,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }
        if (!user.isAdmin() && transactionService.isLoan(UUID.fromString(id))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(LOAN_ADMIN_ONLY);
        }
        return ResponseEntity.ok(transactionService.update(UUID.fromString(id), request, user));
    }

    /**
     * Approve a pending transaction. Requires MANAGER or ADMIN role.
     */
    @PatchMapping("/{id}/approve")
    public ResponseEntity<?> approve(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required to approve transactions"));
        }
        if (!user.isAdmin() && transactionService.isLoan(UUID.fromString(id))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(LOAN_ADMIN_ONLY);
        }
        return ResponseEntity.ok(transactionService.approve(UUID.fromString(id), user));
    }

    /**
     * Reject a pending transaction. Requires MANAGER or ADMIN role.
     */
    @PatchMapping("/{id}/reject")
    public ResponseEntity<?> reject(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required to reject transactions"));
        }
        if (!user.isAdmin() && transactionService.isLoan(UUID.fromString(id))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(LOAN_ADMIN_ONLY);
        }
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(transactionService.reject(UUID.fromString(id), reason, user));
    }
}
package com.samjhana.controller;

import com.samjhana.entity.AuditLog;
import com.samjhana.entity.LoanReceipt;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.service.LoanReceiptService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/**
 * Bank-receipt photos for loan payments, and the count of payments waiting for an admin. Admin and manager only:
 * nothing here is public, and a photo is never cached by the browser.
 */
@RestController
@RequestMapping("/api/loans")
@RequiredArgsConstructor
public class LoanReceiptController {

    private static final Map<String, String> FORBIDDEN = Map.of("message", "Admin or manager access required");

    private final LoanReceiptService receiptService;
    private final TransactionRepository transactionRepository;
    private final AuditLogRepository auditLogRepository;

    @PostMapping("/receipts")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file, @AuthenticationPrincipal User user) {
        if (user == null || !user.canManage()) return ResponseEntity.status(HttpStatus.FORBIDDEN).body(FORBIDDEN);
        LoanReceipt receipt = receiptService.store(file, user);
        return ResponseEntity.ok(Map.of("receiptId", receipt.getId().toString()));
    }

    @GetMapping("/receipts/{id}")
    public ResponseEntity<?> view(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        if (user == null || !user.canManage()) return ResponseEntity.status(HttpStatus.FORBIDDEN).body(FORBIDDEN);
        LoanReceipt receipt = receiptService.find(id).orElse(null);
        if (receipt == null) return ResponseEntity.notFound().build();
        auditLogRepository.save(AuditLog.builder().user(user).entityType(AuditLog.EntityType.IMAGE_ATTACHMENT)
                .entityId(receipt.getId()).action(AuditLog.AuditAction.UPDATE)
                .description("Opened loan receipt photo").build());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(receipt.getContentType()))
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .body(receipt.getData());
    }

    /** How many loan payments are waiting for an admin to approve or reject them. */
    @GetMapping("/pending-payments")
    public ResponseEntity<?> pendingPayments(@AuthenticationPrincipal User user) {
        if (user == null || !user.canManage()) return ResponseEntity.status(HttpStatus.FORBIDDEN).body(FORBIDDEN);
        long count = transactionRepository.countByBusiness_CodeAndStatus("loan", Transaction.TransactionStatus.PENDING_REVIEW);
        return ResponseEntity.ok(Map.of("count", count));
    }
}

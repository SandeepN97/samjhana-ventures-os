package com.samjhana.controller;

import com.samjhana.dto.TransactionRequest;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.User;
import com.samjhana.service.TransactionService;
import lombok.RequiredArgsConstructor;
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

    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody TransactionRequest request,
            @AuthenticationPrincipal User user) {

        if ("loan".equalsIgnoreCase(request.getBusinessCode()) && user.getRole() == User.UserRole.STAFF) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Staff members do not have access to loan management"));
        }

        TransactionResponse response = transactionService.create(request, user);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<TransactionResponse>> list(
            @RequestParam(required = false) String businessCode) {
        return ResponseEntity.ok(transactionService.list(businessCode));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        return ResponseEntity.ok(transactionService.get(UUID.fromString(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable String id,
            @RequestBody TransactionRequest request,
            @AuthenticationPrincipal User user) {

        if (!user.canManage()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }
        return ResponseEntity.ok(transactionService.update(UUID.fromString(id), request, user));
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable String id) {
        return ResponseEntity.ok(transactionService.approve(UUID.fromString(id)));
    }

    @PatchMapping("/{id}/reject")
    public ResponseEntity<?> reject(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal User user) {

        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(transactionService.reject(UUID.fromString(id), reason, user));
    }
}
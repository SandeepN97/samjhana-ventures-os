package com.samjhana.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.TransactionRepository;
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

    private final TransactionRepository transactionRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final FurnitureItemRepository furnitureItemRepository;
    private final ObjectMapper objectMapper;

    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody TransactionRequest request,
            @AuthenticationPrincipal User user) {

        // Staff cannot access loan transactions
        if ("loan".equalsIgnoreCase(request.getBusinessCode()) && user.getRole() == User.UserRole.STAFF) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Staff members do not have access to loan management"));
        }

        // Find business unit
        BusinessUnit business = businessUnitRepository.findByCode(request.getBusinessCode())
                .orElseThrow(() -> new RuntimeException("Business not found: " + request.getBusinessCode()));

        // Convert custom fields to JSON
        String customFieldsJson;
        try {
            customFieldsJson = objectMapper.writeValueAsString(request.getCustomFields());
        } catch (JsonProcessingException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid custom fields"));
        }

        // Create transaction
        Transaction transaction = Transaction.builder()
                .business(business)
                .enteredBy(user)
                .transactionType(Transaction.TransactionType.valueOf(request.getTransactionType()))
                .transactionDate(request.getTransactionDate())
                .amount(request.getAmount())
                .notes(request.getNotes())
                .referenceNumber(request.getReferenceNumber())
                .customFields(customFieldsJson)
                .status(Transaction.TransactionStatus.APPROVED)
                .build();

        Transaction saved = transactionRepository.save(transaction);

        // Auto-adjust furniture stock on sale/purchase
        if ("furniture".equalsIgnoreCase(request.getBusinessCode()) && request.getCustomFields() != null) {
            adjustFurnitureStock(request.getCustomFields(), request.getTransactionType());
        }

        return ResponseEntity.ok(TransactionResponse.from(saved));
    }

    @GetMapping
    public ResponseEntity<List<TransactionResponse>> list(
            @RequestParam(required = false) String businessCode) {

        List<Transaction> transactions;
        if (businessCode != null && !businessCode.isBlank()) {
            transactions = transactionRepository.findByBusinessCodeOrderByTransactionDateDesc(businessCode);
        } else {
            transactions = transactionRepository.findAllWithDetails();
        }

        List<TransactionResponse> response = transactions.stream()
                .map(TransactionResponse::from)
                .toList();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        return transactionRepository.findById(java.util.UUID.fromString(id))
                .map(t -> ResponseEntity.ok(TransactionResponse.from(t)))
                .orElse(ResponseEntity.notFound().build());
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

        return transactionRepository.findById(UUID.fromString(id))
                .map(t -> {
                    if (request.getAmount() != null) t.setAmount(request.getAmount());
                    if (request.getTransactionType() != null) {
                        t.setTransactionType(Transaction.TransactionType.valueOf(request.getTransactionType()));
                    }
                    if (request.getNotes() != null) t.setNotes(request.getNotes());
                    if (request.getReferenceNumber() != null) t.setReferenceNumber(request.getReferenceNumber());
                    if (request.getTransactionDate() != null) t.setTransactionDate(request.getTransactionDate());
                    if (request.getCustomFields() != null) {
                        try {
                            t.setCustomFields(objectMapper.writeValueAsString(request.getCustomFields()));
                        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                            // ignore
                        }
                    }
                    t.setReviewedBy(user);
                    t.setReviewedAt(java.time.LocalDateTime.now());
                    Transaction saved = transactionRepository.save(t);
                    return ResponseEntity.ok(TransactionResponse.from(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable String id) {
        return transactionRepository.findById(java.util.UUID.fromString(id))
                .map(t -> {
                    t.setStatus(Transaction.TransactionStatus.APPROVED);
                    Transaction saved = transactionRepository.save(t);
                    return ResponseEntity.ok(TransactionResponse.from(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/reject")
    public ResponseEntity<?> reject(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal User user) {
        return transactionRepository.findById(java.util.UUID.fromString(id))
                .map(t -> {
                    t.setStatus(Transaction.TransactionStatus.REJECTED);
                    // Store rejection reason in reviewNotes
                    if (body != null && body.containsKey("reason")) {
                        t.setReviewNotes(body.get("reason"));
                    }
                    if (user != null) {
                        t.setReviewedBy(user);
                        t.setReviewedAt(java.time.LocalDateTime.now());
                    }
                    Transaction saved = transactionRepository.save(t);
                    return ResponseEntity.ok(TransactionResponse.from(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @SuppressWarnings("unchecked")
    private void adjustFurnitureStock(Map<String, Object> customFields, String transactionType) {
        Object itemsObj = customFields.get("items");
        if (!(itemsObj instanceof List)) return;

        List<Map<String, Object>> items = (List<Map<String, Object>>) itemsObj;
        boolean isSale = "SALE".equalsIgnoreCase(transactionType);

        for (Map<String, Object> lineItem : items) {
            String itemId = lineItem.get("itemId") != null ? lineItem.get("itemId").toString() : null;
            if (itemId == null) continue;

            int qty = 1;
            if (lineItem.get("quantity") instanceof Number) {
                qty = ((Number) lineItem.get("quantity")).intValue();
            }

            try {
                FurnitureItem furnitureItem = furnitureItemRepository.findById(UUID.fromString(itemId)).orElse(null);
                if (furnitureItem != null) {
                    int newStock = isSale
                            ? Math.max(0, furnitureItem.getStockQty() - qty)
                            : furnitureItem.getStockQty() + qty;
                    furnitureItem.setStockQty(newStock);
                    furnitureItemRepository.save(furnitureItem);
                }
            } catch (IllegalArgumentException ignored) {}
        }
    }
}

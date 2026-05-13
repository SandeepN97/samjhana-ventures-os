package com.samjhana.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.exception.BusinessUnitNotFoundException;
import com.samjhana.exception.TransactionNotFoundException;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final FurnitureItemRepository furnitureItemRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public TransactionResponse create(TransactionRequest request, User user) {
        BusinessUnit business = businessUnitRepository.findByCode(request.getBusinessCode())
                .orElseThrow(() -> new BusinessUnitNotFoundException(request.getBusinessCode()));

        String customFieldsJson;
        try {
            customFieldsJson = objectMapper.writeValueAsString(request.getCustomFields());
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid custom fields");
        }

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

        if ("furniture".equalsIgnoreCase(request.getBusinessCode()) && request.getCustomFields() != null) {
            adjustFurnitureStock(request.getCustomFields(), request.getTransactionType());
        }

        return TransactionResponse.from(saved);
    }

    public List<TransactionResponse> list(String businessCode) {
        List<Transaction> transactions;
        if (businessCode != null && !businessCode.isBlank()) {
            transactions = transactionRepository.findByBusinessCodeOrderByTransactionDateDesc(businessCode);
        } else {
            transactions = transactionRepository.findAllWithDetails();
        }
        return transactions.stream().map(TransactionResponse::from).toList();
    }

    public TransactionResponse get(UUID id) {
        return transactionRepository.findById(id)
                .map(TransactionResponse::from)
                .orElseThrow(() -> new TransactionNotFoundException(id.toString()));
    }

    @Transactional
    public TransactionResponse update(UUID id, TransactionRequest request, User user) {
        Transaction t = transactionRepository.findById(id)
                .orElseThrow(() -> new TransactionNotFoundException(id.toString()));

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
            } catch (JsonProcessingException ignored) {}
        }
        t.setReviewedBy(user);
        t.setReviewedAt(LocalDateTime.now());

        return TransactionResponse.from(transactionRepository.save(t));
    }

    @Transactional
    public TransactionResponse approve(UUID id) {
        Transaction t = transactionRepository.findById(id)
                .orElseThrow(() -> new TransactionNotFoundException(id.toString()));
        t.setStatus(Transaction.TransactionStatus.APPROVED);
        return TransactionResponse.from(transactionRepository.save(t));
    }

    @Transactional
    public TransactionResponse reject(UUID id, String reason, User user) {
        Transaction t = transactionRepository.findById(id)
                .orElseThrow(() -> new TransactionNotFoundException(id.toString()));
        t.setStatus(Transaction.TransactionStatus.REJECTED);
        if (reason != null) t.setReviewNotes(reason);
        if (user != null) {
            t.setReviewedBy(user);
            t.setReviewedAt(LocalDateTime.now());
        }
        return TransactionResponse.from(transactionRepository.save(t));
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
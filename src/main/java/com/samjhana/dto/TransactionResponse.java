package com.samjhana.dto;

import com.samjhana.entity.Transaction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
public class TransactionResponse {
    private String id;
    private String businessCode;
    private String businessName;
    private String transactionType;
    private LocalDate transactionDate;
    private BigDecimal amount;
    private String status;
    private String notes;
    private String referenceNumber;
    private String customFields;
    private String enteredByName;
    private LocalDateTime createdAt;
    private String reviewNotes;      // Rejection reason
    private String reviewedByName;   // Who reviewed it
    private LocalDateTime reviewedAt;

    public static TransactionResponse from(Transaction t) {
        return TransactionResponse.builder()
                .id(t.getId().toString())
                .businessCode(t.getBusiness().getCode())
                .businessName(t.getBusiness().getName())
                .transactionType(t.getTransactionType().name())
                .transactionDate(t.getTransactionDate())
                .amount(t.getAmount())
                .status(t.getStatus().name())
                .notes(t.getNotes())
                .referenceNumber(t.getReferenceNumber())
                .customFields(t.getCustomFields())
                .enteredByName(t.getEnteredBy().getFullName())
                .createdAt(t.getCreatedAt())
                .reviewNotes(t.getReviewNotes())
                .reviewedByName(t.getReviewedBy() != null ? t.getReviewedBy().getFullName() : null)
                .reviewedAt(t.getReviewedAt())
                .build();
    }
}

package com.samjhana.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Data
public class TransactionRequest {
    private String businessCode;
    private String transactionType;
    private LocalDate transactionDate;
    private BigDecimal amount;
    private String notes;
    private String referenceNumber;
    private Map<String, Object> customFields;
}

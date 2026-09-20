package com.samjhana.dto;

import com.samjhana.entity.ElectricityBill;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class ElectricityBillResponse {
    private String id;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private BigDecimal billedKwh;
    private BigDecimal amountPaid;
    private String referenceNumber;
    private String notes;
    private String createdByName;
    private LocalDateTime createdAt;

    public static ElectricityBillResponse from(ElectricityBill bill) {
        return ElectricityBillResponse.builder()
                .id(bill.getId().toString())
                .periodStart(bill.getPeriodStart())
                .periodEnd(bill.getPeriodEnd())
                .billedKwh(bill.getBilledKwh())
                .amountPaid(bill.getAmountPaid())
                .referenceNumber(bill.getReferenceNumber())
                .notes(bill.getNotes())
                .createdByName(bill.getCreatedBy().getFullName())
                .createdAt(bill.getCreatedAt())
                .build();
    }
}

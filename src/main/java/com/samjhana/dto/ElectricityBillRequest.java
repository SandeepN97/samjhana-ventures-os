package com.samjhana.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ElectricityBillRequest {
    @NotNull
    private LocalDate periodStart;
    @NotNull
    private LocalDate periodEnd;
    @NotNull
    @DecimalMin(value = "0.001")
    private BigDecimal billedKwh;
    @NotNull
    @DecimalMin(value = "0.01")
    private BigDecimal amountPaid;
    @Size(max = 100)
    private String referenceNumber;
    @Size(max = 1000)
    private String notes;
}

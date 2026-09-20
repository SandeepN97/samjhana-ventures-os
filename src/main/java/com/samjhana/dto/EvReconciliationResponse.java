package com.samjhana.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class EvReconciliationResponse {
    private String electricityBillId;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private BigDecimal soldKwh;
    private BigDecimal billedKwh;
    private BigDecimal varianceKwh;
    private BigDecimal variancePercent;
    private BigDecimal revenue;
    private BigDecimal electricityCost;
    private BigDecimal profit;
    private BigDecimal profitPercent;
    private List<ChargePointBreakdown> byChargePoint;

    public record ChargePointBreakdown(
            String chargePointCode,
            String model,
            long sessions,
            BigDecimal soldKwh,
            BigDecimal revenue) {}
}

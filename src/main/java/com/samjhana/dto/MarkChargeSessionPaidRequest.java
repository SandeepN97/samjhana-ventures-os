package com.samjhana.dto;

import com.samjhana.entity.ChargeSession;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class MarkChargeSessionPaidRequest {
    @NotNull
    private ChargeSession.PaymentMethod method;

    @NotNull
    @DecimalMin(value = "0.01")
    private BigDecimal amount;
}

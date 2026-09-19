package com.samjhana.dto;

import com.samjhana.entity.ChargePoint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Staff-facing view of a charger. Authenticated endpoint only — never expose
 * through /api/public.
 */
@Data
@Builder
@AllArgsConstructor
public class ChargePointResponse {
    private String id;
    private String code;
    private String model;
    private BigDecimal maxPowerKw;
    private Integer displayOrder;

    public static ChargePointResponse from(ChargePoint c) {
        return ChargePointResponse.builder()
                .id(c.getId().toString())
                .code(c.getCode())
                .model(c.getModel())
                .maxPowerKw(c.getMaxPowerKw())
                .displayOrder(c.getDisplayOrder())
                .build();
    }
}

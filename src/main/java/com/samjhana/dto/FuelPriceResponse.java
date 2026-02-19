package com.samjhana.dto;

import com.samjhana.entity.FuelPrice;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
public class FuelPriceResponse {
    private String id;
    private String fuelType;
    private BigDecimal pricePerLiter;
    private LocalDate effectiveDate;
    private String updatedByName;
    private LocalDateTime createdAt;

    public static FuelPriceResponse from(FuelPrice fp) {
        return FuelPriceResponse.builder()
                .id(fp.getId().toString())
                .fuelType(fp.getFuelType().name())
                .pricePerLiter(fp.getPricePerLiter())
                .effectiveDate(fp.getEffectiveDate())
                .updatedByName(fp.getUpdatedBy() != null ? fp.getUpdatedBy().getFullName() : "NOC Auto-Update")
                .createdAt(fp.getCreatedAt())
                .build();
    }
}

package com.samjhana.dto;

import com.samjhana.entity.EvVehicle;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
public class EvVehicleResponse {
    private String id;
    private String vehicleName;
    private BigDecimal batteryCapacityKw;
    private Integer seatingCapacity;
    private BigDecimal ratePerPercent;
    private Boolean isActive;
    private String updatedByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static EvVehicleResponse from(EvVehicle v) {
        return EvVehicleResponse.builder()
                .id(v.getId().toString())
                .vehicleName(v.getVehicleName())
                .batteryCapacityKw(v.getBatteryCapacityKw())
                .seatingCapacity(v.getSeatingCapacity())
                .ratePerPercent(v.getRatePerPercent())
                .isActive(v.getIsActive())
                .updatedByName(v.getUpdatedBy() != null ? v.getUpdatedBy().getFullName() : null)
                .createdAt(v.getCreatedAt())
                .updatedAt(v.getUpdatedAt())
                .build();
    }
}

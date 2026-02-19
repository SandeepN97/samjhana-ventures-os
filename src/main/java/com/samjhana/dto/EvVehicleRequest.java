package com.samjhana.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class EvVehicleRequest {
    private String vehicleName;
    private BigDecimal batteryCapacityKw;
    private Integer seatingCapacity;
    private BigDecimal ratePerPercent;
}

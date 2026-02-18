package com.samjhana.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class FuelPriceRequest {
    private String fuelType; // PETROL or DIESEL
    private BigDecimal pricePerLiter;
    private LocalDate effectiveDate;
}

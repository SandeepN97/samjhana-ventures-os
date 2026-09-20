package com.samjhana.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class StartChargeSessionRequest {
    @NotBlank
    private String chargePointId;

    @Min(1)
    private Integer connectorId = 1;

    @NotBlank
    @Size(max = 32)
    private String plateNumber;

    @Size(max = 120)
    private String customerName;

    @Size(max = 30)
    private String phoneNumber;

    /** Optional camera data URL; JPEG, PNG, or WebP up to 5 MB after decoding. */
    private String platePhotoDataUrl;

    private String vehicleCatalogId;

    @NotNull
    @Min(1)
    @Max(100)
    private Integer targetPercent;

    @Min(0)
    @Max(100)
    private Integer initialSoc;

    @Size(max = 1000)
    private String notes;
}

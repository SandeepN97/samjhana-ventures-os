package com.samjhana.dto;

import com.samjhana.entity.ChargeSession;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class ChargeSessionResponse {
    private String id;
    private String status;
    private String statusMessage;
    private String chargePointId;
    private String chargePointCode;
    private String chargerModel;
    private Integer connectorId;
    private String plateNumber;
    private String customerName;
    private String platePhotoUrl;
    private String vehicleCatalogName;
    private Integer targetPercent;
    private Integer startSoc;
    private Integer currentSoc;
    private BigDecimal energyDeliveredKwh;
    private BigDecimal ratePerPercent;
    private Integer percentCharged;
    private BigDecimal suggestedAmount;
    private BigDecimal amount;
    private String paymentMethod;
    private String ocppTransactionId;
    private LocalDateTime requestedAt;
    private LocalDateTime startedAt;
    private LocalDateTime stoppedAt;
    private LocalDateTime paidAt;
    private LocalDateTime closedAt;

    public static ChargeSessionResponse from(ChargeSession session) {
        // Customers are charged by car type and percentage: the vehicle's price per 1% of
        // battery × the percentage actually charged (the charger reports state of charge).
        Integer percentCharged = null;
        if (session.getStartSoc() != null && session.getCurrentSoc() != null) {
            percentCharged = Math.max(0, session.getCurrentSoc() - session.getStartSoc());
        }
        BigDecimal suggested = null;
        if (session.getRatePerPercent() != null && percentCharged != null) {
            suggested = session.getRatePerPercent().multiply(BigDecimal.valueOf(percentCharged))
                    .setScale(2, java.math.RoundingMode.HALF_UP);
        }
        return ChargeSessionResponse.builder()
                .id(session.getId().toString())
                .status(session.getStatus().name())
                .statusMessage(session.getStatusMessage())
                .chargePointId(session.getChargePoint().getId().toString())
                .chargePointCode(session.getChargePoint().getCode())
                .chargerModel(session.getChargePoint().getModel())
                .connectorId(session.getConnectorId())
                .plateNumber(session.getVehicle().getPlateNumber())
                .customerName(session.getVehicle().getCustomerName())
                .platePhotoUrl(session.getVehicle().getPlatePhotoPath() == null
                        ? null : "/api/ev/vehicle-photos/" + session.getVehicle().getId())
                .vehicleCatalogName(session.getVehicleCatalog() == null
                        ? null : session.getVehicleCatalog().getVehicleName())
                .targetPercent(session.getTargetPercent())
                .startSoc(session.getStartSoc())
                .currentSoc(session.getCurrentSoc())
                .energyDeliveredKwh(session.getEnergyDeliveredKwh())
                .ratePerPercent(session.getRatePerPercent())
                .percentCharged(percentCharged)
                .suggestedAmount(suggested)
                .amount(session.getAmount())
                .paymentMethod(session.getPaymentMethod() == null ? null : session.getPaymentMethod().name())
                .ocppTransactionId(session.getOcppTransactionId())
                .requestedAt(session.getRequestedAt())
                .startedAt(session.getStartedAt())
                .stoppedAt(session.getStoppedAt())
                .paidAt(session.getPaidAt())
                .closedAt(session.getClosedAt())
                .build();
    }
}

package com.samjhana.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.samjhana.dto.ChargeSessionResponse;
import com.samjhana.dto.MarkChargeSessionPaidRequest;
import com.samjhana.dto.StartChargeSessionRequest;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.entity.*;
import com.samjhana.exception.EvSessionStateException;
import com.samjhana.exception.ResourceNotFoundException;
import com.samjhana.ocpp.OcppCommandService;
import com.samjhana.ocpp.OcppConnectionRegistry;
import com.samjhana.repository.*;
import com.samjhana.websocket.EvLiveWebSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.function.BiConsumer;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChargeSessionService {

    private static final Set<ChargeSession.Status> OPEN_STATUSES = EnumSet.of(
            ChargeSession.Status.STARTING,
            ChargeSession.Status.ACTIVE,
            ChargeSession.Status.STOP_REQUESTED,
            ChargeSession.Status.AWAITING_PAYMENT,
            ChargeSession.Status.PAID,
            ChargeSession.Status.UNLOCK_REQUESTED);

    private final ChargeSessionRepository chargeSessionRepository;
    private final ChargePointRepository chargePointRepository;
    private final EvCustomerVehicleRepository customerVehicleRepository;
    private final EvVehicleRepository evVehicleRepository;
    private final PlatePhotoStorageService photoStorageService;
    private final OcppCommandService ocppCommands;
    private final TransactionService transactionService;
    private final TransactionRepository transactionRepository;
    private final AuditLogRepository auditLogRepository;
    private final EvLiveWebSocketHandler liveEvents;
    private final TransactionTemplate transactionTemplate;

    @Transactional
    public ChargeSessionResponse start(StartChargeSessionRequest request, User user) {
        ChargePoint chargePoint = chargePointRepository.findById(parseUuid(request.getChargePointId(), "charge point"))
                .filter(point -> point.getDeletedAt() == null && Boolean.TRUE.equals(point.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Active charge point not found"));
        if (!ocppCommands.isConnected(chargePoint.getCode())) {
            throw new EvSessionStateException("Charger " + chargePoint.getCode() + " is offline");
        }
        if (chargeSessionRepository.existsByChargePointIdAndStatusIn(chargePoint.getId(), OPEN_STATUSES)) {
            throw new EvSessionStateException("This charger already has an open session");
        }
        if (request.getInitialSoc() != null && request.getTargetPercent() <= request.getInitialSoc()) {
            throw new IllegalArgumentException("Target percentage must be greater than the starting percentage");
        }

        String plate = normalizePlate(request.getPlateNumber());
        EvCustomerVehicle vehicle = customerVehicleRepository.findByPlateNumberAndDeletedAtIsNull(plate)
                .orElseGet(() -> EvCustomerVehicle.builder().plateNumber(plate).build());
        if (request.getCustomerName() != null) vehicle.setCustomerName(clean(request.getCustomerName()));
        if (request.getPhoneNumber() != null) vehicle.setPhoneNumber(clean(request.getPhoneNumber()));
        if (request.getPlatePhotoDataUrl() != null && !request.getPlatePhotoDataUrl().isBlank()) {
            vehicle.setPlatePhotoPath(photoStorageService.store(request.getPlatePhotoDataUrl(), plate));
        }
        vehicle = customerVehicleRepository.save(vehicle);

        EvVehicle catalog = null;
        if (request.getVehicleCatalogId() != null && !request.getVehicleCatalogId().isBlank()) {
            catalog = evVehicleRepository.findById(parseUuid(request.getVehicleCatalogId(), "vehicle type"))
                    .filter(item -> Boolean.TRUE.equals(item.getIsActive()))
                    .orElseThrow(() -> new ResourceNotFoundException("EV vehicle type not found"));
        }

        ChargeSession session = ChargeSession.builder()
                .chargePoint(chargePoint)
                .vehicle(vehicle)
                .vehicleCatalog(catalog)
                .startedBy(user)
                .connectorId(request.getConnectorId() == null ? 1 : request.getConnectorId())
                .targetPercent(request.getTargetPercent())
                .startSoc(request.getInitialSoc())
                .currentSoc(request.getInitialSoc())
                .ratePerPercent(catalog == null ? null : catalog.getRatePerPercent())
                .energyDeliveredKwh(BigDecimal.ZERO)
                .status(ChargeSession.Status.STARTING)
                .statusMessage("Start command sent to charger")
                .notes(clean(request.getNotes()))
                .requestedAt(LocalDateTime.now())
                .build();
        session = chargeSessionRepository.save(session);

        auditLogRepository.save(AuditLog.createEvent(user, AuditLog.EntityType.CHARGE_SESSION,
                session.getId(), "{\"status\":\"STARTING\",\"chargePoint\":\"" + chargePoint.getCode() + "\"}"));
        UUID sessionId = session.getId();
        String code = chargePoint.getCode();
        int connectorId = session.getConnectorId();
        return publish(session, new Dispatch(
                () -> ocppCommands.requestStart(code, sessionId, connectorId, plate),
                (failed, reason) -> {
                    failed.setStatus(ChargeSession.Status.FAILED);
                    failed.setStatusMessage("Could not send the start command: " + reason);
                }));
    }

    @Transactional(readOnly = true)
    public List<ChargeSessionResponse> active() {
        return chargeSessionRepository.findByStatusInOrderByRequestedAtAsc(OPEN_STATUSES)
                .stream().map(ChargeSessionResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ChargeSessionResponse> recent() {
        return chargeSessionRepository.findTop50ByOrderByRequestedAtDesc()
                .stream().map(ChargeSessionResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ChargeSessionResponse get(UUID id) {
        return ChargeSessionResponse.from(find(id));
    }

    @Transactional
    public ChargeSessionResponse stop(UUID id) {
        ChargeSession session = find(id);
        requireStatus(session, ChargeSession.Status.ACTIVE);
        boolean autoUnlock = session.getChargePoint().getLockBehavior() == ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP;
        if (!autoUnlock) {
            requireOcppTransaction(session);
            requireConnected(session);
        }
        session.setStopRequestedAt(LocalDateTime.now());

        Dispatch stopCommand = null;
        if (autoUnlock) {
            session.setStatus(ChargeSession.Status.AWAITING_PAYMENT);
            session.setStatusMessage("Payment required before stopping; this charger unlocks automatically on stop");
        } else {
            session.setStatus(ChargeSession.Status.STOP_REQUESTED);
            session.setStatusMessage("Stop command sent; connector remains locked");
            stopCommand = requestStopDispatch(session, ChargeSession.Status.ACTIVE, "stop");
        }
        return publish(chargeSessionRepository.save(session), stopCommand);
    }

    @Transactional
    public ChargeSessionResponse markPaid(UUID id, MarkChargeSessionPaidRequest request, User user) {
        ChargeSession session = find(id);
        requireStatus(session, ChargeSession.Status.AWAITING_PAYMENT);
        requireConnected(session); // both branches send a command: refuse before touching anything
        session.setPaymentMethod(request.getMethod());
        session.setAmount(request.getAmount().setScale(2, RoundingMode.HALF_UP));
        session.setPaidBy(user);
        session.setPaidAt(LocalDateTime.now());
        session.setStatus(ChargeSession.Status.PAID);
        session.setStatusMessage("Payment confirmed");

        Dispatch command;
        if (session.getChargePoint().getLockBehavior() == ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP) {
            requireOcppTransaction(session);
            session.setStatus(ChargeSession.Status.STOP_REQUESTED);
            session.setStatusMessage("Payment confirmed; stop command sent and connector will unlock automatically");
            command = requestStopDispatch(session, ChargeSession.Status.PAID, "stop");
        } else {
            ensureTransaction(session);
            session.setStatus(ChargeSession.Status.UNLOCK_REQUESTED);
            session.setStatusMessage("Payment confirmed; unlock command sent");
            command = unlockDispatch(session);
        }
        return publish(chargeSessionRepository.save(session), command);
    }

    @Transactional
    public ChargeSessionResponse retryUnlock(UUID id) {
        ChargeSession session = find(id);
        if (session.getPaidAt() == null || session.getChargePoint().getLockBehavior() != ChargePoint.LockBehavior.EXPLICIT_UNLOCK) {
            throw new EvSessionStateException("Only a paid session with explicit connector locking can be unlocked");
        }
        if (session.getStatus() != ChargeSession.Status.PAID
                && session.getStatus() != ChargeSession.Status.UNLOCK_REQUESTED) {
            throw new EvSessionStateException("Session is not waiting for connector unlock");
        }
        requireConnected(session);
        session.setStatus(ChargeSession.Status.UNLOCK_REQUESTED);
        session.setStatusMessage("Unlock command resent");
        return publish(chargeSessionRepository.save(session), unlockDispatch(session));
    }

    @Transactional
    public void handleTransactionEvent(String chargePointCode, JsonNode payload) {
        String transactionId = payload.path("transactionInfo").path("transactionId").asText(null);
        ChargeSession session = findForEvent(chargePointCode, transactionId);
        if (session == null) {
            log.warn("Ignoring TransactionEvent from {} because no matching session exists", chargePointCode);
            return;
        }

        int sequence = payload.path("seqNo").asInt(-1);
        if (sequence >= 0 && session.getLastSequenceNumber() != null
                && sequence <= session.getLastSequenceNumber()) {
            return; // Idempotent handling of replayed OCPP events.
        }
        if (sequence >= 0) session.setLastSequenceNumber(sequence);
        if (transactionId != null && !transactionId.isBlank()) session.setOcppTransactionId(transactionId);

        updateMeterValues(session, payload.path("meterValue"));
        String eventType = payload.path("eventType").asText();
        LocalDateTime eventTime = parseTimestamp(payload.path("timestamp").asText(null));
        if ("Started".equals(eventType)) {
            session.setStartedAt(eventTime);
            session.setStatus(ChargeSession.Status.ACTIVE);
            session.setStatusMessage("Charging in progress");
        } else if ("Ended".equals(eventType)) {
            session.setStoppedAt(eventTime);
            if (session.getPaidAt() != null) {
                ensureTransaction(session);
                session.setStatus(ChargeSession.Status.CLOSED);
                session.setClosedAt(eventTime);
                session.setStatusMessage("Paid, stopped, and connector released");
            } else {
                session.setStatus(ChargeSession.Status.AWAITING_PAYMENT);
                session.setStatusMessage("Charging stopped; payment required to unlock connector");
            }
        }

        Dispatch autoStop = maybeStopAtTarget(session);
        publish(chargeSessionRepository.save(session), autoStop);
    }

    @Transactional
    public void handleCommandResult(OcppConnectionRegistry.PendingCommand command,
                                    JsonNode payload, String error) {
        ChargeSession session = chargeSessionRepository.findById(command.chargeSessionId()).orElse(null);
        if (session == null) return;
        String status = payload == null ? null : payload.path("status").asText(null);
        boolean rejected = error != null || "Rejected".equalsIgnoreCase(status)
                || "UnlockFailed".equalsIgnoreCase(status)
                || "UnknownConnector".equalsIgnoreCase(status);

        switch (command.action()) {
            case "RequestStartTransaction" -> {
                if (rejected) {
                    session.setStatus(ChargeSession.Status.FAILED);
                    session.setStatusMessage(error != null ? error : "Charger rejected the start command");
                }
            }
            case "RequestStopTransaction" -> {
                if (rejected) {
                    session.setStatus(session.getPaidAt() == null
                            ? ChargeSession.Status.ACTIVE : ChargeSession.Status.PAID);
                    session.setStatusMessage(error != null ? error : "Charger rejected the stop command");
                }
            }
            case "UnlockConnector" -> {
                if ("Unlocked".equalsIgnoreCase(status)) {
                    session.setStatus(ChargeSession.Status.CLOSED);
                    session.setClosedAt(LocalDateTime.now());
                    session.setStatusMessage("Payment confirmed and connector unlocked");
                } else if (rejected) {
                    session.setStatus(ChargeSession.Status.PAID);
                    session.setStatusMessage(error != null ? error : "Connector unlock failed; retry required");
                }
            }
            default -> log.debug("No session transition for OCPP result {}", command.action());
        }
        publish(chargeSessionRepository.save(session));
    }

    public EvCustomerVehicle getVehicle(UUID id) {
        return customerVehicleRepository.findById(id)
                .filter(vehicle -> vehicle.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found"));
    }

    /** Returns the stop command to send once the update is committed, or null if none is needed. */
    private Dispatch maybeStopAtTarget(ChargeSession session) {
        if (session.getStatus() != ChargeSession.Status.ACTIVE || session.getCurrentSoc() == null
                || session.getCurrentSoc() < session.getTargetPercent()) return null;

        session.setStopRequestedAt(LocalDateTime.now());
        if (session.getChargePoint().getLockBehavior() == ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP) {
            session.setStatus(ChargeSession.Status.AWAITING_PAYMENT);
            session.setStatusMessage("Target reached; collect payment before stopping this auto-unlocking charger");
            return null;
        }
        requireOcppTransaction(session);
        session.setStatus(ChargeSession.Status.STOP_REQUESTED);
        session.setStatusMessage("Target reached; automatic stop command sent");
        return requestStopDispatch(session, ChargeSession.Status.ACTIVE, "automatic stop");
    }

    private void updateMeterValues(ChargeSession session, JsonNode meterValues) {
        if (!meterValues.isArray()) return;
        Integer soc = null;
        BigDecimal energyWh = null;
        for (JsonNode meterValue : meterValues) {
            for (JsonNode sampled : meterValue.path("sampledValue")) {
                String measurand = sampled.path("measurand").asText("Energy.Active.Import.Register");
                BigDecimal value = decimal(sampled.path("value").asText(null));
                if (value == null) continue;
                if ("SoC".equalsIgnoreCase(measurand)) {
                    soc = value.intValue();
                } else if (measurand.startsWith("Energy.Active.Import")) {
                    String unit = sampled.path("unitOfMeasure").path("unit").asText("Wh");
                    int multiplier = sampled.path("unitOfMeasure").path("multiplier").asInt(0);
                    value = value.scaleByPowerOfTen(multiplier);
                    energyWh = "kWh".equalsIgnoreCase(unit) ? value.multiply(BigDecimal.valueOf(1000)) : value;
                }
            }
        }
        if (soc != null) {
            int bounded = Math.max(0, Math.min(100, soc));
            if (session.getStartSoc() == null) session.setStartSoc(bounded);
            session.setCurrentSoc(bounded);
        }
        if (energyWh != null) {
            if (session.getStartMeterWh() == null) session.setStartMeterWh(energyWh);
            session.setLastMeterWh(energyWh);
            BigDecimal delivered = energyWh.subtract(session.getStartMeterWh())
                    .max(BigDecimal.ZERO).divide(BigDecimal.valueOf(1000), 3, RoundingMode.HALF_UP);
            session.setEnergyDeliveredKwh(delivered);
        }
    }

    private void ensureTransaction(ChargeSession session) {
        if (session.getTransaction() != null) return;
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("chargingMode", "OCPP_SESSION");
        fields.put("chargeSessionId", session.getId().toString());
        fields.put("chargePointId", session.getChargePoint().getId().toString());
        fields.put("chargePointCode", session.getChargePoint().getCode());
        fields.put("chargerModel", session.getChargePoint().getModel());
        fields.put("plateNumber", session.getVehicle().getPlateNumber());
        fields.put("vehicleName", session.getVehicleCatalog() == null
                ? "EV" : session.getVehicleCatalog().getVehicleName());
        fields.put("vehicleType", session.getVehicleCatalog() == null
                ? "EV" : session.getVehicleCatalog().getVehicleName());
        fields.put("startPercent", session.getStartSoc());
        fields.put("endPercent", session.getCurrentSoc());
        fields.put("targetPercent", session.getTargetPercent());
        fields.put("energyDeliveredKwh", session.getEnergyDeliveredKwh());
        fields.put("kWh", session.getEnergyDeliveredKwh());
        fields.put("unitsCharged", session.getEnergyDeliveredKwh());
        fields.put("paymentMethod", session.getPaymentMethod().name());
        fields.put("amountPaid", session.getAmount());

        TransactionRequest request = new TransactionRequest();
        request.setBusinessCode(BusinessUnit.CODE_EV);
        request.setTransactionType(Transaction.TransactionType.SALE.name());
        request.setTransactionDate(LocalDate.now(ZoneId.of("Asia/Kathmandu")));
        request.setAmount(session.getAmount());
        request.setNotes(session.getNotes());
        request.setReferenceNumber("EV-" + session.getId().toString().substring(0, 8).toUpperCase(Locale.ROOT));
        request.setCustomFields(fields);
        String transactionId = transactionService.create(request, session.getPaidBy()).getId();
        session.setTransaction(transactionRepository.getReferenceById(UUID.fromString(transactionId)));
    }

    private ChargeSession findForEvent(String chargePointCode, String transactionId) {
        if (transactionId != null && !transactionId.isBlank()) {
            Optional<ChargeSession> existing = chargeSessionRepository.findByOcppTransactionId(transactionId);
            if (existing.isPresent()) return existing.get();
        }
        return chargeSessionRepository.findFirstByChargePointCodeAndStatusInOrderByRequestedAtDesc(
                chargePointCode, OPEN_STATUSES).orElse(null);
    }

    /**
     * An OCPP command plus what to do to the session if it cannot be sent.
     * Commands must never leave the server before the state change that caused them is
     * committed: a fast charger can answer within milliseconds, and its reply (or its next
     * TransactionEvent) would otherwise be handled against the stale, pre-commit session.
     */
    private record Dispatch(Runnable send, BiConsumer<ChargeSession, String> onFailure) {}

    private ChargeSessionResponse publish(ChargeSession session) {
        return publish(session, null);
    }

    /**
     * Builds the response now (inside the transaction) but emits the live event and sends the
     * command only after commit — event first, so a reply can never overtake the state it
     * refers to on the kiosk.
     */
    private ChargeSessionResponse publish(ChargeSession session, Dispatch dispatch) {
        ChargeSessionResponse response = ChargeSessionResponse.from(session);
        UUID sessionId = session.getId();
        AfterCommit.run(() -> {
            liveEvents.publish("CHARGE_SESSION_UPDATED", response);
            if (dispatch != null) runDispatch(sessionId, dispatch);
        });
        return response;
    }

    /** Sends the command; if the charger vanished in the meantime, records that on the session. */
    private void runDispatch(UUID sessionId, Dispatch dispatch) {
        try {
            dispatch.send().run();
        } catch (RuntimeException ex) {
            log.warn("Command for charge session {} could not be sent: {}", sessionId, ex.getMessage());
            transactionTemplate.executeWithoutResult(status -> chargeSessionRepository.findById(sessionId)
                    .ifPresent(session -> {
                        dispatch.onFailure().accept(session, ex.getMessage());
                        publish(chargeSessionRepository.save(session));
                    }));
        }
    }

    private Dispatch requestStopDispatch(ChargeSession session, ChargeSession.Status revertTo, String label) {
        String code = session.getChargePoint().getCode();
        UUID sessionId = session.getId();
        String transactionId = session.getOcppTransactionId();
        return new Dispatch(
                () -> ocppCommands.requestStop(code, sessionId, transactionId),
                (failed, reason) -> {
                    failed.setStatus(revertTo);
                    failed.setStatusMessage("Could not send the " + label + " command: " + reason);
                });
    }

    private Dispatch unlockDispatch(ChargeSession session) {
        String code = session.getChargePoint().getCode();
        UUID sessionId = session.getId();
        int connectorId = session.getConnectorId();
        return new Dispatch(
                () -> ocppCommands.unlockConnector(code, sessionId, connectorId),
                (failed, reason) -> {
                    failed.setStatus(ChargeSession.Status.PAID);
                    failed.setStatusMessage("Could not send the unlock command; retry required: " + reason);
                });
    }

    /** Fail fast (409) instead of after commit when the charger is plainly offline. */
    private void requireConnected(ChargeSession session) {
        String code = session.getChargePoint().getCode();
        if (!ocppCommands.isConnected(code)) {
            throw new EvSessionStateException("Charger " + code + " is offline");
        }
    }

    private ChargeSession find(UUID id) {
        return chargeSessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Charge session not found: " + id));
    }

    private void requireStatus(ChargeSession session, ChargeSession.Status expected) {
        if (session.getStatus() != expected) {
            throw new EvSessionStateException(
                    "Session must be " + expected + " but is " + session.getStatus());
        }
    }

    private void requireOcppTransaction(ChargeSession session) {
        if (session.getOcppTransactionId() == null || session.getOcppTransactionId().isBlank()) {
            throw new EvSessionStateException("The charger has not supplied a transaction ID yet");
        }
    }

    private UUID parseUuid(String value, String label) {
        try {
            return UUID.fromString(value);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid " + label + " ID");
        }
    }

    private String normalizePlate(String plateNumber) {
        String normalized = plateNumber == null ? "" : plateNumber.toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]", "");
        if (normalized.length() < 2 || normalized.length() > 32) {
            throw new IllegalArgumentException("Plate number must contain 2 to 32 letters or digits");
        }
        return normalized;
    }

    private String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private LocalDateTime parseTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) return LocalDateTime.now();
        try {
            return OffsetDateTime.parse(timestamp).atZoneSameInstant(ZoneId.of("Asia/Kathmandu")).toLocalDateTime();
        } catch (Exception ex) {
            return LocalDateTime.now();
        }
    }

    private BigDecimal decimal(String value) {
        try {
            return value == null ? null : new BigDecimal(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}

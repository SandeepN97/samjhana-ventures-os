package com.samjhana.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.ChargeSessionResponse;
import com.samjhana.dto.MarkChargeSessionPaidRequest;
import com.samjhana.dto.StartChargeSessionRequest;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.ChargeSession;
import com.samjhana.entity.EvCustomerVehicle;
import com.samjhana.entity.EvVehicle;
import com.samjhana.entity.User;
import com.samjhana.exception.EvSessionStateException;
import com.samjhana.exception.ResourceNotFoundException;
import com.samjhana.ocpp.OcppCommandService;
import com.samjhana.ocpp.OcppConnectionRegistry;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.repository.ChargeSessionRepository;
import com.samjhana.repository.EvCustomerVehicleRepository;
import com.samjhana.repository.EvVehicleRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.websocket.EvLiveWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChargeSessionServiceTest {

    private static final String CODE = "HD-D180-CC-01";

    @Mock ChargeSessionRepository chargeSessionRepository;
    @Mock ChargePointRepository chargePointRepository;
    @Mock EvCustomerVehicleRepository customerVehicleRepository;
    @Mock EvVehicleRepository evVehicleRepository;
    @Mock PlatePhotoStorageService photoStorageService;
    @Mock OcppCommandService ocppCommands;
    @Mock TransactionService transactionService;
    @Mock TransactionRepository transactionRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock EvLiveWebSocketHandler liveEvents;
    @Mock PlatformTransactionManager transactionManager;

    ChargeSessionService service;
    ObjectMapper mapper = new ObjectMapper();
    ChargePoint chargePoint;
    User staff;

    @BeforeEach
    void setUp() {
        service = new ChargeSessionService(chargeSessionRepository, chargePointRepository,
                customerVehicleRepository, evVehicleRepository, photoStorageService, ocppCommands,
                transactionService, transactionRepository, auditLogRepository, liveEvents,
                new TransactionTemplate(transactionManager));

        chargePoint = ChargePoint.builder().id(UUID.randomUUID()).code(CODE).model("HD-D180-CC")
                .maxPowerKw(new BigDecimal("80")).displayOrder(1).build();
        staff = User.builder().id(UUID.randomUUID()).username("staff").role(User.UserRole.ADMIN).build();

        when(chargePointRepository.findById(chargePoint.getId())).thenReturn(Optional.of(chargePoint));
        when(ocppCommands.isConnected(CODE)).thenReturn(true);
        when(customerVehicleRepository.findByPlateNumberAndDeletedAtIsNull(anyString())).thenReturn(Optional.empty());
        when(customerVehicleRepository.save(any(EvCustomerVehicle.class))).thenAnswer(inv -> inv.getArgument(0));
        when(chargeSessionRepository.save(any(ChargeSession.class))).thenAnswer(inv -> {
            ChargeSession saved = inv.getArgument(0);
            if (saved.getId() == null) saved.setId(UUID.randomUUID());
            return saved;
        });
        when(transactionService.create(any(TransactionRequest.class), any(User.class)))
                .thenReturn(TransactionResponse.builder().id(UUID.randomUUID().toString()).build());
    }

    // ------------------------------------------------------------------ helpers

    private ChargeSession session(ChargeSession.Status status) {
        ChargeSession session = ChargeSession.builder()
                .id(UUID.randomUUID())
                .chargePoint(chargePoint)
                .vehicle(EvCustomerVehicle.builder().id(UUID.randomUUID()).plateNumber("BA1PA4521").build())
                .connectorId(1).targetPercent(80).startSoc(30).currentSoc(30)
                .energyDeliveredKwh(BigDecimal.ZERO)
                .ratePerPercent(new BigDecimal("14"))
                .status(status).ocppTransactionId("TX-1")
                .requestedAt(LocalDateTime.now())
                .build();
        when(chargeSessionRepository.findById(session.getId())).thenReturn(Optional.of(session));
        when(chargeSessionRepository.findByOcppTransactionId("TX-1")).thenReturn(Optional.of(session));
        return session;
    }

    private StartChargeSessionRequest startRequest(String plate, int target) {
        StartChargeSessionRequest request = new StartChargeSessionRequest();
        request.setChargePointId(chargePoint.getId().toString());
        request.setPlateNumber(plate);
        request.setTargetPercent(target);
        return request;
    }

    private MarkChargeSessionPaidRequest paid(ChargeSession.PaymentMethod method, String amount) {
        MarkChargeSessionPaidRequest request = new MarkChargeSessionPaidRequest();
        request.setMethod(method);
        request.setAmount(new BigDecimal(amount));
        return request;
    }

    private JsonNode event(String type, int seq, Integer soc, Long energyWh) throws Exception {
        StringBuilder values = new StringBuilder();
        if (soc != null) values.append("{\"measurand\":\"SoC\",\"value\":").append(soc).append("}");
        if (energyWh != null) {
            if (values.length() > 0) values.append(",");
            values.append("{\"measurand\":\"Energy.Active.Import.Register\",\"value\":").append(energyWh).append("}");
        }
        return mapper.readTree("{\"eventType\":\"" + type + "\",\"seqNo\":" + seq
                + ",\"timestamp\":\"2026-09-19T10:00:00+05:45\",\"transactionInfo\":{\"transactionId\":\"TX-1\"},"
                + "\"meterValue\":[{\"sampledValue\":[" + values + "]}]}");
    }

    // ------------------------------------------------------------------ start

    private EvVehicle vehicleType(String name, String ratePerPercent) {
        EvVehicle vehicle = EvVehicle.builder().id(UUID.randomUUID()).vehicleName(name)
                .batteryCapacityKw(new BigDecimal("53.58")).seatingCapacity(14)
                .ratePerPercent(new BigDecimal(ratePerPercent)).isActive(true).build();
        when(evVehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));
        return vehicle;
    }

    @Test
    void shouldSnapshotTheVehiclePriceAndSendStartCommand_whenChargerIsOnlineAndFree() {
        EvVehicle dfac = vehicleType("DFAC EV 32", "14");
        StartChargeSessionRequest request = startRequest("ba 1 pa-4521", 80);
        request.setVehicleCatalogId(dfac.getId().toString());

        ChargeSessionResponse response = service.start(request, staff);

        assertEquals("STARTING", response.getStatus());
        assertEquals(0, new BigDecimal("14").compareTo(response.getRatePerPercent()));
        assertEquals("DFAC EV 32", response.getVehicleCatalogName());
        assertEquals("BA1PA4521", response.getPlateNumber());
        verify(ocppCommands).requestStart(eq(CODE), any(UUID.class), eq(1), eq("BA1PA4521"));
        verify(liveEvents).publish(eq("CHARGE_SESSION_UPDATED"), any());
    }

    @Test
    void shouldStartWithoutAPrice_whenNoVehicleTypeIsChosen() {
        ChargeSessionResponse response = service.start(startRequest("BA 1 PA 4521", 80), staff);

        assertNull(response.getRatePerPercent());
        assertNull(response.getSuggestedAmount()); // staff will type the amount at payment
    }

    @Test
    void shouldRejectAnInactiveVehicleType() {
        EvVehicle inactive = vehicleType("Retired", "10");
        inactive.setIsActive(false);
        StartChargeSessionRequest request = startRequest("BA 1 PA 4521", 80);
        request.setVehicleCatalogId(inactive.getId().toString());

        assertThrows(ResourceNotFoundException.class, () -> service.start(request, staff));
        verify(ocppCommands, never()).requestStart(anyString(), any(), anyInt(), anyString());
    }

    @Test
    void shouldRejectAnUnknownVehicleType() {
        StartChargeSessionRequest request = startRequest("BA 1 PA 4521", 80);
        request.setVehicleCatalogId(UUID.randomUUID().toString());
        when(evVehicleRepository.findById(any(UUID.class))).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.start(request, staff));
    }

    @Test
    void shouldThrowConflict_whenChargerIsOffline() {
        when(ocppCommands.isConnected(CODE)).thenReturn(false);

        EvSessionStateException error = assertThrows(EvSessionStateException.class,
                () -> service.start(startRequest("BA 1 PA 4521", 80), staff));

        assertEquals("Charger " + CODE + " is offline", error.getMessage());
        verify(ocppCommands, never()).requestStart(anyString(), any(), anyInt(), anyString());
    }

    @Test
    void shouldThrowConflict_whenChargerAlreadyHasAnOpenSession() {
        when(chargeSessionRepository.existsByChargePointIdAndStatusIn(eq(chargePoint.getId()), any())).thenReturn(true);

        assertThrows(EvSessionStateException.class, () -> service.start(startRequest("BA 1 PA 4521", 80), staff));
        verify(chargeSessionRepository, never()).save(any(ChargeSession.class));
    }

    @Test
    void shouldThrowNotFound_whenChargerIsInactive() {
        chargePoint.setIsActive(false);

        assertThrows(ResourceNotFoundException.class, () -> service.start(startRequest("BA 1 PA 4521", 80), staff));
    }

    @Test
    void shouldRejectPlate_whenItHasFewerThanTwoLettersOrDigits() {
        assertThrows(IllegalArgumentException.class, () -> service.start(startRequest("!", 80), staff));
        assertThrows(IllegalArgumentException.class, () -> service.start(startRequest("   ", 80), staff));
    }

    @Test
    void shouldRejectTarget_whenNotAboveStartingPercent() {
        StartChargeSessionRequest request = startRequest("BA 1 PA 4521", 50);
        request.setInitialSoc(50);

        assertThrows(IllegalArgumentException.class, () -> service.start(request, staff));
    }

    // ------------------------------------------------------------------ stop

    @Test
    void shouldRequestStopButKeepConnectorLocked_whenExplicitUnlock() {
        ChargeSession session = session(ChargeSession.Status.ACTIVE);

        ChargeSessionResponse response = service.stop(session.getId());

        assertEquals("STOP_REQUESTED", response.getStatus());
        verify(ocppCommands).requestStop(CODE, session.getId(), "TX-1");
        verify(ocppCommands, never()).unlockConnector(anyString(), any(), anyInt());
    }

    @Test
    void shouldNotStopPower_whenChargerUnlocksAutomaticallyOnStop() {
        chargePoint.setLockBehavior(ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP);
        ChargeSession session = session(ChargeSession.Status.ACTIVE);

        ChargeSessionResponse response = service.stop(session.getId());

        assertEquals("AWAITING_PAYMENT", response.getStatus());
        verify(ocppCommands, never()).requestStop(anyString(), any(), anyString());
    }

    @Test
    void shouldRefuseStop_whenSessionIsNotActive() {
        ChargeSession session = session(ChargeSession.Status.STARTING);

        assertThrows(EvSessionStateException.class, () -> service.stop(session.getId()));
        verify(ocppCommands, never()).requestStop(anyString(), any(), anyString());
    }

    @Test
    void shouldRefuseStop_whenChargerHasNotSuppliedATransactionId() {
        ChargeSession session = session(ChargeSession.Status.ACTIVE);
        session.setOcppTransactionId(null);

        assertThrows(EvSessionStateException.class, () -> service.stop(session.getId()));
    }

    @Test
    void shouldThrowNotFound_whenStoppingUnknownSession() {
        UUID unknown = UUID.randomUUID();
        when(chargeSessionRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.stop(unknown));
    }

    // ------------------------------------------------------------------ mark paid

    @Test
    void shouldSendUnlockAndBookSale_whenPaidOnExplicitUnlockCharger() {
        ChargeSession session = session(ChargeSession.Status.AWAITING_PAYMENT);
        session.setEnergyDeliveredKwh(new BigDecimal("7.500"));

        ChargeSessionResponse response = service.markPaid(session.getId(), paid(ChargeSession.PaymentMethod.CASH, "600"), staff);

        assertEquals("UNLOCK_REQUESTED", response.getStatus());
        assertEquals("CASH", response.getPaymentMethod());
        assertEquals(0, new BigDecimal("600").compareTo(response.getAmount()));
        verify(ocppCommands).unlockConnector(CODE, session.getId(), 1);
        ArgumentCaptor<TransactionRequest> booked = ArgumentCaptor.forClass(TransactionRequest.class);
        verify(transactionService).create(booked.capture(), eq(staff));
        assertEquals("ev", booked.getValue().getBusinessCode());
        assertEquals(0, new BigDecimal("600").compareTo(booked.getValue().getAmount()));
        assertEquals("OCPP_SESSION", booked.getValue().getCustomFields().get("chargingMode"));
        assertEquals("CASH", booked.getValue().getCustomFields().get("paymentMethod"));
    }

    @Test
    void shouldStopChargeInsteadOfUnlocking_whenPaidOnAutoUnlockCharger() {
        chargePoint.setLockBehavior(ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP);
        ChargeSession session = session(ChargeSession.Status.AWAITING_PAYMENT);

        ChargeSessionResponse response = service.markPaid(session.getId(), paid(ChargeSession.PaymentMethod.ESEWA, "250"), staff);

        assertEquals("STOP_REQUESTED", response.getStatus());
        verify(ocppCommands).requestStop(CODE, session.getId(), "TX-1");
        verify(ocppCommands, never()).unlockConnector(anyString(), any(), anyInt());
    }

    @Test
    void shouldRefusePayment_whenSessionIsNotAwaitingPayment() {
        ChargeSession session = session(ChargeSession.Status.ACTIVE);

        assertThrows(EvSessionStateException.class,
                () -> service.markPaid(session.getId(), paid(ChargeSession.PaymentMethod.CASH, "100"), staff));
        verify(ocppCommands, never()).unlockConnector(anyString(), any(), anyInt());
        verify(transactionService, never()).create(any(), any());
    }

    // ------------------------------------------------------------------ retry unlock

    @Test
    void shouldResendUnlock_whenSessionIsPaidAndConnectorStillLocked() {
        ChargeSession session = session(ChargeSession.Status.PAID);
        session.setPaidAt(LocalDateTime.now());

        ChargeSessionResponse response = service.retryUnlock(session.getId());

        assertEquals("UNLOCK_REQUESTED", response.getStatus());
        verify(ocppCommands).unlockConnector(CODE, session.getId(), 1);
    }

    @Test
    void shouldRefuseUnlock_whenSessionIsNotPaid() {
        ChargeSession session = session(ChargeSession.Status.AWAITING_PAYMENT);

        assertThrows(EvSessionStateException.class, () -> service.retryUnlock(session.getId()));
        verify(ocppCommands, never()).unlockConnector(anyString(), any(), anyInt());
    }

    // ------------------------------------------------------------------ TransactionEvent

    @Test
    void shouldMoveToActive_whenChargerReportsStarted() throws Exception {
        ChargeSession session = session(ChargeSession.Status.STARTING);

        service.handleTransactionEvent(CODE, event("Started", 0, 32, 1_000_000L));

        assertEquals(ChargeSession.Status.ACTIVE, session.getStatus());
        assertNotNull(session.getStartedAt());
        assertEquals(32, session.getCurrentSoc());
    }

    @Test
    void shouldComputeDeliveredKwhFromMeterDelta_whenUpdatedEventsArrive() throws Exception {
        ChargeSession session = session(ChargeSession.Status.STARTING);
        service.handleTransactionEvent(CODE, event("Started", 0, 32, 1_000_000L));

        service.handleTransactionEvent(CODE, event("Updated", 1, 50, 1_006_250L));

        assertEquals(50, session.getCurrentSoc());
        assertEquals(0, new BigDecimal("6.250").compareTo(session.getEnergyDeliveredKwh()));
    }

    @Test
    void shouldIgnoreReplayedEvent_whenSequenceNumberIsNotNewer() throws Exception {
        ChargeSession session = session(ChargeSession.Status.STARTING);
        service.handleTransactionEvent(CODE, event("Started", 0, 32, 0L));
        service.handleTransactionEvent(CODE, event("Updated", 1, 50, 5_000L));

        service.handleTransactionEvent(CODE, event("Updated", 1, 99, 99_000L));

        assertEquals(50, session.getCurrentSoc());
    }

    @Test
    void shouldIgnoreEvent_whenNoMatchingSessionExists() throws Exception {
        when(chargeSessionRepository.findByOcppTransactionId("TX-1")).thenReturn(Optional.empty());
        when(chargeSessionRepository.findFirstByChargePointCodeAndStatusInOrderByRequestedAtDesc(eq(CODE), any()))
                .thenReturn(Optional.empty());

        service.handleTransactionEvent(CODE, event("Started", 0, 32, 0L));

        verify(chargeSessionRepository, never()).save(any(ChargeSession.class));
    }

    @Test
    void shouldAwaitPayment_whenChargingEndsBeforePayment() throws Exception {
        ChargeSession session = session(ChargeSession.Status.STOP_REQUESTED);

        service.handleTransactionEvent(CODE, event("Ended", 5, 60, 7_500L));

        assertEquals(ChargeSession.Status.AWAITING_PAYMENT, session.getStatus());
        assertNotNull(session.getStoppedAt());
        verify(ocppCommands, never()).unlockConnector(anyString(), any(), anyInt());
    }

    @Test
    void shouldCloseSession_whenChargingEndsAfterPayment() throws Exception {
        ChargeSession session = session(ChargeSession.Status.STOP_REQUESTED);
        session.setPaidAt(LocalDateTime.now());
        session.setPaymentMethod(ChargeSession.PaymentMethod.CASH);
        session.setAmount(new BigDecimal("600"));
        session.setPaidBy(staff);

        service.handleTransactionEvent(CODE, event("Ended", 5, 60, 7_500L));

        assertEquals(ChargeSession.Status.CLOSED, session.getStatus());
        assertNotNull(session.getClosedAt());
        verify(transactionService).create(any(TransactionRequest.class), eq(staff));
    }

    @Test
    void shouldStopAutomatically_whenTargetPercentIsReached() throws Exception {
        ChargeSession session = session(ChargeSession.Status.STARTING);
        session.setTargetPercent(60);
        service.handleTransactionEvent(CODE, event("Started", 0, 32, 0L));

        service.handleTransactionEvent(CODE, event("Updated", 1, 61, 5_000L));

        assertEquals(ChargeSession.Status.STOP_REQUESTED, session.getStatus());
        verify(ocppCommands).requestStop(CODE, session.getId(), "TX-1");
    }

    @Test
    void shouldWaitForPayment_whenTargetReachedOnAutoUnlockCharger() throws Exception {
        chargePoint.setLockBehavior(ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP);
        ChargeSession session = session(ChargeSession.Status.STARTING);
        session.setTargetPercent(60);
        service.handleTransactionEvent(CODE, event("Started", 0, 32, 0L));

        service.handleTransactionEvent(CODE, event("Updated", 1, 61, 5_000L));

        assertEquals(ChargeSession.Status.AWAITING_PAYMENT, session.getStatus());
        verify(ocppCommands, never()).requestStop(anyString(), any(), anyString());
    }

    // ------------------------------------------------------------------ command results

    private OcppConnectionRegistry.PendingCommand pending(String action, ChargeSession session) {
        return new OcppConnectionRegistry.PendingCommand("m-1", action, session.getId(), LocalDateTime.now());
    }

    @Test
    void shouldFailSession_whenChargerRejectsStart() throws Exception {
        ChargeSession session = session(ChargeSession.Status.STARTING);

        service.handleCommandResult(pending("RequestStartTransaction", session), mapper.readTree("{\"status\":\"Rejected\"}"), null);

        assertEquals(ChargeSession.Status.FAILED, session.getStatus());
    }

    @Test
    void shouldCloseSession_whenChargerConfirmsUnlock() throws Exception {
        ChargeSession session = session(ChargeSession.Status.UNLOCK_REQUESTED);

        service.handleCommandResult(pending("UnlockConnector", session), mapper.readTree("{\"status\":\"Unlocked\"}"), null);

        assertEquals(ChargeSession.Status.CLOSED, session.getStatus());
        assertNotNull(session.getClosedAt());
    }

    @Test
    void shouldStayPaidForRetry_whenUnlockFails() throws Exception {
        ChargeSession session = session(ChargeSession.Status.UNLOCK_REQUESTED);

        service.handleCommandResult(pending("UnlockConnector", session), mapper.readTree("{\"status\":\"UnlockFailed\"}"), null);

        assertEquals(ChargeSession.Status.PAID, session.getStatus());
    }

    @Test
    void shouldReturnToActive_whenChargerRejectsStopBeforePayment() throws Exception {
        ChargeSession session = session(ChargeSession.Status.STOP_REQUESTED);

        service.handleCommandResult(pending("RequestStopTransaction", session), null, "NotSupported");

        assertEquals(ChargeSession.Status.ACTIVE, session.getStatus());
    }

    @Test
    void shouldIgnoreResult_whenSessionNoLongerExists() throws Exception {
        UUID gone = UUID.randomUUID();
        when(chargeSessionRepository.findById(gone)).thenReturn(Optional.empty());

        service.handleCommandResult(new OcppConnectionRegistry.PendingCommand("m", "UnlockConnector", gone, LocalDateTime.now()),
                mapper.readTree("{\"status\":\"Unlocked\"}"), null);

        verify(chargeSessionRepository, never()).save(any(ChargeSession.class));
    }

    // ------------------------------------------------------------------ commit ordering

    @Test
    void shouldPublishTheEventBeforeSendingTheCommand() {
        ChargeSession session = session(ChargeSession.Status.AWAITING_PAYMENT);

        service.markPaid(session.getId(), paid(ChargeSession.PaymentMethod.CASH, "600"), staff);

        // A fast charger can answer within milliseconds; the kiosk must already have the state
        // the reply refers to.
        InOrder order = inOrder(liveEvents, ocppCommands);
        order.verify(liveEvents).publish(eq("CHARGE_SESSION_UPDATED"), any());
        order.verify(ocppCommands).unlockConnector(CODE, session.getId(), 1);
    }

    @Test
    void shouldNotSendCommandsOrEventsUntilTheTransactionCommits() {
        ChargeSession session = session(ChargeSession.Status.AWAITING_PAYMENT);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.markPaid(session.getId(), paid(ChargeSession.PaymentMethod.CASH, "600"), staff);

            // Still inside the (uncommitted) transaction: nothing may have left the server.
            verify(ocppCommands, never()).unlockConnector(anyString(), any(), anyInt());
            verify(liveEvents, never()).publish(anyString(), any());

            for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
                synchronization.afterCommit();
            }

            verify(liveEvents).publish(eq("CHARGE_SESSION_UPDATED"), any());
            verify(ocppCommands).unlockConnector(CODE, session.getId(), 1);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void shouldSendNothing_whenTheTransactionRollsBack() {
        ChargeSession session = session(ChargeSession.Status.AWAITING_PAYMENT);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.markPaid(session.getId(), paid(ChargeSession.PaymentMethod.CASH, "600"), staff);
            // No afterCommit() call: the transaction rolled back.
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(ocppCommands, never()).unlockConnector(anyString(), any(), anyInt());
        verify(liveEvents, never()).publish(anyString(), any());
    }

    // ------------------------------------------------------------------ send failures after commit

    @Test
    void shouldFailTheSession_whenTheStartCommandCannotBeSent() {
        doThrow(new EvSessionStateException("Charger " + CODE + " is offline"))
                .when(ocppCommands).requestStart(anyString(), any(), anyInt(), anyString());
        ArgumentCaptor<ChargeSession> saved = ArgumentCaptor.forClass(ChargeSession.class);
        ChargeSession[] stored = new ChargeSession[1];
        when(chargeSessionRepository.findById(any(UUID.class))).thenAnswer(inv -> Optional.ofNullable(stored[0]));
        when(chargeSessionRepository.save(any(ChargeSession.class))).thenAnswer(inv -> {
            ChargeSession value = inv.getArgument(0);
            if (value.getId() == null) value.setId(UUID.randomUUID());
            stored[0] = value;
            return value;
        });

        service.start(startRequest("BA 1 PA 4521", 80), staff);

        assertEquals(ChargeSession.Status.FAILED, stored[0].getStatus());
        assertTrue(stored[0].getStatusMessage().startsWith("Could not send the start command"));
    }

    @Test
    void shouldLeaveThePaymentUsableForRetry_whenTheUnlockCommandCannotBeSent() {
        ChargeSession session = session(ChargeSession.Status.AWAITING_PAYMENT);
        doThrow(new EvSessionStateException("Charger " + CODE + " is offline"))
                .when(ocppCommands).unlockConnector(anyString(), any(), anyInt());

        service.markPaid(session.getId(), paid(ChargeSession.PaymentMethod.CASH, "600"), staff);

        assertEquals(ChargeSession.Status.PAID, session.getStatus());
        assertTrue(session.getStatusMessage().contains("retry required"));
        assertNotNull(session.getPaidAt()); // the money is still recorded
    }

    @Test
    void shouldReturnToActive_whenTheStopCommandCannotBeSent() {
        ChargeSession session = session(ChargeSession.Status.ACTIVE);
        doThrow(new EvSessionStateException("Charger " + CODE + " is offline"))
                .when(ocppCommands).requestStop(anyString(), any(), anyString());

        service.stop(session.getId());

        assertEquals(ChargeSession.Status.ACTIVE, session.getStatus());
        assertTrue(session.getStatusMessage().startsWith("Could not send the stop command"));
    }

    // ------------------------------------------------------------------ offline charger is refused up front

    @Test
    void shouldRefuseStop_whenChargerIsOffline() {
        ChargeSession session = session(ChargeSession.Status.ACTIVE);
        when(ocppCommands.isConnected(CODE)).thenReturn(false);

        assertThrows(EvSessionStateException.class, () -> service.stop(session.getId()));

        assertEquals(ChargeSession.Status.ACTIVE, session.getStatus());
        verify(ocppCommands, never()).requestStop(anyString(), any(), anyString());
    }

    @Test
    void shouldRefusePayment_whenChargerIsOffline() {
        ChargeSession session = session(ChargeSession.Status.AWAITING_PAYMENT);
        when(ocppCommands.isConnected(CODE)).thenReturn(false);

        assertThrows(EvSessionStateException.class,
                () -> service.markPaid(session.getId(), paid(ChargeSession.PaymentMethod.CASH, "600"), staff));

        assertEquals(ChargeSession.Status.AWAITING_PAYMENT, session.getStatus());
        assertFalse(session.getPaidAt() != null);
        verify(transactionService, never()).create(any(), any());
    }

    @Test
    void shouldRefuseUnlockRetry_whenChargerIsOffline() {
        ChargeSession session = session(ChargeSession.Status.PAID);
        session.setPaidAt(LocalDateTime.now());
        when(ocppCommands.isConnected(CODE)).thenReturn(false);

        assertThrows(EvSessionStateException.class, () -> service.retryUnlock(session.getId()));

        verify(ocppCommands, never()).unlockConnector(anyString(), any(), anyInt());
    }
}

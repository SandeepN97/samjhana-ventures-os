package com.samjhana.service;

import com.samjhana.dto.ChargePointResponse;
import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.User;
import com.samjhana.exception.ResourceNotFoundException;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.websocket.EvLiveWebSocketHandler;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChargePointServiceTest {

    @Mock ChargePointRepository chargePointRepository;
    @Mock EvLiveWebSocketHandler liveEvents;
    @Mock PasswordEncoder passwordEncoder;
    @Mock AuditLogRepository auditLogRepository;
    @InjectMocks ChargePointService chargePointService;

    private ChargePoint chargePoint(String code, String model, String kw, int order) {
        return ChargePoint.builder()
                .id(UUID.randomUUID())
                .code(code)
                .model(model)
                .maxPowerKw(new BigDecimal(kw))
                .displayOrder(order)
                .isActive(true)
                .build();
    }

    @Test
    void shouldReturnActiveChargePointsInRepositoryOrder_whenChargersExist() {
        ChargePoint first = chargePoint("HD-D180-CC-01", "HD-D180-CC", "80", 1);
        ChargePoint second = chargePoint("HD-D140-E-01", "HD-D140-E", "40", 3);
        when(chargePointRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc())
                .thenReturn(List.of(first, second));

        List<ChargePointResponse> result = chargePointService.getActiveChargePoints();

        assertEquals(2, result.size());
        assertEquals(first.getId().toString(), result.get(0).getId());
        assertEquals("HD-D180-CC-01", result.get(0).getCode());
        assertEquals("HD-D180-CC", result.get(0).getModel());
        assertEquals(0, new BigDecimal("80").compareTo(result.get(0).getMaxPowerKw()));
        assertEquals(1, result.get(0).getDisplayOrder());
        assertEquals("HD-D140-E-01", result.get(1).getCode());
        verify(chargePointRepository).findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc();
    }

    @Test
    void shouldReturnEmptyList_whenNoActiveChargersExist() {
        when(chargePointRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc())
                .thenReturn(List.of());

        List<ChargePointResponse> result = chargePointService.getActiveChargePoints();

        assertTrue(result.isEmpty());
    }

    @Test
    void shouldPropagateException_whenRepositoryFails() {
        when(chargePointRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc())
                .thenThrow(new IllegalStateException("db down"));

        assertThrows(IllegalStateException.class, () -> chargePointService.getActiveChargePoints());
    }

    // ------------------------------------------------------------------ connection lifecycle (OCPP)

    private ChargePoint offlineCharger() {
        ChargePoint point = ChargePoint.builder().id(UUID.randomUUID()).code("HD-D180-CC-01").model("HD-D180-CC")
                .maxPowerKw(new BigDecimal("80")).displayOrder(1).build();
        when(chargePointRepository.findByCodeAndDeletedAtIsNull("HD-D180-CC-01")).thenReturn(Optional.of(point));
        when(chargePointRepository.save(any(ChargePoint.class))).thenAnswer(inv -> inv.getArgument(0));
        return point;
    }

    @Test
    void shouldMarkOnlineAndPublish_whenChargerConnects() {
        ChargePoint point = offlineCharger();

        chargePointService.markConnected("HD-D180-CC-01");

        assertEquals(ChargePoint.ConnectionStatus.ONLINE, point.getConnectionStatus());
        assertNotNull(point.getLastConnectedAt());
        assertNotNull(point.getLastHeartbeatAt());
        verify(liveEvents).publish(eq("CHARGE_POINT_UPDATED"), any(ChargePointResponse.class));
    }

    @Test
    void shouldMarkOfflineAndPublish_whenChargerDisconnects() {
        ChargePoint point = offlineCharger();
        point.setConnectionStatus(ChargePoint.ConnectionStatus.ONLINE);

        chargePointService.markDisconnected("HD-D180-CC-01");

        assertEquals(ChargePoint.ConnectionStatus.OFFLINE, point.getConnectionStatus());
        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(liveEvents).publish(eq("CHARGE_POINT_UPDATED"), payload.capture());
        assertEquals("OFFLINE", ((ChargePointResponse) payload.getValue()).getConnectionStatus());
    }

    @Test
    void shouldRecordSerialNumber_whenBootNotificationCarriesOne() {
        ChargePoint point = offlineCharger();

        chargePointService.recordBoot("HD-D180-CC-01", "SN-123");

        assertEquals("SN-123", point.getSerialNumber());
        assertEquals(ChargePoint.ConnectionStatus.ONLINE, point.getConnectionStatus());
    }

    @Test
    void shouldKeepExistingSerial_whenBootNotificationHasNoneOrBlank() {
        ChargePoint point = offlineCharger();
        point.setSerialNumber("SN-OLD");

        chargePointService.recordBoot("HD-D180-CC-01", "  ");
        chargePointService.recordBoot("HD-D180-CC-01", null);

        assertEquals("SN-OLD", point.getSerialNumber());
    }

    @Test
    void shouldRecordConnectorStatusAndHeartbeat_whenStatusNotificationArrives() {
        ChargePoint point = offlineCharger();

        chargePointService.recordStatus("HD-D180-CC-01", "Occupied");

        assertEquals("Occupied", point.getConnectorStatus());
        assertNotNull(point.getLastHeartbeatAt());
    }

    @Test
    void shouldRefreshHeartbeatAndStayOnline_whenHeartbeatArrives() {
        ChargePoint point = offlineCharger();

        chargePointService.recordHeartbeat("HD-D180-CC-01");

        assertEquals(ChargePoint.ConnectionStatus.ONLINE, point.getConnectionStatus());
        assertNotNull(point.getLastHeartbeatAt());
    }

    @Test
    void shouldThrowNotFound_whenAnUnknownChargerConnects() {
        when(chargePointRepository.findByCodeAndDeletedAtIsNull("GHOST-01")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> chargePointService.markConnected("GHOST-01"));
        verify(liveEvents, never()).publish(anyString(), any());
    }

    @Test
    void shouldPublishOnlyAfterCommit_whenChargerStatusChanges() {
        ChargePoint point = offlineCharger();
        TransactionSynchronizationManager.initSynchronization();
        try {
            chargePointService.markDisconnected("HD-D180-CC-01");

            verify(liveEvents, never()).publish(anyString(), any());
            TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
            verify(liveEvents).publish(eq("CHARGE_POINT_UPDATED"), any(ChargePointResponse.class));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
        assertEquals(ChargePoint.ConnectionStatus.OFFLINE, point.getConnectionStatus());
    }

    // ------------------------------------------------------------------ admin: secret rotation + lock behavior

    /** A charger with no repository stubbing, for tests that look it up by id. */
    private ChargePoint plainCharger() {
        return ChargePoint.builder().id(UUID.randomUUID()).code("HD-D180-CC-01").model("HD-D180-CC")
                .maxPowerKw(new BigDecimal("80")).displayOrder(1).build();
    }

    private User admin() {
        return User.builder().id(UUID.randomUUID()).username("admin").role(User.UserRole.ADMIN).build();
    }

    @Test
    void shouldReturnNewSecretOnceAndStoreOnlyItsHash_whenRotating() {
        ChargePoint point = plainCharger();
        when(chargePointRepository.findById(point.getId())).thenReturn(Optional.of(point));
        when(passwordEncoder.encode(anyString())).thenAnswer(inv -> "hash(" + inv.getArgument(0) + ")");

        String secret = chargePointService.rotateSecret(point.getId(), admin());

        assertEquals(43, secret.length()); // 32 random bytes, URL-safe Base64 without padding
        assertFalse(secret.contains("="));
        assertEquals("hash(" + secret + ")", point.getOcppAuthSecretHash());
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    void shouldGenerateADifferentSecretEachTime_whenRotatingTwice() {
        ChargePoint point = plainCharger();
        when(chargePointRepository.findById(point.getId())).thenReturn(Optional.of(point));
        when(passwordEncoder.encode(anyString())).thenAnswer(inv -> inv.getArgument(0));

        assertNotEquals(chargePointService.rotateSecret(point.getId(), admin()),
                chargePointService.rotateSecret(point.getId(), admin()));
    }

    @Test
    void shouldRefuseToRotate_whenChargerIsDeletedOrUnknown() {
        ChargePoint deleted = plainCharger();
        deleted.setDeletedAt(java.time.LocalDateTime.now());
        when(chargePointRepository.findById(deleted.getId())).thenReturn(Optional.of(deleted));
        UUID unknown = UUID.randomUUID();
        when(chargePointRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> chargePointService.rotateSecret(deleted.getId(), admin()));
        assertThrows(ResourceNotFoundException.class, () -> chargePointService.rotateSecret(unknown, admin()));
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void shouldUpdateLockBehaviorAuditAndPublish_whenChanged() {
        ChargePoint point = plainCharger();
        when(chargePointRepository.findById(point.getId())).thenReturn(Optional.of(point));
        when(chargePointRepository.save(any(ChargePoint.class))).thenAnswer(inv -> inv.getArgument(0));

        ChargePointResponse response = chargePointService.updateLockBehavior(
                point.getId(), ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP, admin());

        assertEquals("AUTO_UNLOCK_ON_STOP", response.getLockBehavior());
        assertEquals(ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP, point.getLockBehavior());
        verify(auditLogRepository).save(any(AuditLog.class));
        verify(liveEvents).publish(eq("CHARGE_POINT_UPDATED"), any(ChargePointResponse.class));
    }

    @Test
    void shouldThrowNotFound_whenChangingLockBehaviorOfUnknownCharger() {
        UUID unknown = UUID.randomUUID();
        when(chargePointRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> chargePointService.updateLockBehavior(
                unknown, ChargePoint.LockBehavior.EXPLICIT_UNLOCK, admin()));
        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }
}

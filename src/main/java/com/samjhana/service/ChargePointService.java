package com.samjhana.service;

import com.samjhana.dto.ChargePointResponse;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.entity.ChargePoint;
import com.samjhana.exception.ResourceNotFoundException;
import com.samjhana.websocket.EvLiveWebSocketHandler;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.time.LocalDateTime;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChargePointService {

    private final ChargePointRepository chargePointRepository;
    private final EvLiveWebSocketHandler liveEvents;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogRepository auditLogRepository;

    /** Active, non-deleted chargers in display order (Charger 1, 2, 3). */
    public List<ChargePointResponse> getActiveChargePoints() {
        return chargePointRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc()
                .stream().map(ChargePointResponse::from).toList();
    }

    @Transactional
    public void markConnected(String code) {
        ChargePoint point = find(code);
        point.setConnectionStatus(ChargePoint.ConnectionStatus.ONLINE);
        point.setLastConnectedAt(LocalDateTime.now());
        point.setLastHeartbeatAt(LocalDateTime.now());
        publish(chargePointRepository.save(point));
    }

    @Transactional
    public void markDisconnected(String code) {
        ChargePoint point = find(code);
        point.setConnectionStatus(ChargePoint.ConnectionStatus.OFFLINE);
        publish(chargePointRepository.save(point));
    }

    @Transactional
    public void recordBoot(String code, String serialNumber) {
        ChargePoint point = find(code);
        if (serialNumber != null && !serialNumber.isBlank()) point.setSerialNumber(serialNumber);
        point.setConnectionStatus(ChargePoint.ConnectionStatus.ONLINE);
        point.setLastHeartbeatAt(LocalDateTime.now());
        publish(chargePointRepository.save(point));
    }

    @Transactional
    public void recordHeartbeat(String code) {
        ChargePoint point = find(code);
        point.setConnectionStatus(ChargePoint.ConnectionStatus.ONLINE);
        point.setLastHeartbeatAt(LocalDateTime.now());
        publish(chargePointRepository.save(point));
    }

    @Transactional
    public void recordStatus(String code, String connectorStatus) {
        ChargePoint point = find(code);
        point.setConnectorStatus(connectorStatus);
        point.setLastHeartbeatAt(LocalDateTime.now());
        publish(chargePointRepository.save(point));
    }

    private ChargePoint find(String code) {
        return chargePointRepository.findByCodeAndDeletedAtIsNull(code)
                .orElseThrow(() -> new ResourceNotFoundException("Charge point not found: " + code));
    }

    /** Builds the payload now, emits it only after the change is committed (see AfterCommit). */
    private void publish(ChargePoint point) {
        ChargePointResponse response = ChargePointResponse.from(point);
        AfterCommit.run(() -> liveEvents.publish("CHARGE_POINT_UPDATED", response));
    }

    @Transactional
    public String rotateSecret(UUID id, User user) {
        ChargePoint point = chargePointRepository.findById(id)
                .filter(item -> item.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Charge point not found: " + id));
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String secret = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        point.setOcppAuthSecretHash(passwordEncoder.encode(secret));
        chargePointRepository.save(point);
        auditLogRepository.save(AuditLog.updateEvent(user, AuditLog.EntityType.CHARGE_POINT,
                point.getId(), null, "{\"ocppSecretRotated\":true}"));
        return secret;
    }

    @Transactional
    public ChargePointResponse updateLockBehavior(UUID id, ChargePoint.LockBehavior behavior, User user) {
        ChargePoint point = chargePointRepository.findById(id)
                .filter(item -> item.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Charge point not found: " + id));
        ChargePoint.LockBehavior old = point.getLockBehavior();
        point.setLockBehavior(behavior);
        point = chargePointRepository.save(point);
        auditLogRepository.save(AuditLog.updateEvent(user, AuditLog.EntityType.CHARGE_POINT,
                point.getId(), "{\"lockBehavior\":\"" + old + "\"}",
                "{\"lockBehavior\":\"" + behavior + "\"}"));
        publish(point);
        return ChargePointResponse.from(point);
    }
}

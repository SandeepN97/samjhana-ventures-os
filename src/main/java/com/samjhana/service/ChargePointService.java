package com.samjhana.service;

import com.samjhana.dto.ChargePointResponse;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.entity.ChargePoint;
import com.samjhana.exception.ResourceNotFoundException;
import com.samjhana.ocpp.OcppConnectionRegistry;
import com.samjhana.websocket.EvLiveWebSocketHandler;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.User;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;

import java.util.List;
import java.time.LocalDateTime;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChargePointService {

    private static final Logger LIFECYCLE = LoggerFactory.getLogger("com.samjhana.ocpp.lifecycle");
    /** Why a charger's connection is closed when its secret is changed (1008, "policy violation"). */
    static final CloseStatus SECRET_ROTATED = CloseStatus.POLICY_VIOLATION.withReason("credentials changed");

    private final ChargePointRepository chargePointRepository;
    private final EvLiveWebSocketHandler liveEvents;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogRepository auditLogRepository;
    private final OcppConnectionRegistry connectionRegistry;

    /** Active, non-deleted chargers in display order (Charger 1, 2, 3). */
    public List<ChargePointResponse> getActiveChargePoints() {
        return chargePointRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc()
                .stream().map(ChargePointResponse::from).toList();
    }

    @Transactional
    public void markConnected(String code) {
        ChargePoint point = find(code);
        logConnection(point, ChargePoint.ConnectionStatus.ONLINE, "connected");
        point.setConnectionStatus(ChargePoint.ConnectionStatus.ONLINE);
        point.setLastConnectedAt(LocalDateTime.now());
        point.setLastHeartbeatAt(LocalDateTime.now());
        publish(chargePointRepository.save(point));
    }

    /**
     * Runs in a transaction of its own. Closing a charger's socket can happen from the after-commit step of another
     * transaction (changing its secret closes its connection), and the close is reported back on the same thread;
     * joining that already finished transaction would lose this write and leave the charger shown as ONLINE.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markDisconnected(String code) {
        ChargePoint point = find(code);
        logConnection(point, ChargePoint.ConnectionStatus.OFFLINE, "disconnected");
        point.setConnectionStatus(ChargePoint.ConnectionStatus.OFFLINE);
        publish(chargePointRepository.save(point));
    }

    @Transactional
    public void recordBoot(String code, String serialNumber) {
        ChargePoint point = find(code);
        if (serialNumber != null && !serialNumber.isBlank() && !serialNumber.equals(point.getSerialNumber())) {
            if (chargePointRepository.existsBySerialNumberAndIdNot(serialNumber, point.getId())) {
                // The serial column is unique: writing it would make the database refuse the whole boot (finding D-05). It is
                // only a label, so the boot goes on and the first charger keeps it.
                LIFECYCLE.warn("CHARGE POINT {} reported serial number {}, which another charge point already holds: "
                        + "not stored, keeping {}", code, serialNumber, point.getSerialNumber());
            } else {
                LIFECYCLE.info("CHARGE POINT {} serial_number: {} -> {}", code, point.getSerialNumber(), serialNumber);
                point.setSerialNumber(serialNumber);
            }
        }
        logConnection(point, ChargePoint.ConnectionStatus.ONLINE, "boot");
        point.setConnectionStatus(ChargePoint.ConnectionStatus.ONLINE);
        point.setLastHeartbeatAt(LocalDateTime.now());
        publish(chargePointRepository.save(point));
    }

    @Transactional
    public void recordHeartbeat(String code) {
        ChargePoint point = find(code);
        logConnection(point, ChargePoint.ConnectionStatus.ONLINE, "heartbeat");
        point.setConnectionStatus(ChargePoint.ConnectionStatus.ONLINE);
        point.setLastHeartbeatAt(LocalDateTime.now());
        publish(chargePointRepository.save(point));
    }

    @Transactional
    public void recordStatus(String code, String connectorStatus) {
        ChargePoint point = find(code);
        if (!java.util.Objects.equals(point.getConnectorStatus(), connectorStatus)) {
            LIFECYCLE.info("CHARGE POINT {} connector_status: {} -> {}", code, point.getConnectorStatus(), connectorStatus);
        }
        point.setConnectorStatus(connectorStatus);
        point.setLastHeartbeatAt(LocalDateTime.now());
        publish(chargePointRepository.save(point));
    }

    /** Logs the charge_point connection_status change old -> new (no line when nothing changes). */
    private void logConnection(ChargePoint point, ChargePoint.ConnectionStatus next, String cause) {
        if (point.getConnectionStatus() != next) {
            LIFECYCLE.info("CHARGE POINT {} connection_status: {} -> {} ({})", point.getCode(),
                    point.getConnectionStatus(), next, cause);
        }
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
        // The secret is only checked when a charger connects, so a connection that is already open (possibly one
        // made by whoever the old secret leaked to) would carry on. Close it once the new secret is saved for good;
        // the charger then has to connect again, and only the new secret gets in (finding P1a-03).
        String code = point.getCode();
        AfterCommit.run(() -> {
            if (connectionRegistry.disconnect(code, SECRET_ROTATED)) {
                LIFECYCLE.warn("CHARGE POINT {} secret rotated: its open connection was closed", code);
            }
        });
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

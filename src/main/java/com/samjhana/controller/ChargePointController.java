package com.samjhana.controller;

import com.samjhana.dto.ChargePointResponse;
import com.samjhana.service.ChargePointService;
import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpStatus;
import java.util.Map;
import java.util.UUID;

import java.util.List;

@RestController
@RequestMapping("/api/charge-points")
@RequiredArgsConstructor
public class ChargePointController {

    private final ChargePointService chargePointService;

    @GetMapping
    public ResponseEntity<List<ChargePointResponse>> getActiveChargePoints() {
        return ResponseEntity.ok(chargePointService.getActiveChargePoints());
    }

    @PostMapping("/{id}/rotate-secret")
    public ResponseEntity<?> rotateSecret(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin access required"));
        }
        return ResponseEntity.ok(Map.of(
                "chargePointId", id.toString(),
                "secret", chargePointService.rotateSecret(id, user),
                "warning", "Copy this secret now. It will not be shown again."));
    }

    @PatchMapping("/{id}/lock-behavior")
    public ResponseEntity<?> updateLockBehavior(@PathVariable UUID id,
                                                @RequestBody Map<String, String> body,
                                                @AuthenticationPrincipal User user) {
        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }
        try {
            ChargePoint.LockBehavior behavior = ChargePoint.LockBehavior.valueOf(body.get("lockBehavior"));
            return ResponseEntity.ok(chargePointService.updateLockBehavior(id, behavior, user));
        } catch (Exception ex) {
            throw new IllegalArgumentException("lockBehavior must be EXPLICIT_UNLOCK or AUTO_UNLOCK_ON_STOP");
        }
    }
}

package com.samjhana.controller;

import com.samjhana.dto.ChargeSessionResponse;
import com.samjhana.dto.MarkChargeSessionPaidRequest;
import com.samjhana.dto.StartChargeSessionRequest;
import com.samjhana.entity.EvCustomerVehicle;
import com.samjhana.entity.User;
import com.samjhana.service.ChargeSessionService;
import com.samjhana.service.PlatePhotoStorageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ev/sessions")
@RequiredArgsConstructor
public class ChargeSessionController {

    private final ChargeSessionService chargeSessionService;

    @PostMapping("/start")
    public ResponseEntity<ChargeSessionResponse> start(
            @Valid @RequestBody StartChargeSessionRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(chargeSessionService.start(request, user));
    }

    @GetMapping("/active")
    public ResponseEntity<List<ChargeSessionResponse>> active() {
        return ResponseEntity.ok(chargeSessionService.active());
    }

    @GetMapping("/recent")
    public ResponseEntity<List<ChargeSessionResponse>> recent() {
        return ResponseEntity.ok(chargeSessionService.recent());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ChargeSessionResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(chargeSessionService.get(id));
    }

    @PostMapping("/{id}/stop")
    public ResponseEntity<ChargeSessionResponse> stop(@PathVariable UUID id) {
        return ResponseEntity.ok(chargeSessionService.stop(id));
    }

    @PostMapping("/{id}/mark-paid")
    public ResponseEntity<ChargeSessionResponse> markPaid(
            @PathVariable UUID id,
            @Valid @RequestBody MarkChargeSessionPaidRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(chargeSessionService.markPaid(id, request, user));
    }

    @PostMapping("/{id}/unlock")
    public ResponseEntity<ChargeSessionResponse> retryUnlock(@PathVariable UUID id) {
        return ResponseEntity.ok(chargeSessionService.retryUnlock(id));
    }
}

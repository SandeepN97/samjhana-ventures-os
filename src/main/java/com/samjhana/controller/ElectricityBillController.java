package com.samjhana.controller;

import com.samjhana.dto.ElectricityBillRequest;
import com.samjhana.entity.User;
import com.samjhana.service.ElectricityBillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ev/electricity-bills")
@RequiredArgsConstructor
public class ElectricityBillController {

    private final ElectricityBillService electricityBillService;

    // What the station pays NEA, and the profit worked out from it, are for admins and managers
    // only, like the nea_rate setting: staff must not be able to read them through the API either.
    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal User user) {
        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }
        return ResponseEntity.ok(electricityBillService.list());
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ElectricityBillRequest request,
                                    @AuthenticationPrincipal User user) {
        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }
        return ResponseEntity.ok(electricityBillService.create(request, user));
    }

    @GetMapping("/{id}/reconciliation")
    public ResponseEntity<?> reconcile(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }
        return ResponseEntity.ok(electricityBillService.reconcile(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }
        electricityBillService.delete(id, user);
        return ResponseEntity.ok(Map.of("message", "Electricity bill archived"));
    }
}

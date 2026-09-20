package com.samjhana.controller;

import com.samjhana.dto.ElectricityBillRequest;
import com.samjhana.dto.ElectricityBillResponse;
import com.samjhana.dto.EvReconciliationResponse;
import com.samjhana.entity.User;
import com.samjhana.service.ElectricityBillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ev/electricity-bills")
@RequiredArgsConstructor
public class ElectricityBillController {

    private final ElectricityBillService electricityBillService;

    @GetMapping
    public ResponseEntity<List<ElectricityBillResponse>> list() {
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
    public ResponseEntity<EvReconciliationResponse> reconcile(@PathVariable UUID id) {
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

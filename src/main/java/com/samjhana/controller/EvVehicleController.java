package com.samjhana.controller;

import com.samjhana.dto.EvVehicleRequest;
import com.samjhana.dto.EvVehicleResponse;
import com.samjhana.entity.User;
import com.samjhana.service.EvVehicleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ev-vehicles")
@RequiredArgsConstructor
public class EvVehicleController {

    private final EvVehicleService evVehicleService;

    @GetMapping
    public ResponseEntity<List<EvVehicleResponse>> getActiveVehicles() {
        return ResponseEntity.ok(evVehicleService.getActiveVehicles());
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAllVehicles(@AuthenticationPrincipal User user) {
        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        return ResponseEntity.ok(evVehicleService.getAllVehicles());
    }

    @PostMapping
    public ResponseEntity<?> createVehicle(
            @RequestBody EvVehicleRequest request,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        EvVehicleResponse vehicle = evVehicleService.createVehicle(request, user);
        return ResponseEntity.ok(Map.of("message", "Vehicle added successfully", "vehicle", vehicle));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateVehicle(
            @PathVariable String id,
            @RequestBody EvVehicleRequest request,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        EvVehicleResponse vehicle = evVehicleService.updateVehicle(UUID.fromString(id), request, user);
        return ResponseEntity.ok(Map.of("message", "Vehicle updated successfully", "vehicle", vehicle));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteVehicle(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        evVehicleService.deleteVehicle(UUID.fromString(id), user);
        return ResponseEntity.ok(Map.of("message", "Vehicle removed successfully"));
    }
}
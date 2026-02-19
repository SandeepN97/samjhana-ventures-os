package com.samjhana.controller;

import com.samjhana.dto.EvVehicleRequest;
import com.samjhana.dto.EvVehicleResponse;
import com.samjhana.entity.EvVehicle;
import com.samjhana.entity.User;
import com.samjhana.repository.EvVehicleRepository;
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

    private final EvVehicleRepository evVehicleRepository;

    @GetMapping
    public ResponseEntity<List<EvVehicleResponse>> getActiveVehicles() {
        List<EvVehicleResponse> vehicles = evVehicleRepository.findByIsActiveTrueOrderByVehicleNameAsc()
                .stream()
                .map(EvVehicleResponse::from)
                .toList();
        return ResponseEntity.ok(vehicles);
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAllVehicles(@AuthenticationPrincipal User user) {
        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        List<EvVehicleResponse> vehicles = evVehicleRepository.findAllByOrderByVehicleNameAsc()
                .stream()
                .map(EvVehicleResponse::from)
                .toList();
        return ResponseEntity.ok(vehicles);
    }

    @PostMapping
    public ResponseEntity<?> createVehicle(
            @RequestBody EvVehicleRequest request,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        if (request.getVehicleName() == null || request.getVehicleName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Vehicle name is required"));
        }
        if (request.getRatePerPercent() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Rate per percent is required"));
        }

        EvVehicle vehicle = EvVehicle.builder()
                .vehicleName(request.getVehicleName().trim())
                .batteryCapacityKw(request.getBatteryCapacityKw())
                .seatingCapacity(request.getSeatingCapacity())
                .ratePerPercent(request.getRatePerPercent())
                .isActive(true)
                .updatedBy(user)
                .build();

        EvVehicle saved = evVehicleRepository.save(vehicle);
        return ResponseEntity.ok(Map.of(
                "message", "Vehicle added successfully",
                "vehicle", EvVehicleResponse.from(saved)
        ));
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

        EvVehicle vehicle = evVehicleRepository.findById(UUID.fromString(id)).orElse(null);
        if (vehicle == null) {
            return ResponseEntity.notFound().build();
        }

        if (request.getVehicleName() != null && !request.getVehicleName().trim().isEmpty()) {
            vehicle.setVehicleName(request.getVehicleName().trim());
        }
        if (request.getBatteryCapacityKw() != null) {
            vehicle.setBatteryCapacityKw(request.getBatteryCapacityKw());
        }
        if (request.getSeatingCapacity() != null) {
            vehicle.setSeatingCapacity(request.getSeatingCapacity());
        }
        if (request.getRatePerPercent() != null) {
            vehicle.setRatePerPercent(request.getRatePerPercent());
        }
        vehicle.setUpdatedBy(user);

        EvVehicle saved = evVehicleRepository.save(vehicle);
        return ResponseEntity.ok(Map.of(
                "message", "Vehicle updated successfully",
                "vehicle", EvVehicleResponse.from(saved)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteVehicle(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        EvVehicle vehicle = evVehicleRepository.findById(UUID.fromString(id)).orElse(null);
        if (vehicle == null) {
            return ResponseEntity.notFound().build();
        }

        vehicle.setIsActive(false);
        vehicle.setUpdatedBy(user);
        evVehicleRepository.save(vehicle);

        return ResponseEntity.ok(Map.of("message", "Vehicle removed successfully"));
    }
}

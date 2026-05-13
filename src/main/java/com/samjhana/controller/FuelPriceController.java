package com.samjhana.controller;

import com.samjhana.dto.FuelPriceRequest;
import com.samjhana.dto.FuelPriceResponse;
import com.samjhana.entity.User;
import com.samjhana.service.FuelPriceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/fuel-prices")
@RequiredArgsConstructor
public class FuelPriceController {

    private final FuelPriceService fuelPriceService;

    @GetMapping("/current")
    public ResponseEntity<Map<String, FuelPriceResponse>> getCurrentPrices() {
        return ResponseEntity.ok(fuelPriceService.getCurrentPrices());
    }

    @GetMapping("/current/{fuelType}")
    public ResponseEntity<?> getCurrentPrice(@PathVariable String fuelType) {
        return fuelPriceService.getCurrentPriceByType(fuelType)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<FuelPriceResponse>> getAllPrices() {
        return ResponseEntity.ok(fuelPriceService.getAll());
    }

    @PostMapping
    public ResponseEntity<?> setPrice(
            @RequestBody FuelPriceRequest request,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        return ResponseEntity.ok(fuelPriceService.setPrice(request, user));
    }

    @PostMapping("/bulk")
    public ResponseEntity<?> setBulkPrices(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        return ResponseEntity.ok(fuelPriceService.setBulkPrices(request, user));
    }

    @PostMapping("/fetch-noc")
    public ResponseEntity<?> fetchNocPrices(@AuthenticationPrincipal User user) {
        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        return ResponseEntity.ok(fuelPriceService.fetchNocPrices());
    }
}
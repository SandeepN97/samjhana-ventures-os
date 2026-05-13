package com.samjhana.controller;

import com.samjhana.service.PublicApiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Public read-only API consumed by samjhana-web.
 * No authentication required. Never returns profit, WAC, cost prices,
 * stock levels, staff data, or internal transaction IDs.
 */
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicController {

    private final PublicApiService publicApiService;

    @GetMapping("/fuel-prices/current")
    public ResponseEntity<?> getCurrentFuelPrices() {
        return ResponseEntity.ok(publicApiService.getCurrentFuelPrices());
    }

    @GetMapping("/furniture/catalogue")
    public ResponseEntity<?> getFurnitureCatalogue(
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(publicApiService.getFurnitureCatalogue(category));
    }

    @GetMapping("/furniture/catalogue/{id}")
    public ResponseEntity<?> getFurnitureItem(@PathVariable String id) {
        return publicApiService.getFurnitureItem(UUID.fromString(id))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/ev/rates")
    public ResponseEntity<?> getEvRates() {
        return ResponseEntity.ok(publicApiService.getEvRates());
    }
}
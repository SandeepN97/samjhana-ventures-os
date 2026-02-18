package com.samjhana.controller;

import com.samjhana.dto.FuelPriceRequest;
import com.samjhana.dto.FuelPriceResponse;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.User;
import com.samjhana.repository.FuelPriceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/fuel-prices")
@RequiredArgsConstructor
public class FuelPriceController {

    private final FuelPriceRepository fuelPriceRepository;

    /**
     * Get current prices for both fuel types
     */
    @GetMapping("/current")
    public ResponseEntity<Map<String, FuelPriceResponse>> getCurrentPrices() {
        LocalDate today = LocalDate.now();
        Map<String, FuelPriceResponse> prices = new HashMap<>();

        fuelPriceRepository.findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(FuelPrice.FuelType.PETROL, today)
                .ifPresent(fp -> prices.put("petrol", FuelPriceResponse.from(fp)));

        fuelPriceRepository.findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(FuelPrice.FuelType.DIESEL, today)
                .ifPresent(fp -> prices.put("diesel", FuelPriceResponse.from(fp)));

        return ResponseEntity.ok(prices);
    }

    /**
     * Get current price for a specific fuel type
     */
    @GetMapping("/current/{fuelType}")
    public ResponseEntity<?> getCurrentPrice(@PathVariable String fuelType) {
        LocalDate today = LocalDate.now();
        FuelPrice.FuelType type = FuelPrice.FuelType.valueOf(fuelType.toUpperCase());

        return fuelPriceRepository.findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(type, today)
                .map(fp -> ResponseEntity.ok(FuelPriceResponse.from(fp)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get all price history
     */
    @GetMapping
    public ResponseEntity<List<FuelPriceResponse>> getAllPrices() {
        List<FuelPriceResponse> prices = fuelPriceRepository.findAllByOrderByEffectiveDateDescFuelTypeAsc()
                .stream()
                .map(FuelPriceResponse::from)
                .toList();
        return ResponseEntity.ok(prices);
    }

    /**
     * Add or update price for a date (ADMIN only)
     */
    @PostMapping
    public ResponseEntity<?> setPrice(
            @RequestBody FuelPriceRequest request,
            @AuthenticationPrincipal User user) {

        // Check admin access
        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        FuelPrice.FuelType fuelType = FuelPrice.FuelType.valueOf(request.getFuelType().toUpperCase());
        LocalDate effectiveDate = request.getEffectiveDate() != null
                ? request.getEffectiveDate()
                : LocalDate.now();

        // Check if price already exists for this date and fuel type
        Optional<FuelPrice> existing = fuelPriceRepository
                .findByFuelTypeAndEffectiveDate(fuelType, effectiveDate);

        FuelPrice fuelPrice;
        if (existing.isPresent()) {
            // Update existing price
            fuelPrice = existing.get();
            fuelPrice.setPricePerLiter(request.getPricePerLiter());
            fuelPrice.setUpdatedBy(user);
        } else {
            // Create new price
            fuelPrice = FuelPrice.builder()
                    .fuelType(fuelType)
                    .pricePerLiter(request.getPricePerLiter())
                    .effectiveDate(effectiveDate)
                    .updatedBy(user)
                    .build();
        }

        FuelPrice saved = fuelPriceRepository.save(fuelPrice);
        return ResponseEntity.ok(FuelPriceResponse.from(saved));
    }

    /**
     * Set both petrol and diesel prices at once (ADMIN only)
     */
    @PostMapping("/bulk")
    public ResponseEntity<?> setBulkPrices(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal User user) {

        // Check admin access
        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        LocalDate effectiveDate = request.containsKey("effectiveDate")
                ? LocalDate.parse((String) request.get("effectiveDate"))
                : LocalDate.now();

        Map<String, FuelPriceResponse> results = new HashMap<>();

        if (request.containsKey("petrolPrice")) {
            FuelPrice petrolPrice = saveOrUpdatePrice(
                    FuelPrice.FuelType.PETROL,
                    new java.math.BigDecimal(request.get("petrolPrice").toString()),
                    effectiveDate,
                    user
            );
            results.put("petrol", FuelPriceResponse.from(petrolPrice));
        }

        if (request.containsKey("dieselPrice")) {
            FuelPrice dieselPrice = saveOrUpdatePrice(
                    FuelPrice.FuelType.DIESEL,
                    new java.math.BigDecimal(request.get("dieselPrice").toString()),
                    effectiveDate,
                    user
            );
            results.put("diesel", FuelPriceResponse.from(dieselPrice));
        }

        return ResponseEntity.ok(results);
    }

    private FuelPrice saveOrUpdatePrice(FuelPrice.FuelType fuelType, java.math.BigDecimal price,
                                         LocalDate effectiveDate, User user) {
        Optional<FuelPrice> existing = fuelPriceRepository
                .findByFuelTypeAndEffectiveDate(fuelType, effectiveDate);

        FuelPrice fuelPrice;
        if (existing.isPresent()) {
            fuelPrice = existing.get();
            fuelPrice.setPricePerLiter(price);
            fuelPrice.setUpdatedBy(user);
        } else {
            fuelPrice = FuelPrice.builder()
                    .fuelType(fuelType)
                    .pricePerLiter(price)
                    .effectiveDate(effectiveDate)
                    .updatedBy(user)
                    .build();
        }

        return fuelPriceRepository.save(fuelPrice);
    }
}

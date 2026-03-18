package com.samjhana.controller;

import com.samjhana.entity.RentalProperty;
import com.samjhana.entity.User;
import com.samjhana.repository.RentalPropertyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rental-properties")
@RequiredArgsConstructor
public class RentalPropertyController {

    private final RentalPropertyRepository rentalPropertyRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getActiveProperties() {
        List<Map<String, Object>> properties = rentalPropertyRepository
                .findByIsActiveTrueOrderByPropertyNameAsc()
                .stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(properties);
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAllProperties(@AuthenticationPrincipal User user) {
        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        List<Map<String, Object>> properties = rentalPropertyRepository
                .findAllByOrderByPropertyNameAsc()
                .stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(properties);
    }

    @PostMapping
    public ResponseEntity<?> createProperty(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        String propertyName = body.get("propertyName") != null ? body.get("propertyName").toString().trim() : null;
        if (propertyName == null || propertyName.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Property name is required"));
        }

        BigDecimal monthlyRent;
        try {
            monthlyRent = new BigDecimal(body.get("monthlyRent").toString());
            if (monthlyRent.compareTo(BigDecimal.ZERO) <= 0) throw new Exception();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Monthly rent must be greater than 0"));
        }

        LocalDate leaseStartDate = null;
        if (body.get("leaseStartDate") != null && !body.get("leaseStartDate").toString().isBlank()) {
            try { leaseStartDate = LocalDate.parse(body.get("leaseStartDate").toString()); } catch (Exception ignored) {}
        }

        RentalProperty property = RentalProperty.builder()
                .propertyName(propertyName)
                .tenantName(body.get("tenantName") != null ? body.get("tenantName").toString().trim() : null)
                .monthlyRent(monthlyRent)
                .leaseStartDate(leaseStartDate)
                .notes(body.get("notes") != null ? body.get("notes").toString() : null)
                .isActive(true)
                .updatedBy(user)
                .build();

        RentalProperty saved = rentalPropertyRepository.save(property);
        return ResponseEntity.ok(Map.of(
                "message", "Property added successfully",
                "property", toResponse(saved)
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProperty(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        RentalProperty property = rentalPropertyRepository.findById(UUID.fromString(id)).orElse(null);
        if (property == null) return ResponseEntity.notFound().build();

        if (body.get("propertyName") != null && !body.get("propertyName").toString().trim().isEmpty()) {
            property.setPropertyName(body.get("propertyName").toString().trim());
        }
        if (body.containsKey("tenantName")) {
            property.setTenantName(body.get("tenantName") != null ? body.get("tenantName").toString().trim() : null);
        }
        if (body.get("monthlyRent") != null) {
            try {
                property.setMonthlyRent(new BigDecimal(body.get("monthlyRent").toString()));
            } catch (Exception ignored) {}
        }
        if (body.containsKey("notes")) {
            property.setNotes(body.get("notes") != null ? body.get("notes").toString() : null);
        }
        if (body.containsKey("leaseStartDate")) {
            if (body.get("leaseStartDate") != null && !body.get("leaseStartDate").toString().isBlank()) {
                try { property.setLeaseStartDate(LocalDate.parse(body.get("leaseStartDate").toString())); } catch (Exception ignored) {}
            } else {
                property.setLeaseStartDate(null);
            }
        }
        property.setUpdatedBy(user);

        RentalProperty saved = rentalPropertyRepository.save(property);
        return ResponseEntity.ok(Map.of(
                "message", "Property updated successfully",
                "property", toResponse(saved)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deactivateProperty(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        RentalProperty property = rentalPropertyRepository.findById(UUID.fromString(id)).orElse(null);
        if (property == null) return ResponseEntity.notFound().build();

        property.setIsActive(false);
        property.setUpdatedBy(user);
        rentalPropertyRepository.save(property);

        return ResponseEntity.ok(Map.of("message", "Property removed successfully"));
    }

    private Map<String, Object> toResponse(RentalProperty p) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", p.getId().toString());
        map.put("propertyName", p.getPropertyName());
        map.put("tenantName", p.getTenantName());
        map.put("monthlyRent", p.getMonthlyRent());
        map.put("notes", p.getNotes());
        map.put("leaseStartDate", p.getLeaseStartDate() != null ? p.getLeaseStartDate().toString() : null);
        map.put("isActive", p.getIsActive());
        map.put("updatedByName", p.getUpdatedBy() != null ? p.getUpdatedBy().getFullName() : null);
        map.put("createdAt", p.getCreatedAt() != null ? p.getCreatedAt().toString() : null);
        return map;
    }
}

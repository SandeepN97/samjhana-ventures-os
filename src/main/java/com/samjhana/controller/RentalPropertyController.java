package com.samjhana.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.RentalProperty;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.RentalPropertyRepository;
import com.samjhana.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rental-properties")
@RequiredArgsConstructor
public class RentalPropertyController {

    private final RentalPropertyRepository rentalPropertyRepository;
    private final TransactionRepository transactionRepository;
    private final ObjectMapper objectMapper;

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

        UUID uuid;
        try { uuid = UUID.fromString(id); } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid property ID"));
        }
        RentalProperty property = rentalPropertyRepository.findById(uuid).orElse(null);
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

        UUID uuid;
        try { uuid = UUID.fromString(id); } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid property ID"));
        }
        RentalProperty property = rentalPropertyRepository.findById(uuid).orElse(null);
        if (property == null) return ResponseEntity.notFound().build();

        property.setIsActive(false);
        property.setUpdatedBy(user);
        rentalPropertyRepository.save(property);

        return ResponseEntity.ok(Map.of("message", "Property removed successfully"));
    }

    @GetMapping("/{id}/ledger")
    public ResponseEntity<?> getPropertyLedger(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {

        UUID uuid;
        try { uuid = UUID.fromString(id); } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid property ID"));
        }

        RentalProperty property = rentalPropertyRepository.findById(uuid).orElse(null);
        if (property == null) return ResponseEntity.notFound().build();

        // Fetch all rental transactions, filter by propertyId in customFields
        List<Transaction> allRental = transactionRepository.findByBusinessCodeOrderByTransactionDateDesc("rental");

        List<Map<String, Object>> payments = allRental.stream()
                .filter(t -> {
                    try {
                        if (t.getCustomFields() == null) return false;
                        Map<String, Object> cf = objectMapper.readValue(t.getCustomFields(), new TypeReference<>() {});
                        return id.equals(String.valueOf(cf.get("propertyId")));
                    } catch (Exception e) { return false; }
                })
                // Sort ascending for running balance calculation
                .sorted(Comparator.comparing(Transaction::getTransactionDate)
                        .thenComparing(Transaction::getCreatedAt))
                .map(t -> {
                    try {
                        Map<String, Object> cf = objectMapper.readValue(t.getCustomFields(), new TypeReference<>() {});
                        Map<String, Object> entry = new LinkedHashMap<>();
                        entry.put("id", t.getId().toString());
                        entry.put("transactionDate", t.getTransactionDate().toString());
                        entry.put("rentalMonth", cf.get("rentalMonth"));
                        entry.put("monthlyRent", cf.get("monthlyRent"));
                        entry.put("amountReceived", cf.get("amountReceived"));
                        entry.put("balance", cf.get("balance")); // negative = underpaid, positive = overpaid
                        entry.put("paymentType", cf.get("paymentType"));
                        entry.put("paymentMethod", cf.get("paymentMethod"));
                        entry.put("recordedBy", cf.get("recordedBy"));
                        entry.put("notes", t.getNotes());
                        return entry;
                    } catch (Exception e) { return null; }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        // Running balance: sum of all individual balances (negative = owed by tenant)
        BigDecimal outstandingBalance = payments.stream()
                .map(p -> {
                    try { return new BigDecimal(String.valueOf(p.get("balance"))); }
                    catch (Exception e) { return BigDecimal.ZERO; }
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        // Add running balance to each payment entry
        BigDecimal running = BigDecimal.ZERO;
        for (Map<String, Object> p : payments) {
            try {
                BigDecimal bal = new BigDecimal(String.valueOf(p.get("balance")));
                running = running.add(bal).setScale(2, RoundingMode.HALF_UP);
            } catch (Exception ignored) {}
            p.put("runningBalance", running);
        }

        // Reverse for display (most recent first)
        Collections.reverse(payments);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("propertyId", id);
        result.put("propertyName", property.getPropertyName());
        result.put("tenantName", property.getTenantName());
        result.put("monthlyRent", property.getMonthlyRent());
        result.put("outstandingBalance", outstandingBalance); // negative = tenant owes, positive = tenant overpaid
        result.put("totalPayments", payments.size());
        result.put("payments", payments);

        return ResponseEntity.ok(result);
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

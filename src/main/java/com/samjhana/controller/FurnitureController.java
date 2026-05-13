package com.samjhana.controller;

import com.samjhana.service.FurnitureService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/furniture")
@RequiredArgsConstructor
public class FurnitureController {

    private final FurnitureService furnitureService;

    // ===================== DASHBOARD =====================

    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard() {
        return ResponseEntity.ok(furnitureService.getDashboard());
    }

    // ===================== CUSTOMERS =====================

    @GetMapping("/customers")
    public ResponseEntity<?> listCustomers(@RequestParam(required = false) String search) {
        return ResponseEntity.ok(furnitureService.listCustomers(search));
    }

    @PostMapping("/customers")
    public ResponseEntity<?> createCustomer(@RequestBody Map<String, String> request) {
        Map<String, Object> customer = furnitureService.createCustomer(request);
        return ResponseEntity.ok(Map.of("message", "Customer added", "customer", customer));
    }

    @PutMapping("/customers/{id}")
    public ResponseEntity<?> updateCustomer(@PathVariable String id, @RequestBody Map<String, String> request) {
        Map<String, Object> customer = furnitureService.updateCustomer(UUID.fromString(id), request);
        return ResponseEntity.ok(Map.of("message", "Customer updated", "customer", customer));
    }

    @DeleteMapping("/customers/{id}")
    public ResponseEntity<?> deleteCustomer(@PathVariable String id) {
        furnitureService.deleteCustomer(UUID.fromString(id));
        return ResponseEntity.ok(Map.of("message", "Customer removed"));
    }

    // ===================== INVENTORY =====================

    @GetMapping("/items")
    public ResponseEntity<?> listItems(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(furnitureService.listItems(category, search));
    }

    @GetMapping("/items/{id}")
    public ResponseEntity<?> getItem(@PathVariable String id) {
        return ResponseEntity.ok(furnitureService.getItem(UUID.fromString(id)));
    }

    @PostMapping("/items")
    public ResponseEntity<?> createItem(@RequestBody Map<String, Object> request) {
        Map<String, Object> item = furnitureService.createItem(request);
        return ResponseEntity.ok(Map.of("message", "Item added", "item", item));
    }

    @PutMapping("/items/{id}")
    public ResponseEntity<?> updateItem(@PathVariable String id, @RequestBody Map<String, Object> request) {
        Map<String, Object> item = furnitureService.updateItem(UUID.fromString(id), request);
        return ResponseEntity.ok(Map.of("message", "Item updated", "item", item));
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<?> deleteItem(@PathVariable String id) {
        furnitureService.deleteItem(UUID.fromString(id));
        return ResponseEntity.ok(Map.of("message", "Item removed"));
    }

    @PatchMapping("/items/{id}/stock")
    public ResponseEntity<?> adjustStock(@PathVariable String id, @RequestBody Map<String, Object> request) {
        int adjustment = request.get("adjustment") instanceof Number
                ? ((Number) request.get("adjustment")).intValue() : 0;
        Map<String, Object> item = furnitureService.adjustStock(UUID.fromString(id), adjustment);
        return ResponseEntity.ok(Map.of("message", "Stock updated", "item", item));
    }

    // ===================== ORDERS =====================

    @GetMapping("/orders")
    public ResponseEntity<?> listOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(furnitureService.listOrders(status, search));
    }

    @PatchMapping("/orders/{id}/delivery-status")
    public ResponseEntity<?> updateDeliveryStatus(@PathVariable String id, @RequestBody Map<String, String> request) {
        Map<String, Object> order = furnitureService.updateDeliveryStatus(UUID.fromString(id), request.get("deliveryStatus"));
        return ResponseEntity.ok(Map.of("message", "Delivery status updated", "order", order));
    }
}
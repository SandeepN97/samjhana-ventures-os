package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.service.ShopOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Online orders. The public website places and looks up orders; staff see them all, move them along, and
 * keep private notes. Cancelling needs a manager or admin (checked in the service).
 */
@RestController
@RequiredArgsConstructor
public class ShopOrderController {

    private final ShopOrderService orderService;

    // ---- public -------------------------------------------------------------------------------------

    @PostMapping("/api/public/shop/orders")
    public ResponseEntity<?> place(@RequestBody ShopOrderService.PlaceOrderRequest request) {
        return ResponseEntity.status(201).body(orderService.place(request));
    }

    @GetMapping("/api/public/shop/orders/{orderNumber}")
    public ResponseEntity<?> track(@PathVariable String orderNumber, @RequestParam(required = false) String phone) {
        return orderService.track(orderNumber, phone)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                // The same answer for a wrong number and a wrong phone, so order numbers can't be guessed.
                .orElse(ResponseEntity.status(404).body(Map.of("code", "NOT_FOUND",
                        "message", "We couldn't find an order with that number and phone number.")));
    }

    // ---- staff --------------------------------------------------------------------------------------

    @GetMapping("/api/shop-orders")
    public ResponseEntity<?> list(@RequestParam(required = false) String status, @RequestParam(required = false) String search) {
        return ResponseEntity.ok(orderService.list(status, search));
    }

    @GetMapping("/api/shop-orders/summary")
    public ResponseEntity<?> summary() {
        return ResponseEntity.ok(orderService.summary());
    }

    @GetMapping("/api/shop-orders/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        return ResponseEntity.ok(orderService.get(UUID.fromString(id)));
    }

    @PatchMapping("/api/shop-orders/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body,
                                          @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("message", "Order updated",
                "order", orderService.updateStatus(UUID.fromString(id), body.get("status"), body.get("reason"), user)));
    }

    @PatchMapping("/api/shop-orders/{id}/notes")
    public ResponseEntity<?> updateNotes(@PathVariable String id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(Map.of("message", "Notes saved", "order", orderService.updateNotes(UUID.fromString(id), body.get("notes"))));
    }
}

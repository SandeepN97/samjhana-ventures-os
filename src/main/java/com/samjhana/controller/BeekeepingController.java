package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.service.BeekeepingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Beekeeping shop. Who may do what:
 * <ul>
 *   <li>Everyone signed in: browse products (without cost prices) and sales, see the dashboard.
 *       Sales themselves are recorded through {@code /api/transactions}, which also moves the stock.</li>
 *   <li>Admins and managers: see cost prices; adjust stock by hand.</li>
 *   <li>Admins only: add, edit or remove products (this is where prices are set).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/beekeeping")
@RequiredArgsConstructor
public class BeekeepingController {

    private final BeekeepingService beekeepingService;

    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(beekeepingService.getDashboard(user.canManage()));
    }

    @GetMapping("/items")
    public ResponseEntity<?> listItems(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(beekeepingService.listItems(category, search, user.canManage()));
    }

    @GetMapping("/items/{id}")
    public ResponseEntity<?> getItem(@PathVariable String id, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(beekeepingService.getItem(UUID.fromString(id), user.canManage()));
    }

    @PostMapping("/items")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createItem(@RequestBody Map<String, Object> request, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("message", "Product added", "item", beekeepingService.createItem(request, user)));
    }

    @PutMapping("/items/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateItem(@PathVariable String id, @RequestBody Map<String, Object> request,
                                        @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("message", "Product updated",
                "item", beekeepingService.updateItem(UUID.fromString(id), request, user)));
    }

    @DeleteMapping("/items/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteItem(@PathVariable String id, @AuthenticationPrincipal User user) {
        beekeepingService.deleteItem(UUID.fromString(id), user);
        return ResponseEntity.ok(Map.of("message", "Product removed"));
    }

    @PatchMapping("/items/{id}/stock")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> adjustStock(@PathVariable String id, @RequestBody Map<String, Object> request,
                                         @AuthenticationPrincipal User user) {
        if (!(request.get("adjustment") instanceof Number)) {
            throw new IllegalArgumentException("adjustment must be a number");
        }
        int adjustment = ((Number) request.get("adjustment")).intValue();
        return ResponseEntity.ok(Map.of("message", "Stock updated",
                "item", beekeepingService.adjustStock(UUID.fromString(id), adjustment, user)));
    }

    @GetMapping("/orders")
    public ResponseEntity<?> listOrders(@RequestParam(required = false) String search) {
        return ResponseEntity.ok(beekeepingService.listOrders(search));
    }
}

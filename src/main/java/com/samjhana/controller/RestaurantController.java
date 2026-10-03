package com.samjhana.controller;

import com.samjhana.service.RestaurantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Restaurant menu. The public website reads {@code /api/public/restaurant}; staff manage dishes here:
 * admins add, edit and remove; admins and managers can switch a dish on or off for today.
 */
@RestController
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService restaurantService;

    @GetMapping("/api/public/restaurant")
    public ResponseEntity<?> publicMenu() {
        return ResponseEntity.ok(Map.of("dishes", restaurantService.listForPublic()));
    }

    @GetMapping("/api/restaurant/dishes")
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(restaurantService.listForAdmin());
    }

    @PostMapping("/api/restaurant/dishes")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(Map.of("message", "Dish added", "dish", restaurantService.create(request)));
    }

    @PutMapping("/api/restaurant/dishes/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(Map.of("message", "Dish updated", "dish", restaurantService.update(UUID.fromString(id), request)));
    }

    @PatchMapping("/api/restaurant/dishes/{id}/available")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> setAvailable(@PathVariable String id, @RequestBody Map<String, Object> request) {
        boolean available = !Boolean.FALSE.equals(request.get("available"));
        return ResponseEntity.ok(Map.of("message", "Dish updated", "dish", restaurantService.setAvailable(UUID.fromString(id), available)));
    }

    @DeleteMapping("/api/restaurant/dishes/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable String id) {
        restaurantService.delete(UUID.fromString(id));
        return ResponseEntity.ok(Map.of("message", "Dish removed"));
    }
}

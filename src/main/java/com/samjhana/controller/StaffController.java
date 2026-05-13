package com.samjhana.controller;

import com.samjhana.dto.StaffRequest;
import com.samjhana.dto.StaffResponse;
import com.samjhana.entity.User;
import com.samjhana.service.StaffService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService staffService;

    @GetMapping
    public ResponseEntity<?> getAllStaff(
            @RequestParam(required = false) String businessUnit,
            @AuthenticationPrincipal User currentUser) {

        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        return ResponseEntity.ok(staffService.getAll(businessUnit));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getStaffById(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser) {

        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        return ResponseEntity.ok(staffService.getById(UUID.fromString(id)));
    }

    @PostMapping
    public ResponseEntity<?> createStaff(
            @RequestBody StaffRequest request,
            @AuthenticationPrincipal User currentUser) {

        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        StaffResponse staff = staffService.create(request);
        return ResponseEntity.ok(Map.of("message", "Staff added successfully", "staff", staff));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateStaff(
            @PathVariable String id,
            @RequestBody StaffRequest request,
            @AuthenticationPrincipal User currentUser) {

        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        StaffResponse staff = staffService.update(UUID.fromString(id), request);
        return ResponseEntity.ok(Map.of("message", "Staff updated successfully", "staff", staff));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStaff(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser) {

        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        staffService.delete(UUID.fromString(id));
        return ResponseEntity.ok(Map.of("message", "Staff removed successfully"));
    }
}
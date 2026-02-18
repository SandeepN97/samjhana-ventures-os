package com.samjhana.controller;

import com.samjhana.dto.StaffRequest;
import com.samjhana.dto.StaffResponse;
import com.samjhana.entity.Staff;
import com.samjhana.entity.User;
import com.samjhana.repository.StaffRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffRepository staffRepository;

    @GetMapping
    public ResponseEntity<?> getAllStaff(
            @RequestParam(required = false) String businessUnit,
            @AuthenticationPrincipal User currentUser) {

        // Check admin access
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        List<Staff> staffList;
        if (businessUnit != null && !businessUnit.isEmpty()) {
            try {
                Staff.BusinessUnit unit = Staff.BusinessUnit.valueOf(businessUnit.toUpperCase());
                staffList = staffRepository.findByBusinessUnitAndIsActiveTrueOrderByFullNameAsc(unit);
            } catch (IllegalArgumentException e) {
                staffList = staffRepository.findByIsActiveTrueOrderByFullNameAsc();
            }
        } else {
            staffList = staffRepository.findByIsActiveTrueOrderByFullNameAsc();
        }

        List<StaffResponse> response = staffList.stream()
                .map(StaffResponse::from)
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getStaffById(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser) {

        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        return staffRepository.findById(UUID.fromString(id))
                .map(staff -> ResponseEntity.ok(StaffResponse.from(staff)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createStaff(
            @RequestBody StaffRequest request,
            @AuthenticationPrincipal User currentUser) {

        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        // Validate required fields
        if (request.getFullName() == null || request.getFullName().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Full name is required"));
        }

        if (request.getBusinessUnit() == null || request.getBusinessUnit().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Business unit is required"));
        }

        if (request.getStaffRole() == null || request.getStaffRole().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Staff role is required"));
        }

        // Parse enums
        Staff.BusinessUnit businessUnit;
        Staff.StaffRole staffRole;
        try {
            businessUnit = Staff.BusinessUnit.valueOf(request.getBusinessUnit().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Invalid business unit"));
        }

        try {
            staffRole = Staff.StaffRole.valueOf(request.getStaffRole().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Invalid staff role"));
        }

        Staff staff = Staff.builder()
                .fullName(request.getFullName().trim())
                .fullNameNepali(request.getFullNameNepali())
                .phoneNumber(request.getPhoneNumber())
                .address(request.getAddress())
                .addressNepali(request.getAddressNepali())
                .businessUnit(businessUnit)
                .staffRole(staffRole)
                .monthlySalary(request.getMonthlySalary())
                .joinDate(request.getJoinDate())
                .emergencyContact(request.getEmergencyContact())
                .emergencyContactName(request.getEmergencyContactName())
                .citizenshipNumber(request.getCitizenshipNumber())
                .notes(request.getNotes())
                .isActive(true)
                .build();

        Staff saved = staffRepository.save(staff);

        return ResponseEntity.ok(Map.of(
                "message", "Staff added successfully",
                "staff", StaffResponse.from(saved)
        ));
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

        Staff staff = staffRepository.findById(UUID.fromString(id)).orElse(null);
        if (staff == null) {
            return ResponseEntity.notFound().build();
        }

        // Update fields
        if (request.getFullName() != null && !request.getFullName().trim().isEmpty()) {
            staff.setFullName(request.getFullName().trim());
        }
        if (request.getFullNameNepali() != null) {
            staff.setFullNameNepali(request.getFullNameNepali());
        }
        if (request.getPhoneNumber() != null) {
            staff.setPhoneNumber(request.getPhoneNumber());
        }
        if (request.getAddress() != null) {
            staff.setAddress(request.getAddress());
        }
        if (request.getAddressNepali() != null) {
            staff.setAddressNepali(request.getAddressNepali());
        }
        if (request.getBusinessUnit() != null) {
            try {
                staff.setBusinessUnit(Staff.BusinessUnit.valueOf(request.getBusinessUnit().toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }
        if (request.getStaffRole() != null) {
            try {
                staff.setStaffRole(Staff.StaffRole.valueOf(request.getStaffRole().toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }
        if (request.getMonthlySalary() != null) {
            staff.setMonthlySalary(request.getMonthlySalary());
        }
        if (request.getJoinDate() != null) {
            staff.setJoinDate(request.getJoinDate());
        }
        if (request.getEmergencyContact() != null) {
            staff.setEmergencyContact(request.getEmergencyContact());
        }
        if (request.getEmergencyContactName() != null) {
            staff.setEmergencyContactName(request.getEmergencyContactName());
        }
        if (request.getCitizenshipNumber() != null) {
            staff.setCitizenshipNumber(request.getCitizenshipNumber());
        }
        if (request.getNotes() != null) {
            staff.setNotes(request.getNotes());
        }

        Staff saved = staffRepository.save(staff);

        return ResponseEntity.ok(Map.of(
                "message", "Staff updated successfully",
                "staff", StaffResponse.from(saved)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStaff(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser) {

        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        Staff staff = staffRepository.findById(UUID.fromString(id)).orElse(null);
        if (staff == null) {
            return ResponseEntity.notFound().build();
        }

        // Soft delete
        staff.setIsActive(false);
        staffRepository.save(staff);

        return ResponseEntity.ok(Map.of("message", "Staff removed successfully"));
    }
}

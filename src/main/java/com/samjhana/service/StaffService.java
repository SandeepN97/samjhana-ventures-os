package com.samjhana.service;

import com.samjhana.dto.StaffRequest;
import com.samjhana.dto.StaffResponse;
import com.samjhana.entity.Staff;
import com.samjhana.exception.ResourceNotFoundException;
import com.samjhana.repository.StaffRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StaffService {

    private final StaffRepository staffRepository;

    public List<StaffResponse> getAll(String businessUnit) {
        if (businessUnit != null && !businessUnit.isEmpty()) {
            try {
                Staff.BusinessUnit unit = Staff.BusinessUnit.valueOf(businessUnit.toUpperCase());
                return staffRepository.findByBusinessUnitAndIsActiveTrueOrderByFullNameAsc(unit)
                        .stream().map(StaffResponse::from).toList();
            } catch (IllegalArgumentException ignored) {}
        }
        return staffRepository.findByIsActiveTrueOrderByFullNameAsc()
                .stream().map(StaffResponse::from).toList();
    }

    public StaffResponse getById(UUID id) {
        return staffRepository.findById(id)
                .map(StaffResponse::from)
                .orElseThrow(() -> new IllegalArgumentException("Staff not found: " + id));
    }

    @Transactional
    public StaffResponse create(StaffRequest request) {
        if (request.getFullName() == null || request.getFullName().trim().isEmpty()) {
            throw new IllegalArgumentException("Full name is required");
        }
        if (request.getBusinessUnit() == null || request.getBusinessUnit().trim().isEmpty()) {
            throw new IllegalArgumentException("Business unit is required");
        }
        if (request.getStaffRole() == null || request.getStaffRole().trim().isEmpty()) {
            throw new IllegalArgumentException("Staff role is required");
        }

        Staff.BusinessUnit businessUnit = Staff.BusinessUnit.valueOf(request.getBusinessUnit().toUpperCase());
        Staff.StaffRole staffRole = Staff.StaffRole.valueOf(request.getStaffRole().toUpperCase());

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

        return StaffResponse.from(staffRepository.save(staff));
    }

    @Transactional
    public StaffResponse update(UUID id, StaffRequest request) {
        Staff staff = staffRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Staff not found: " + id));

        if (request.getFullName() != null && !request.getFullName().trim().isEmpty()) {
            staff.setFullName(request.getFullName().trim());
        }
        if (request.getFullNameNepali() != null) staff.setFullNameNepali(request.getFullNameNepali());
        if (request.getPhoneNumber() != null) staff.setPhoneNumber(request.getPhoneNumber());
        if (request.getAddress() != null) staff.setAddress(request.getAddress());
        if (request.getAddressNepali() != null) staff.setAddressNepali(request.getAddressNepali());
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
        if (request.getMonthlySalary() != null) staff.setMonthlySalary(request.getMonthlySalary());
        if (request.getJoinDate() != null) staff.setJoinDate(request.getJoinDate());
        if (request.getEmergencyContact() != null) staff.setEmergencyContact(request.getEmergencyContact());
        if (request.getEmergencyContactName() != null) staff.setEmergencyContactName(request.getEmergencyContactName());
        if (request.getCitizenshipNumber() != null) staff.setCitizenshipNumber(request.getCitizenshipNumber());
        if (request.getNotes() != null) staff.setNotes(request.getNotes());

        return StaffResponse.from(staffRepository.save(staff));
    }

    @Transactional
    public void delete(UUID id) {
        Staff staff = staffRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Staff not found: " + id));
        staff.setIsActive(false);
        staffRepository.save(staff);
    }
}
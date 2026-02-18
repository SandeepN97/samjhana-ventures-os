package com.samjhana.dto;

import com.samjhana.entity.Staff;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
public class StaffResponse {
    private String id;
    private String fullName;
    private String fullNameNepali;
    private String phoneNumber;
    private String address;
    private String addressNepali;
    private String businessUnit;
    private String staffRole;
    private BigDecimal monthlySalary;
    private LocalDate joinDate;
    private String emergencyContact;
    private String emergencyContactName;
    private String citizenshipNumber;
    private String notes;
    private Boolean isActive;
    private LocalDateTime createdAt;

    public static StaffResponse from(Staff staff) {
        return StaffResponse.builder()
                .id(staff.getId().toString())
                .fullName(staff.getFullName())
                .fullNameNepali(staff.getFullNameNepali() != null ? staff.getFullNameNepali() : "")
                .phoneNumber(staff.getPhoneNumber())
                .address(staff.getAddress())
                .addressNepali(staff.getAddressNepali())
                .businessUnit(staff.getBusinessUnit().name())
                .staffRole(staff.getStaffRole().name())
                .monthlySalary(staff.getMonthlySalary())
                .joinDate(staff.getJoinDate())
                .emergencyContact(staff.getEmergencyContact())
                .emergencyContactName(staff.getEmergencyContactName())
                .citizenshipNumber(staff.getCitizenshipNumber())
                .notes(staff.getNotes())
                .isActive(staff.getIsActive())
                .createdAt(staff.getCreatedAt())
                .build();
    }
}

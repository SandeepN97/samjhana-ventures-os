package com.samjhana.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class StaffRequest {
    private String fullName;
    private String fullNameNepali;
    private String phoneNumber;
    private String address;
    private String addressNepali;
    private String businessUnit;  // PETROL, FURNITURE, EV, RENTAL, LOAN, ALL
    private String staffRole;     // MANAGER, CASHIER, PUMP_OPERATOR, etc.
    private BigDecimal monthlySalary;
    private LocalDate joinDate;
    private String emergencyContact;
    private String emergencyContactName;
    private String citizenshipNumber;
    private String notes;
}

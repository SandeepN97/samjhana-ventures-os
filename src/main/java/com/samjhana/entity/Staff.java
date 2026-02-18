package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "staff")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Staff {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(length = 100)
    private String fullNameNepali;

    @Column(length = 15)
    private String phoneNumber;

    @Column(length = 100)
    private String address;

    @Column(length = 100)
    private String addressNepali;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BusinessUnit businessUnit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StaffRole staffRole;

    @Column(precision = 12, scale = 2)
    private BigDecimal monthlySalary;

    @Column
    private LocalDate joinDate;

    @Column(length = 50)
    private String emergencyContact;

    @Column(length = 100)
    private String emergencyContactName;

    @Column(length = 20)
    private String citizenshipNumber;

    @Column(length = 500)
    private String notes;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    /**
     * Business unit where staff works
     */
    public enum BusinessUnit {
        PETROL,
        FURNITURE,
        EV,
        RENTAL,
        ALL  // Works across all businesses
    }

    /**
     * Staff role/position
     */
    public enum StaffRole {
        MANAGER,
        CASHIER,
        PUMP_OPERATOR,
        SALES_PERSON,
        DELIVERY,
        CLEANER,
        GUARD,
        HELPER,
        OTHER
    }
}

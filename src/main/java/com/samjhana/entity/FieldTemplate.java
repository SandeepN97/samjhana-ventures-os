package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * FieldTemplate Entity - Defines dynamic form fields for each business.
 * 
 * This enables the "Modular Fields" pattern where each business can have
 * custom fields without database schema changes.
 * 
 * Examples:
 * - Petrol: liters, density, fuelType, ratePerLiter
 * - EV: openingMeter, closingMeter, unitRate, neaBillRef
 * - Rental: roomNo, tenantName, lastPaidDate, monthlyRent
 * - Loan: principal, interestRate, startDate, termDays
 * - Furniture: itemName, qtyIn, qtyOut, unitPrice
 */
@Entity
@Table(name = "field_templates", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"business_id", "field_key"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private BusinessUnit business;

    @Column(nullable = false, length = 50)
    private String fieldKey;  // e.g., "liters", "density", "roomNo"

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FieldType fieldType;

    @Column(nullable = false, length = 100)
    private String labelEn;  // English label: "Liters"

    @Column(nullable = false, length = 100)
    private String labelNe;  // Nepali label: "लिटर"

    @Column(length = 200)
    private String placeholder;  // Hint text

    @Column(length = 1000)
    private String validationRules;  // JSON: {"min": 0, "max": 10000, "required": true}

    @Column(length = 500)
    private String options;  // For ENUM type: ["petrol", "diesel"] as JSON

    @Column(nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isRequired = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(length = 50)
    private String defaultValue;

    @Column(length = 20)
    private String inputMode;  // "numeric", "decimal", "text" for mobile keyboard

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    /**
     * Supported field types for the dynamic form builder
     */
    public enum FieldType {
        TEXT,           // Simple text input
        NUMBER,         // Integer number with large keypad
        DECIMAL,        // Decimal number (for rates, density)
        CURRENCY,       // Currency input with NPR formatting
        DATE,           // Date picker
        DATETIME,       // Date and time picker
        ENUM,           // Dropdown/Select from predefined options
        CAMERA,         // Camera capture button
        BOOLEAN,        // Toggle switch
        TEXTAREA,       // Multi-line text
        PHONE,          // Phone number input
        CALCULATED      // Read-only calculated field
    }
}

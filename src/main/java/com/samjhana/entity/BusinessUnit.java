package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * BusinessUnit Entity - Represents each registered business in the system.
 * 
 * This is the central registry for all businesses:
 * - Furniture Shop
 * - Shringeshwor Petrol Pump
 * - EV Charging Station
 * - House Rental
 * - Bank Loan Management
 * 
 * Each business has its own calculation strategy and field templates.
 */
@Entity
@Table(name = "business_units")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusinessUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false, length = 50)
    private String code;  // e.g., "petrol", "ev", "furniture", "rental", "loan"

    @Column(nullable = false, length = 100)
    private String name;  // Display name: "Shringeshwor Petrol Pump"

    @Column(length = 200)
    private String nameNepali;  // श्रृंगेश्वर पेट्रोल पम्प

    @Column(length = 10)
    private String icon;  // Emoji: 🛢️, ⚡, 🪑, 🏠, 🏦

    @Column(length = 100)
    private String calculationStrategy;  // Strategy class name: "PetrolStrategy"

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    /**
     * Predefined business codes for type-safe access
     */
    public static final String CODE_PETROL = "petrol";
    public static final String CODE_EV = "ev";
    public static final String CODE_FURNITURE = "furniture";
    public static final String CODE_RENTAL = "rental";
    public static final String CODE_LOAN = "loan";
}

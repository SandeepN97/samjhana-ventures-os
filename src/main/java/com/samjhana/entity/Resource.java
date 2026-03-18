package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Resource Entity - Universal entity for Employees, Products, and Assets.
 * 
 * This follows the "Universal Entity" pattern where different resource types
 * are stored in a single table with type-specific attributes in JSON.
 * 
 * Examples:
 * 
 * EMPLOYEE (Petrol Pump):
 * {
 *   "position": "pump_operator",
 *   "salary": 20000,
 *   "shift": "morning",
 *   "joinDate": "2023-01-15"
 * }
 * 
 * PRODUCT (Furniture):
 * {
 *   "category": "sofa",
 *   "material": "wood",
 *   "dimensions": "3x2x1m",
 *   "purchasePrice": 15000,
 *   "sellingPrice": 25000
 * }
 * 
 * ASSET (EV Station):
 * {
 *   "chargerType": "DC_FAST",
 *   "power": "50kW",
 *   "manufacturer": "ABB",
 *   "serialNumber": "EV-2024-001"
 * }
 */
@Entity
@Table(name = "resources", indexes = {
    @Index(name = "idx_resource_business", columnList = "business_id"),
    @Index(name = "idx_resource_type", columnList = "resource_type")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Resource {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private BusinessUnit business;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ResourceType resourceType;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 200)
    private String nameNepali;

    @Column(length = 50)
    private String code;  // SKU, Employee ID, etc.

    @Column(length = 500)
    private String description;

    /**
     * Dynamic attributes stored as JSON string
     */
    @Column(columnDefinition = "TEXT")
    private String attributes;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(length = 500)
    private String imageUrl;  // Local path or URL

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    /**
     * Resource types applicable across businesses
     */
    public enum ResourceType {
        EMPLOYEE,    // Staff members
        PRODUCT,     // Sellable items (furniture, fuel types)
        ASSET,       // Equipment, machinery
        TENANT,      // Rental tenants
        BORROWER,    // Loan borrowers
        SUPPLIER,    // Vendors/suppliers
        ROOM         // Rental rooms/properties
    }
}

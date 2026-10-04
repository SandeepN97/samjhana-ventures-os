package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "furniture_items", indexes = {
        @Index(name = "idx_furniture_item_sku", columnList = "sku", unique = true),
        @Index(name = "idx_furniture_item_category", columnList = "category"),
        @Index(name = "idx_furniture_item_active", columnList = "isActive")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FurnitureItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String nameNepali;

    @Column(unique = true, nullable = false)
    private String sku;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FurnitureCategory category;

    @Column(precision = 12, scale = 2)
    private BigDecimal purchasePrice;

    @Column(precision = 12, scale = 2)
    private BigDecimal sellingPrice;

    @Builder.Default
    @Column(nullable = false)
    private Integer stockQty = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer reorderLevel = 2;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** The id the public website uses instead of the database id. Filled in on first start for older items. */
    @Column(length = 80)
    private String slug;

    @Column(length = 80)
    private String badge;

    /** Picture ids as a JSON list, the first one is the cover. Null means never set. */
    @Column(columnDefinition = "TEXT")
    private String imageIds;

    /** Null counts as shown: items added before this switch existed stay on the website. */
    private Boolean showOnWebsite;

    @Builder.Default
    @Column(nullable = false)
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum FurnitureCategory {
        SOFA, TABLE, CHAIR, BED, CABINET, WARDROBE, SHELF, OTHER
    }
}

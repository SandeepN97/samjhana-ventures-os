package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A product the beekeeping shop sells: hives, protective gear, tools, honey, starter kits.
 *
 * <p>{@code stockQty} is the real count and is changed only through
 * {@link com.samjhana.repository.BeekeepingProductRepository#removeStock} / {@code addStock}, which are
 * single guarded updates, so two sales at once can't sell the last unit twice or push stock below zero.
 * Cost price and the exact count never leave the admin API; the public site only ever gets a status.
 *
 * <p>{@code details} holds the product-type specifics that vary (hive dimensions, what a kit includes,
 * the jar size) as JSON, so a new kind of product needs no schema change.
 */
@Entity
@Table(name = "beekeeping_products", indexes = {
        @Index(name = "idx_beekeeping_sku", columnList = "sku", unique = true),
        @Index(name = "idx_beekeeping_slug", columnList = "slug", unique = true),
        @Index(name = "idx_beekeeping_category", columnList = "category")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BeekeepingProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String nameNepali;

    @Column(nullable = false, length = 80)
    private String sku;

    /** The id the public website uses instead of the database id. */
    @Column(nullable = false, length = 80)
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BeekeepingCategory category;

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

    @Column(length = 80)
    private String badge;

    /** Type-specific details as JSON (specs, kit contents, unit, level). */
    @Column(columnDefinition = "TEXT")
    private String details;

    @Builder.Default
    @Column(nullable = false)
    private Boolean showOnWebsite = true;

    /** Soft delete: a removed product keeps its sales history. */
    private LocalDateTime deletedAt;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum BeekeepingCategory {
        HIVE, GEAR, TOOL, HONEY, KIT, OTHER
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }
}

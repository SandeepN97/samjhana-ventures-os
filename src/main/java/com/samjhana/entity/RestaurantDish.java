package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** A dish on the restaurant menu shown on the public website. The restaurant takes no online orders. */
@Entity
@Table(name = "restaurant_dishes", indexes = @Index(name = "idx_dish_sort", columnList = "sortOrder"))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RestaurantDish {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String nameNepali;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** Shown beside the dish when set; the seeded menu has no prices. */
    @Column(precision = 12, scale = 2)
    private BigDecimal price;

    @Builder.Default
    @Column(nullable = false)
    private Boolean veg = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Course course;

    /** Comma-separated BREAKFAST, LUNCH, DINNER: the meal tabs this dish appears under. */
    @Column(nullable = false, length = 60)
    private String mealPeriods;

    /** One picture id, or null. */
    private UUID imageId;

    /** Staff switch this off when the kitchen has run out for today. */
    @Builder.Default
    @Column(nullable = false)
    private Boolean available = true;

    @Builder.Default
    @Column(nullable = false)
    private Boolean showOnWebsite = true;

    @Builder.Default
    @Column(nullable = false)
    private Integer sortOrder = 0;

    private LocalDateTime deletedAt;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum Course { BREAKFAST, MAIN, SNACK, DRINK, DESSERT }
}

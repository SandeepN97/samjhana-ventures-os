package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

/** One product on an online order. Name and price are copied at the time of the order, so later price changes don't rewrite history. */
@Entity
@Table(name = "shop_order_lines")
@Getter
@Setter
@NoArgsConstructor
public class ShopOrderLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private ShopOrder order;

    /** FURNITURE or BEEKEEPING. */
    @Column(nullable = false, length = 20)
    private String productType;

    @Column(nullable = false)
    private UUID productId;

    @Column(nullable = false, length = 80)
    private String productSlug;

    @Column(nullable = false)
    private String productName;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal lineTotal;

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof ShopOrderLine other && id != null && Objects.equals(id, other.id));
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}

package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * An order placed on the public website. Stock is held back when the order is placed and given back if it is
 * cancelled; when staff complete it, the sale is recorded in the daily books like any other.
 */
@Entity
@Table(name = "shop_orders", indexes = {
        @Index(name = "idx_shop_order_number", columnList = "orderNumber", unique = true),
        @Index(name = "idx_shop_order_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
public class ShopOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 20)
    private String orderNumber;

    @Column(nullable = false, length = 100)
    private String customerName;

    @Column(nullable = false, length = 30)
    private String customerPhone;

    @Column(length = 120)
    private String customerEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Fulfilment fulfilment;

    @Column(length = 200)
    private String addressLine;

    @Column(length = 100)
    private String city;

    @Column(length = 200)
    private String landmark;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentMethod paymentMethod;

    /** What the customer wrote. */
    @Column(columnDefinition = "TEXT")
    private String customerNotes;

    /** Staff-only notes, never shown to the customer. */
    @Column(columnDefinition = "TEXT")
    private String internalNotes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.NEW;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal deliveryFee = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Column(length = 300)
    private String cancelReason;

    @Column(length = 100)
    private String statusUpdatedBy;

    private LocalDateTime completedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("productName ASC")
    private List<ShopOrderLine> lines = new ArrayList<>();

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum Fulfilment { DELIVERY, PICKUP }

    public enum PaymentMethod { CASH_ON_DELIVERY, PAY_AT_SHOP }

    public enum Status {
        NEW, CONFIRMED, READY, COMPLETED, CANCELLED;

        /** Where an order may go next. Completed and cancelled orders are final. */
        public boolean canMoveTo(Status next) {
            return switch (this) {
                case NEW -> next == CONFIRMED || next == CANCELLED;
                case CONFIRMED -> next == READY || next == COMPLETED || next == CANCELLED;
                case READY -> next == COMPLETED || next == CANCELLED;
                case COMPLETED, CANCELLED -> false;
            };
        }
    }

    public void addLine(ShopOrderLine line) {
        line.setOrder(this);
        lines.add(line);
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof ShopOrder other && id != null && Objects.equals(id, other.id));
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}

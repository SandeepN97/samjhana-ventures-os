package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;

/**
 * The photo of a bank's receipt for a loan payment. Unlike {@link MediaAsset} it is PRIVATE: it is never served
 * under {@code /api/public}, only to a signed-in admin or manager. The bytes are the re-saved JPEG (no phone
 * location or other hidden details). It is uploaded first, then attached to the payment it belongs to.
 * Removing one is a soft delete.
 */
@Entity
@Table(name = "loan_receipts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoanReceipt {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 40)
    private String contentType;

    @Column(nullable = false)
    private Long sizeBytes;

    @Column(nullable = false, length = 100)
    private String uploadedBy;

    /** The loan payment this receipt belongs to; empty until the payment is saved. */
    private UUID transactionId;

    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(nullable = false, length = 8_000_000)
    private byte[] data;

    private LocalDateTime deletedAt;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof LoanReceipt other)) return false;
        return Objects.equals(id, other.id) && Arrays.equals(data, other.data);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id) * 31 + Arrays.hashCode(data);
    }
}

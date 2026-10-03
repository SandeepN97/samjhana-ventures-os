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
 * An uploaded picture (product photo, hero image, dish photo). The bytes live in the database so they
 * survive redeploys on a host with no persistent disk, and staging and prod each keep their own.
 * The public site shows them through {@code /api/public/media/{id}}. Removing one is a soft delete.
 */
@Entity
@Table(name = "media_assets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MediaAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Worked out from the file's own bytes, never from what the browser claimed. */
    @Column(nullable = false, length = 40)
    private String contentType;

    @Column(nullable = false)
    private Long sizeBytes;

    @Column(length = 200)
    private String originalName;

    @Column(length = 100)
    private String uploadedBy;

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
        if (!(o instanceof MediaAsset other)) return false;
        return Objects.equals(id, other.id) && Arrays.equals(data, other.data);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id) * 31 + Arrays.hashCode(data);
    }
}

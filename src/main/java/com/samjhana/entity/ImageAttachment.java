package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ImageAttachment Entity - Stores references to bill/receipt photos.
 * 
 * Images are stored locally in /data/images organized by:
 * /data/images/{businessCode}/{year}/{month}/{filename}
 * 
 * Example: /data/images/petrol/2024/01/invoice-2024-01-15-001.jpg
 * 
 * This supports Dad's workflow of taking photos of invoices and receipts
 * on his mobile device in Nepal.
 */
@Entity
@Table(name = "image_attachments", indexes = {
    @Index(name = "idx_image_transaction", columnList = "transaction_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImageAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false)
    private Transaction transaction;

    @Column(nullable = false, length = 500)
    private String filePath;  // Relative path: petrol/2024/01/invoice-001.jpg

    @Column(nullable = false, length = 255)
    private String originalName;  // Original filename from upload

    @Column(nullable = false, length = 50)
    private String mimeType;  // image/jpeg, image/png

    @Column(nullable = false)
    private Long fileSize;  // Size in bytes

    @Column(length = 100)
    private String imageType;  // "invoice", "receipt", "bill", "meter_reading"

    @Column(length = 500)
    private String description;

    private LocalDateTime capturedAt;  // When the photo was taken

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime uploadedAt;

    /**
     * Get the full file path for storage
     */
    public String getFullPath(String basePath) {
        return basePath + "/" + filePath;
    }

    /**
     * Get display-friendly file size
     */
    public String getFileSizeDisplay() {
        if (fileSize < 1024) {
            return fileSize + " B";
        } else if (fileSize < 1024 * 1024) {
            return String.format("%.1f KB", fileSize / 1024.0);
        } else {
            return String.format("%.1f MB", fileSize / (1024.0 * 1024.0));
        }
    }
}

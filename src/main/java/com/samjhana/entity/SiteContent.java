package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * One block of text and picture choices for the public website (contact details, opening hours,
 * home page copy...), stored as a JSON object under a fixed key. Staff edit these in the admin app;
 * the public site shows whatever is saved here.
 */
@Entity
@Table(name = "site_content")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteContent {

    @Id
    @Column(name = "content_key", length = 60)
    private String contentKey;

    @Column(name = "content_value", nullable = false, columnDefinition = "TEXT")
    private String contentValue;

    @Column(length = 100)
    private String updatedBy;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}

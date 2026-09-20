package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/** A real vehicle identified at the charging site by its normalized plate number. */
@Entity
@Table(name = "ev_customer_vehicles", indexes = {
        @Index(name = "idx_ev_customer_vehicle_plate", columnList = "plate_number", unique = true)
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvCustomerVehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "plate_number", nullable = false, unique = true, length = 32)
    private String plateNumber;

    @Column(name = "customer_name", length = 120)
    private String customerName;

    @Column(name = "phone_number", length = 30)
    private String phoneNumber;

    @Column(name = "plate_photo_path", length = 500)
    private String platePhotoPath;

    @Column(length = 500)
    private String notes;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

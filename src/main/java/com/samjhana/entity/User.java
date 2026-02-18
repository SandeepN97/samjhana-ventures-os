package com.samjhana.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * User Entity - Represents system users (Dad and Son).
 * 
 * Role-based access:
 * - DAD: Can create transactions, view dashboards, take photos
 * - SON: Can review, approve, categorize, view analytics
 * - ADMIN: Full system access
 * 
 * Implements Spring Security's UserDetails for authentication.
 */
@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(length = 100)
    private String fullNameNepali;  // नाम नेपालीमा

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserRole role;

    @Column(length = 5)
    @Builder.Default
    private String locale = "ne";  // Default Nepali for Dad

    @Column(length = 50)
    @Builder.Default
    private String timezone = "Asia/Kathmandu";

    @Column(length = 15)
    private String phoneNumber;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column
    private LocalDateTime lastLoginAt;

    @Column(length = 45)
    private String lastLoginIp;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    /**
     * User roles with specific permissions
     */
    public enum UserRole {
        DAD,    // Primary data entry role - can create transactions
        SON,    // Review and approval role - can approve/reject
        ADMIN,  // Full access - system administration
        STAFF   // Limited access - can only sell, no price updates
    }

    // =========================================================================
    // Spring Security UserDetails Implementation
    // =========================================================================

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return isActive;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return isActive;
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    public boolean isDad() {
        return role == UserRole.DAD;
    }

    public boolean isSon() {
        return role == UserRole.SON;
    }

    public boolean isAdmin() {
        return role == UserRole.ADMIN;
    }

    public boolean canApprove() {
        return role == UserRole.SON || role == UserRole.ADMIN;
    }

    public boolean canCreateTransaction() {
        return true;  // All roles can create transactions
    }

    /**
     * Get display name based on locale
     */
    public String getDisplayName() {
        if ("ne".equals(locale) && fullNameNepali != null && !fullNameNepali.isBlank()) {
            return fullNameNepali;
        }
        return fullName;
    }
}

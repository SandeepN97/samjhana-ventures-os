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
 * User Entity.
 * 
 * Role-based access:
 * - STAFF: Data entry only (no loans, no price changes, no reports)
 * - MANAGER: Full entry + reports + approvals + price changes
 * - ADMIN: Full access including user management
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
        STAFF,    // Data entry only — no loans, no price changes, no reports
        MANAGER,  // Full entry + reports + approvals + price changes
        ADMIN     // Full access including user management
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

    public boolean isManager() {
        return role == UserRole.MANAGER;
    }

    public boolean isAdmin() {
        return role == UserRole.ADMIN;
    }

    public boolean canManage() {
        return role == UserRole.MANAGER || role == UserRole.ADMIN;
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

package com.samjhana.repository;

import com.samjhana.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);

    // Finding P1b-01: each change to an existing account writes only the columns it is about. Saving the whole
    // account object back would also write whatever else it holds - a copy read when the request started - and so
    // undo a role change, a deactivation or a password reset made in the meantime.

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.fullName = :fullName, u.updatedAt = :now where u.id = :id")
    int updateFullName(@Param("id") UUID id, @Param("fullName") String fullName, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.fullName = :fullName, u.fullNameNepali = :fullNameNepali, u.updatedAt = :now where u.id = :id")
    int updateNames(@Param("id") UUID id, @Param("fullName") String fullName,
                    @Param("fullNameNepali") String fullNameNepali, @Param("now") LocalDateTime now);

    /** The person chose their own password (or an admin changed it for them): no longer a temporary one. */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.passwordHash = :passwordHash, u.mustChangePassword = false, u.updatedAt = :now where u.id = :id")
    int updatePassword(@Param("id") UUID id, @Param("passwordHash") String passwordHash, @Param("now") LocalDateTime now);

    /** An admin set a temporary password: the person must choose their own before doing anything else. */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.passwordHash = :passwordHash, u.mustChangePassword = true, u.updatedAt = :now where u.id = :id")
    int resetPassword(@Param("id") UUID id, @Param("passwordHash") String passwordHash, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.role = :role, u.updatedAt = :now where u.id = :id")
    int updateRole(@Param("id") UUID id, @Param("role") User.UserRole role, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.isActive = false, u.updatedAt = :now where u.id = :id")
    int deactivate(@Param("id") UUID id, @Param("now") LocalDateTime now);
}

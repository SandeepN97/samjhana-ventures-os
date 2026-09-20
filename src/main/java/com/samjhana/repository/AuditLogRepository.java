package com.samjhana.repository;

import com.samjhana.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    List<AuditLog> findByEntityIdOrderByCreatedAtDesc(UUID entityId);
    List<AuditLog> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<AuditLog> findByEntityTypeOrderByCreatedAtDesc(AuditLog.EntityType entityType);
}
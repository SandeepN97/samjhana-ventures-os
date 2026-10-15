package com.samjhana.repository;

import com.samjhana.entity.OcppConnectionLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OcppConnectionLogRepository extends JpaRepository<OcppConnectionLog, Long> {
}

package com.samjhana.repository;

import com.samjhana.entity.OcppMessageLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OcppMessageLogRepository extends JpaRepository<OcppMessageLog, Long> {
}

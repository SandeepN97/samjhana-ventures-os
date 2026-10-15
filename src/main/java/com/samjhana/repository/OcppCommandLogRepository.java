package com.samjhana.repository;

import com.samjhana.entity.OcppCommandLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OcppCommandLogRepository extends JpaRepository<OcppCommandLog, Long> {
}

package com.samjhana.repository;

import com.samjhana.entity.DailyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DailyReportRepository extends JpaRepository<DailyReport, UUID> {

    Optional<DailyReport> findByReportDate(LocalDate reportDate);

    List<DailyReport> findAllByOrderByReportDateDesc();
}

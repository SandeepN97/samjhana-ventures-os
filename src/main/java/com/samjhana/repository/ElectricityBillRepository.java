package com.samjhana.repository;

import com.samjhana.entity.ElectricityBill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ElectricityBillRepository extends JpaRepository<ElectricityBill, UUID> {
    boolean existsByPeriodStartAndPeriodEndAndDeletedAtIsNull(java.time.LocalDate start, java.time.LocalDate end);
    List<ElectricityBill> findByDeletedAtIsNullOrderByPeriodEndDesc();
}

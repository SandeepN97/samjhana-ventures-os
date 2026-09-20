package com.samjhana.repository;

import com.samjhana.entity.ChargePoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChargePointRepository extends JpaRepository<ChargePoint, UUID> {

    List<ChargePoint> findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc();

    Optional<ChargePoint> findByCodeAndDeletedAtIsNull(String code);
}

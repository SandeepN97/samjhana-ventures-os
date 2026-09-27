package com.samjhana.repository;

import com.samjhana.entity.ChargePoint;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChargePointRepository extends JpaRepository<ChargePoint, UUID> {

    List<ChargePoint> findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc();

    Optional<ChargePoint> findByCodeAndDeletedAtIsNull(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT chargePoint FROM ChargePoint chargePoint WHERE chargePoint.id = :id")
    Optional<ChargePoint> findByIdForUpdate(@Param("id") UUID id);
}

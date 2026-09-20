package com.samjhana.repository;

import com.samjhana.entity.ChargeSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChargeSessionRepository extends JpaRepository<ChargeSession, UUID> {

    List<ChargeSession> findByStatusInOrderByRequestedAtAsc(Collection<ChargeSession.Status> statuses);

    boolean existsByChargePointIdAndStatusIn(UUID chargePointId, Collection<ChargeSession.Status> statuses);

    Optional<ChargeSession> findFirstByChargePointCodeAndStatusInOrderByRequestedAtDesc(
            String chargePointCode, Collection<ChargeSession.Status> statuses);

    Optional<ChargeSession> findByOcppTransactionId(String ocppTransactionId);

    List<ChargeSession> findTop50ByOrderByRequestedAtDesc();

    @Query("SELECT s FROM ChargeSession s JOIN FETCH s.chargePoint JOIN FETCH s.vehicle " +
            "WHERE s.paidAt >= :start AND s.paidAt < :end ORDER BY s.paidAt ASC")
    List<ChargeSession> findPaidInPeriod(@Param("start") LocalDateTime start,
                                         @Param("end") LocalDateTime end);
}

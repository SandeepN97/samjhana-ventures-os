package com.samjhana.repository;

import com.samjhana.entity.ChargePoint;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChargePointRepository extends JpaRepository<ChargePoint, UUID> {

    List<ChargePoint> findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc();

    Optional<ChargePoint> findByCodeAndDeletedAtIsNull(String code);

    /** Whether another charger (removed ones included: the column is unique over all rows) already holds this serial number. */
    boolean existsBySerialNumberAndIdNot(String serialNumber, UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT chargePoint FROM ChargePoint chargePoint WHERE chargePoint.id = :id")
    Optional<ChargePoint> findByIdForUpdate(@Param("id") UUID id);

    /** Codes of the chargers with this connection status, in display order (removed chargers are left out). */
    @Query("select c.code from ChargePoint c where c.connectionStatus = :status and c.deletedAt is null order by c.displayOrder")
    List<String> findCodesByConnectionStatus(@Param("status") ChargePoint.ConnectionStatus status);

    /**
     * Marks the charger OFFLINE only if the database still shows it ONLINE and it was last heard from before {@code heardBefore}
     * (or never), in one statement: a charger that reconnected at the same moment, and so has a fresh heartbeat, is not
     * overwritten (finding D-04).
     *
     * @return 1 when the charger was changed, 0 when it was left alone
     */
    default int markOfflineIfNotHeardSince(String code, LocalDateTime heardBefore) {
        return updateStatusIfNotHeardSince(code, ChargePoint.ConnectionStatus.ONLINE, ChargePoint.ConnectionStatus.OFFLINE,
                heardBefore, LocalDateTime.now());
    }

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ChargePoint c set c.connectionStatus = :next, c.updatedAt = :now where c.code = :code "
            + "and c.connectionStatus = :before and c.deletedAt is null "
            + "and (c.lastHeartbeatAt is null or c.lastHeartbeatAt < :heardBefore)")
    int updateStatusIfNotHeardSince(@Param("code") String code, @Param("before") ChargePoint.ConnectionStatus before,
                                    @Param("next") ChargePoint.ConnectionStatus next,
                                    @Param("heardBefore") LocalDateTime heardBefore, @Param("now") LocalDateTime now);
}

package com.samjhana.entity;

import com.samjhana.repository.ChargePointRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding P1a-03 (follow-up): a charger's status and heartbeat are written many times a minute, each time by loading
 * the charger and saving it back. If such a write began before an admin changed the charger's secret (or lock mode) and
 * finished after, saving the whole row would put the old secret back. Only the columns that changed are written.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ChargePointWritesOnlyWhatChangedTest {

    @Autowired ChargePointRepository chargePoints;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager entityManager;

    @Test
    void shouldNotPutBackASecretOrLockModeThatWasChangedAfterTheChargerWasLoaded() {
        ChargePoint point = chargePoints.findByCodeAndDeletedAtIsNull("HD-D180-CC-01").orElseThrow();   // read first ...
        jdbc.update("update charge_points set ocpp_auth_secret_hash = ?, lock_behavior = ? where id = ?",
                "rotated-hash", "AUTO_UNLOCK_ON_STOP", point.getId());                                 // ... changed by someone else ...

        point.setConnectionStatus(ChargePoint.ConnectionStatus.ONLINE);                               // ... then saved with a heartbeat
        point.setLastHeartbeatAt(LocalDateTime.now());
        chargePoints.saveAndFlush(point);

        assertThat(jdbc.queryForObject("select ocpp_auth_secret_hash from charge_points where id = ?", String.class, point.getId()))
                .isEqualTo("rotated-hash");
        assertThat(jdbc.queryForObject("select lock_behavior from charge_points where id = ?", String.class, point.getId()))
                .isEqualTo("AUTO_UNLOCK_ON_STOP");
        assertThat(jdbc.queryForObject("select connection_status from charge_points where id = ?", String.class, point.getId()))
                .isEqualTo("ONLINE");
        assertThat(jdbc.queryForObject("select last_heartbeat_at from charge_points where id = ?", java.sql.Timestamp.class, point.getId()))
                .isNotNull();
    }
}

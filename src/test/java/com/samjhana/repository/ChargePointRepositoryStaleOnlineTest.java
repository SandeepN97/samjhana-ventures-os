package com.samjhana.repository;

import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.ChargePoint.ConnectionStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding D-04: the statement that corrects a charger the database still shows ONLINE although it has no connection. It is one
 * guarded statement, so a charger that reconnected at the same moment is not overwritten, and it touches only the named charger.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ChargePointRepositoryStaleOnlineTest {

    private static final LocalDateTime CUTOFF = LocalDateTime.of(2026, 10, 17, 12, 0, 0);

    @Autowired ChargePointRepository chargePoints;
    @PersistenceContext EntityManager entityManager;

    private ChargePoint charger(ConnectionStatus status, LocalDateTime lastHeartbeat) {
        return chargePoints.saveAndFlush(ChargePoint.builder()
                .code("T-" + UUID.randomUUID().toString().substring(0, 8))
                .model("TEST").maxPowerKw(new BigDecimal("40")).displayOrder(90)
                .connectionStatus(status).lastHeartbeatAt(lastHeartbeat).build());
    }

    private ChargePoint reload(ChargePoint point) {
        entityManager.flush();
        entityManager.clear();
        return chargePoints.findById(point.getId()).orElseThrow();
    }

    private int correct(ChargePoint point) {
        return chargePoints.markOfflineIfNotHeardSince(point.getCode(), CUTOFF);
    }

    @Test
    void shouldMarkAnOnlineChargerOffline_whenItWasLastHeardFromBeforeTheCutoff() {
        ChargePoint point = charger(ConnectionStatus.ONLINE, CUTOFF.minusMinutes(10));

        int changed = correct(point);

        assertThat(changed).isEqualTo(1);
        assertThat(reload(point).getConnectionStatus()).isEqualTo(ConnectionStatus.OFFLINE);
    }

    @Test
    void shouldLeaveAChargerOnline_whenItWasHeardFromAfterTheCutoff() {
        ChargePoint point = charger(ConnectionStatus.ONLINE, CUTOFF.plusSeconds(1));

        assertThat(correct(point)).isZero();
        assertThat(reload(point).getConnectionStatus()).isEqualTo(ConnectionStatus.ONLINE);
    }

    @Test
    void shouldLeaveAChargerOnline_whenItWasHeardFromExactlyAtTheCutoff() {
        ChargePoint point = charger(ConnectionStatus.ONLINE, CUTOFF);

        assertThat(correct(point)).isZero();
        assertThat(reload(point).getConnectionStatus()).isEqualTo(ConnectionStatus.ONLINE);
    }

    @Test
    void shouldMarkAnOnlineChargerOffline_whenItWasNeverHeardFromAtAll() {
        ChargePoint point = charger(ConnectionStatus.ONLINE, null);

        assertThat(correct(point)).isEqualTo(1);
        assertThat(reload(point).getConnectionStatus()).isEqualTo(ConnectionStatus.OFFLINE);
    }

    @Test
    void shouldChangeNothing_whenTheChargerIsAlreadyOffline() {
        ChargePoint point = charger(ConnectionStatus.OFFLINE, CUTOFF.minusMinutes(10));

        assertThat(correct(point)).isZero();
        assertThat(reload(point).getLastHeartbeatAt()).isEqualTo(CUTOFF.minusMinutes(10));
    }

    @Test
    void shouldNotTouchARemovedCharger() {
        ChargePoint point = charger(ConnectionStatus.ONLINE, CUTOFF.minusMinutes(10));
        point.setDeletedAt(LocalDateTime.now());
        chargePoints.saveAndFlush(point);

        assertThat(correct(point)).isZero();
        assertThat(reload(point).getConnectionStatus()).isEqualTo(ConnectionStatus.ONLINE);
    }

    @Test
    void shouldTouchOnlyTheNamedCharger() {
        ChargePoint named = charger(ConnectionStatus.ONLINE, CUTOFF.minusMinutes(10));
        ChargePoint other = charger(ConnectionStatus.ONLINE, CUTOFF.minusMinutes(10));

        correct(named);

        assertThat(reload(named).getConnectionStatus()).isEqualTo(ConnectionStatus.OFFLINE);
        assertThat(reload(other).getConnectionStatus()).isEqualTo(ConnectionStatus.ONLINE);
    }

    @Test
    void shouldListTheCodesOfOnlineChargersThatAreNotRemoved() {
        ChargePoint online = charger(ConnectionStatus.ONLINE, CUTOFF);
        ChargePoint offline = charger(ConnectionStatus.OFFLINE, CUTOFF);
        ChargePoint removed = charger(ConnectionStatus.ONLINE, CUTOFF);
        removed.setDeletedAt(LocalDateTime.now());
        chargePoints.saveAndFlush(removed);

        List<String> codes = chargePoints.findCodesByConnectionStatus(ConnectionStatus.ONLINE);

        assertThat(codes).contains(online.getCode()).doesNotContain(offline.getCode(), removed.getCode());
    }
}

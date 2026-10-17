package com.samjhana.seed;

import com.samjhana.config.OcppProperties;
import com.samjhana.entity.ChargePoint;
import com.samjhana.repository.ChargePointRepository;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Finding P1B1-01 with a real password encoder: the handshake accepts a charger when the secret it sends matches the
 * stored hash, so what matters is which secrets match the hash after a restart.
 */
class ChargePointSeederPublishedDefaultTest {

    private static final String CODE = "HD-D180-CC-01";
    private static final String PUBLISHED = OcppProperties.publishedDevSecretFor(CODE);
    private static final String REAL = "q8Zt1r0vF0mJb2sW3xYk6aPn";

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final ChargePointRepository repository = mock(ChargePointRepository.class);

    private ChargePoint chargerWithStoredSecret(String storedSecret) {
        ChargePoint point = ChargePoint.builder()
                .id(UUID.randomUUID()).code(CODE).model("HD-D180-CC").maxPowerKw(new BigDecimal("80")).displayOrder(1)
                .ocppAuthSecretHash(encoder.encode(storedSecret))
                .build();
        when(repository.findByCodeAndDeletedAtIsNull(anyString())).thenReturn(Optional.empty());
        when(repository.findByCodeAndDeletedAtIsNull(CODE)).thenReturn(Optional.of(point));
        when(repository.save(any(ChargePoint.class))).thenAnswer(inv -> inv.getArgument(0));
        return point;
    }

    private void restartWithConfiguredSecret(String configured) {
        OcppProperties properties = new OcppProperties(new MockEnvironment());
        Map<String, String> secrets = new LinkedHashMap<>();
        secrets.put(CODE, configured);
        secrets.put("HQC23-80-01", "w3Zt1r0vF0mJb2sW3xYk6aPn");
        secrets.put("HD-D140-E-01", "e4Zt1r0vF0mJb2sW3xYk6aPn");
        properties.setStationSecrets(secrets);
        new ChargePointSeeder(repository, encoder, properties).run();
    }

    @Test
    void shouldStopAcceptingThePublishedSecretAndAcceptTheConfiguredOne_afterARestart() {
        ChargePoint point = chargerWithStoredSecret(PUBLISHED);

        restartWithConfiguredSecret(REAL);

        assertThat(encoder.matches(PUBLISHED, point.getOcppAuthSecretHash())).isFalse();
        assertThat(encoder.matches(REAL, point.getOcppAuthSecretHash())).isTrue();
    }

    @Test
    void shouldKeepAcceptingARotatedSecretAndNothingElse_afterARestart() {
        String rotated = "rotated-by-an-admin-32-bytes-long-xx";
        ChargePoint point = chargerWithStoredSecret(rotated);

        restartWithConfiguredSecret(REAL);

        assertThat(encoder.matches(rotated, point.getOcppAuthSecretHash())).isTrue();
        assertThat(encoder.matches(REAL, point.getOcppAuthSecretHash())).isFalse();
        assertThat(encoder.matches(PUBLISHED, point.getOcppAuthSecretHash())).isFalse();
    }

    @Test
    void shouldLeaveTheDevelopmentSecretAlone_whenItIsStillTheConfiguredOne() {
        ChargePoint point = chargerWithStoredSecret(PUBLISHED);
        String hashBefore = point.getOcppAuthSecretHash();

        restartWithConfiguredSecret(PUBLISHED);

        assertThat(point.getOcppAuthSecretHash()).isEqualTo(hashBefore);
        assertThat(encoder.matches(PUBLISHED, point.getOcppAuthSecretHash())).isTrue();
    }

    @Test
    void shouldReplaceEveryChargerWithItsOwnConfiguredSecret() {
        Map<String, String> configured = new LinkedHashMap<>();
        configured.put("HD-D180-CC-01", "a1Zt1r0vF0mJb2sW3xYk6aPn");
        configured.put("HQC23-80-01", "b2Zt1r0vF0mJb2sW3xYk6aPn");
        configured.put("HD-D140-E-01", "c3Zt1r0vF0mJb2sW3xYk6aPn");
        Map<String, ChargePoint> points = new LinkedHashMap<>();
        for (String code : configured.keySet()) {
            ChargePoint point = ChargePoint.builder()
                    .id(UUID.randomUUID()).code(code).model("m").maxPowerKw(new BigDecimal("80")).displayOrder(1)
                    .ocppAuthSecretHash(encoder.encode(OcppProperties.publishedDevSecretFor(code))).build();
            points.put(code, point);
            when(repository.findByCodeAndDeletedAtIsNull(code)).thenReturn(Optional.of(point));
        }
        when(repository.save(any(ChargePoint.class))).thenAnswer(inv -> inv.getArgument(0));
        OcppProperties properties = new OcppProperties(new MockEnvironment());
        properties.setStationSecrets(configured);

        new ChargePointSeeder(repository, encoder, properties).run();

        points.forEach((code, point) -> {
            assertThat(encoder.matches(configured.get(code), point.getOcppAuthSecretHash())).as(code + " accepts its own secret").isTrue();
            assertThat(encoder.matches(OcppProperties.publishedDevSecretFor(code), point.getOcppAuthSecretHash())).as(code + " refuses the published default").isFalse();
        });
    }
}

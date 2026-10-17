package com.samjhana.seed;

import com.samjhana.config.OcppProperties;
import com.samjhana.entity.ChargePoint;
import com.samjhana.repository.ChargePointRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChargePointSeederTest {

    @Mock ChargePointRepository chargePointRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock OcppProperties ocppProperties;

    ChargePointSeeder seeder;

    @BeforeEach
    void setUp() {
        seeder = new ChargePointSeeder(chargePointRepository, passwordEncoder, ocppProperties);
        lenient().when(ocppProperties.getDefaultLockBehavior()).thenReturn(ChargePoint.LockBehavior.EXPLICIT_UNLOCK);
        lenient().when(ocppProperties.secretFor(anyString())).thenAnswer(inv -> "secret-for-" + inv.getArgument(0));
        lenient().when(passwordEncoder.encode(anyString())).thenAnswer(inv -> "hash(" + inv.getArgument(0) + ")");
        lenient().when(chargePointRepository.save(any(ChargePoint.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void shouldCreateThreeChargersWithHashedSecrets_whenNoneExist() {
        when(chargePointRepository.findByCodeAndDeletedAtIsNull(anyString())).thenReturn(Optional.empty());

        seeder.run();

        ArgumentCaptor<ChargePoint> saved = ArgumentCaptor.forClass(ChargePoint.class);
        verify(chargePointRepository, times(3)).save(saved.capture());
        List<ChargePoint> points = saved.getAllValues();

        assertEquals("HD-D180-CC-01", points.get(0).getCode());
        assertEquals("HD-D180-CC", points.get(0).getModel());
        assertEquals(0, new BigDecimal("80").compareTo(points.get(0).getMaxPowerKw()));
        assertEquals(1, points.get(0).getDisplayOrder());

        assertEquals("HQC23-80-01", points.get(1).getCode());
        assertEquals("HQC23-80/1000/260-Y02-CC", points.get(1).getModel());
        assertEquals(2, points.get(1).getDisplayOrder());

        assertEquals("HD-D140-E-01", points.get(2).getCode());
        assertEquals(0, new BigDecimal("40").compareTo(points.get(2).getMaxPowerKw()));
        assertEquals(3, points.get(2).getDisplayOrder());

        for (ChargePoint point : points) {
            assertTrue(Boolean.TRUE.equals(point.getIsActive()));
            assertEquals(ChargePoint.ConnectionStatus.OFFLINE, point.getConnectionStatus());
            assertEquals(ChargePoint.LockBehavior.EXPLICIT_UNLOCK, point.getLockBehavior());
            // Only the BCrypt hash is stored — never the clear-text secret.
            assertEquals("hash(secret-for-" + point.getCode() + ")", point.getOcppAuthSecretHash());
        }
    }

    @Test
    void shouldKeepExistingSecretAndLockBehavior_whenChargerAlreadyRegistered() {
        ChargePoint existing = ChargePoint.builder()
                .id(java.util.UUID.randomUUID())
                .code("HD-D180-CC-01").model("old model").maxPowerKw(new BigDecimal("1")).displayOrder(9)
                .ocppAuthSecretHash("rotated-hash")
                .lockBehavior(ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP)
                .connectionStatus(ChargePoint.ConnectionStatus.ONLINE)
                .build();
        when(chargePointRepository.findByCodeAndDeletedAtIsNull("HD-D180-CC-01")).thenReturn(Optional.of(existing));
        when(chargePointRepository.findByCodeAndDeletedAtIsNull("HQC23-80-01")).thenReturn(Optional.empty());
        when(chargePointRepository.findByCodeAndDeletedAtIsNull("HD-D140-E-01")).thenReturn(Optional.empty());

        seeder.run();

        // Rotated secret and operator-chosen lock behavior survive a restart...
        assertEquals("rotated-hash", existing.getOcppAuthSecretHash());
        assertEquals(ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP, existing.getLockBehavior());
        // ...while the registry data is re-synced and stale ONLINE state is cleared (no live sockets after a restart).
        assertEquals("HD-D180-CC", existing.getModel());
        assertEquals(1, existing.getDisplayOrder());
        assertEquals(ChargePoint.ConnectionStatus.OFFLINE, existing.getConnectionStatus());
        verify(passwordEncoder, times(2)).encode(anyString()); // only the two new chargers
    }

    @Test
    void shouldGenerateSecretHash_whenExistingChargerHasNone() {
        ChargePoint legacy = ChargePoint.builder()
                .id(java.util.UUID.randomUUID())
                .code("HD-D180-CC-01").model("HD-D180-CC").maxPowerKw(new BigDecimal("80")).displayOrder(1)
                .build(); // created by the earlier charger-selection release: no secret yet
        when(chargePointRepository.findByCodeAndDeletedAtIsNull("HD-D180-CC-01")).thenReturn(Optional.of(legacy));
        when(chargePointRepository.findByCodeAndDeletedAtIsNull("HQC23-80-01")).thenReturn(Optional.empty());
        when(chargePointRepository.findByCodeAndDeletedAtIsNull("HD-D140-E-01")).thenReturn(Optional.empty());

        seeder.run();

        assertNotNull(legacy.getOcppAuthSecretHash());
        assertEquals("hash(secret-for-HD-D180-CC-01)", legacy.getOcppAuthSecretHash());
    }

    @Test
    void shouldFail_whenNoSecretIsConfiguredForACharger() {
        when(chargePointRepository.findByCodeAndDeletedAtIsNull(anyString())).thenReturn(Optional.empty());
        when(ocppProperties.secretFor("HD-D180-CC-01"))
                .thenThrow(new IllegalStateException("No OCPP secret configured for charge point HD-D180-CC-01"));

        assertThrows(IllegalStateException.class, () -> seeder.run());
        verify(chargePointRepository, never()).save(any());
    }

    @Test
    void shouldPropagateException_whenSaveFails() {
        when(chargePointRepository.findByCodeAndDeletedAtIsNull(anyString())).thenReturn(Optional.empty());
        when(chargePointRepository.save(any(ChargePoint.class))).thenThrow(new IllegalStateException("db down"));

        assertThrows(IllegalStateException.class, () -> seeder.run());
    }

    // ---- finding P1B1-01: a charger secret stored from the published development default is replaced ----

    private ChargePoint registered(String code, String hash) {
        return ChargePoint.builder()
                .id(java.util.UUID.randomUUID())
                .code(code).model("m").maxPowerKw(new BigDecimal("80")).displayOrder(1)
                .ocppAuthSecretHash(hash)
                .build();
    }

    private void onlyTheseChargersExist(ChargePoint... existing) {
        when(chargePointRepository.findByCodeAndDeletedAtIsNull(anyString())).thenReturn(Optional.empty());
        for (ChargePoint point : existing) {
            when(chargePointRepository.findByCodeAndDeletedAtIsNull(point.getCode())).thenReturn(Optional.of(point));
        }
    }

    @Test
    void shouldReplaceTheStoredHash_whenItMatchesThePublishedDefaultAndARealSecretIsConfigured() {
        ChargePoint seededFromTheDefault = registered("HD-D180-CC-01", "hash-of-the-published-default");
        onlyTheseChargersExist(seededFromTheDefault);
        when(passwordEncoder.matches(OcppProperties.publishedDevSecretFor("HD-D180-CC-01"), "hash-of-the-published-default"))
                .thenReturn(true);
        when(ocppProperties.configuredSecretFor("HD-D180-CC-01")).thenReturn(Optional.of("a-real-secret"));

        seeder.run();

        assertEquals("hash(a-real-secret)", seededFromTheDefault.getOcppAuthSecretHash());
    }

    @Test
    void shouldKeepTheStoredHash_whenItIsNotThePublishedDefault() {
        ChargePoint rotated = registered("HD-D180-CC-01", "hash-from-rotate-secret");
        onlyTheseChargersExist(rotated);
        lenient().when(ocppProperties.configuredSecretFor("HD-D180-CC-01")).thenReturn(Optional.of("a-real-secret"));

        seeder.run();

        assertEquals("hash-from-rotate-secret", rotated.getOcppAuthSecretHash());
        verify(passwordEncoder, times(2)).encode(anyString()); // only the two new chargers
    }

    @Test
    void shouldKeepTheStoredHash_whenTheConfiguredSecretIsTheSameAsThePublishedDefault() {
        ChargePoint onADevMachine = registered("HD-D180-CC-01", "hash-of-the-published-default");
        onlyTheseChargersExist(onADevMachine);
        String published = OcppProperties.publishedDevSecretFor("HD-D180-CC-01");
        when(passwordEncoder.matches(published, "hash-of-the-published-default")).thenReturn(true);
        when(ocppProperties.configuredSecretFor("HD-D180-CC-01")).thenReturn(Optional.of(published));

        seeder.run();

        assertEquals("hash-of-the-published-default", onADevMachine.getOcppAuthSecretHash());
    }

    @Test
    void shouldKeepTheStoredHash_whenNoSecretIsConfiguredForTheCharger() {
        ChargePoint noConfiguredSecret = registered("HD-D180-CC-01", "hash-of-the-published-default");
        onlyTheseChargersExist(noConfiguredSecret);
        when(passwordEncoder.matches(OcppProperties.publishedDevSecretFor("HD-D180-CC-01"), "hash-of-the-published-default"))
                .thenReturn(true);
        when(ocppProperties.configuredSecretFor("HD-D180-CC-01")).thenReturn(Optional.empty());

        seeder.run();

        assertEquals("hash-of-the-published-default", noConfiguredSecret.getOcppAuthSecretHash());
    }

    @Test
    void shouldReplaceOnlyTheChargerWhoseHashMatchesItsOwnPublishedDefault() {
        ChargePoint first = registered("HD-D180-CC-01", "hash-one");
        ChargePoint second = registered("HQC23-80-01", "hash-two");
        onlyTheseChargersExist(first, second);
        // both stored hashes are the first charger's published default; only the first charger is compared against it
        when(passwordEncoder.matches(anyString(), anyString())).thenAnswer(inv ->
                inv.getArgument(0).equals(OcppProperties.publishedDevSecretFor("HD-D180-CC-01"))
                        && (inv.getArgument(1).equals("hash-one") || inv.getArgument(1).equals("hash-two")));
        when(ocppProperties.configuredSecretFor("HD-D180-CC-01")).thenReturn(Optional.of("real-one"));
        lenient().when(ocppProperties.configuredSecretFor("HQC23-80-01")).thenReturn(Optional.of("real-two"));

        seeder.run();

        assertEquals("hash(real-one)", first.getOcppAuthSecretHash());
        assertEquals("hash-two", second.getOcppAuthSecretHash());
    }
}

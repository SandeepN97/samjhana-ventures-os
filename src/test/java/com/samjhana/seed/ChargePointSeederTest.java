package com.samjhana.seed;

import com.samjhana.entity.ChargePoint;
import com.samjhana.repository.ChargePointRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChargePointSeederTest {

    @Mock ChargePointRepository chargePointRepository;
    @InjectMocks ChargePointSeeder seeder;
    @Captor ArgumentCaptor<List<ChargePoint>> savedCaptor;

    @Test
    void shouldSeedThreeChargers_whenTableIsEmpty() {
        when(chargePointRepository.count()).thenReturn(0L);

        seeder.run();

        verify(chargePointRepository).saveAll(savedCaptor.capture());
        List<ChargePoint> saved = savedCaptor.getValue();
        assertEquals(3, saved.size());

        assertEquals("HD-D180-CC-01", saved.get(0).getCode());
        assertEquals("HD-D180-CC", saved.get(0).getModel());
        assertEquals(0, new BigDecimal("80").compareTo(saved.get(0).getMaxPowerKw()));
        assertEquals(1, saved.get(0).getDisplayOrder());

        assertEquals("HQC23-80-01", saved.get(1).getCode());
        assertEquals("HQC23-80/1000/260-Y02-CC", saved.get(1).getModel());
        assertEquals(0, new BigDecimal("80").compareTo(saved.get(1).getMaxPowerKw()));
        assertEquals(2, saved.get(1).getDisplayOrder());

        assertEquals("HD-D140-E-01", saved.get(2).getCode());
        assertEquals("HD-D140-E", saved.get(2).getModel());
        assertEquals(0, new BigDecimal("40").compareTo(saved.get(2).getMaxPowerKw()));
        assertEquals(3, saved.get(2).getDisplayOrder());

        assertTrue(saved.stream().allMatch(c -> Boolean.TRUE.equals(c.getIsActive())));
    }

    @Test
    void shouldNotSeed_whenChargersAlreadyExist() {
        when(chargePointRepository.count()).thenReturn(3L);

        seeder.run();

        verify(chargePointRepository, never()).saveAll(any());
    }

    @Test
    void shouldPropagateException_whenSaveFails() {
        when(chargePointRepository.count()).thenReturn(0L);
        doThrow(new IllegalStateException("db down")).when(chargePointRepository).saveAll(any());

        assertThrows(IllegalStateException.class, () -> seeder.run());
    }
}

package com.samjhana.service;

import com.samjhana.dto.ChargePointResponse;
import com.samjhana.entity.ChargePoint;
import com.samjhana.repository.ChargePointRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChargePointServiceTest {

    @Mock ChargePointRepository chargePointRepository;
    @InjectMocks ChargePointService chargePointService;

    private ChargePoint chargePoint(String code, String model, String kw, int order) {
        return ChargePoint.builder()
                .id(UUID.randomUUID())
                .code(code)
                .model(model)
                .maxPowerKw(new BigDecimal(kw))
                .displayOrder(order)
                .isActive(true)
                .build();
    }

    @Test
    void shouldReturnActiveChargePointsInRepositoryOrder_whenChargersExist() {
        ChargePoint first = chargePoint("HD-D180-CC-01", "HD-D180-CC", "80", 1);
        ChargePoint second = chargePoint("HD-D140-E-01", "HD-D140-E", "40", 3);
        when(chargePointRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc())
                .thenReturn(List.of(first, second));

        List<ChargePointResponse> result = chargePointService.getActiveChargePoints();

        assertEquals(2, result.size());
        assertEquals(first.getId().toString(), result.get(0).getId());
        assertEquals("HD-D180-CC-01", result.get(0).getCode());
        assertEquals("HD-D180-CC", result.get(0).getModel());
        assertEquals(0, new BigDecimal("80").compareTo(result.get(0).getMaxPowerKw()));
        assertEquals(1, result.get(0).getDisplayOrder());
        assertEquals("HD-D140-E-01", result.get(1).getCode());
        verify(chargePointRepository).findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc();
    }

    @Test
    void shouldReturnEmptyList_whenNoActiveChargersExist() {
        when(chargePointRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc())
                .thenReturn(List.of());

        List<ChargePointResponse> result = chargePointService.getActiveChargePoints();

        assertTrue(result.isEmpty());
    }

    @Test
    void shouldPropagateException_whenRepositoryFails() {
        when(chargePointRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc())
                .thenThrow(new IllegalStateException("db down"));

        assertThrows(IllegalStateException.class, () -> chargePointService.getActiveChargePoints());
    }
}

package com.samjhana.service;

import com.samjhana.dto.ChargePointResponse;
import com.samjhana.repository.ChargePointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChargePointService {

    private final ChargePointRepository chargePointRepository;

    /** Active, non-deleted chargers in display order (Charger 1, 2, 3). */
    public List<ChargePointResponse> getActiveChargePoints() {
        return chargePointRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAsc()
                .stream().map(ChargePointResponse::from).toList();
    }
}

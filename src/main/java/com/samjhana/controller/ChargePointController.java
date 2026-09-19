package com.samjhana.controller;

import com.samjhana.dto.ChargePointResponse;
import com.samjhana.service.ChargePointService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/charge-points")
@RequiredArgsConstructor
public class ChargePointController {

    private final ChargePointService chargePointService;

    @GetMapping
    public ResponseEntity<List<ChargePointResponse>> getActiveChargePoints() {
        return ResponseEntity.ok(chargePointService.getActiveChargePoints());
    }
}

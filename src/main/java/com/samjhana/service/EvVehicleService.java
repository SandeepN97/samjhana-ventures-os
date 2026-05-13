package com.samjhana.service;

import com.samjhana.dto.EvVehicleRequest;
import com.samjhana.dto.EvVehicleResponse;
import com.samjhana.entity.EvVehicle;
import com.samjhana.exception.ResourceNotFoundException;
import com.samjhana.entity.User;
import com.samjhana.repository.EvVehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EvVehicleService {

    private final EvVehicleRepository evVehicleRepository;

    public List<EvVehicleResponse> getActiveVehicles() {
        return evVehicleRepository.findByIsActiveTrueOrderByVehicleNameAsc()
                .stream().map(EvVehicleResponse::from).toList();
    }

    public List<EvVehicleResponse> getAllVehicles() {
        return evVehicleRepository.findAllByOrderByVehicleNameAsc()
                .stream().map(EvVehicleResponse::from).toList();
    }

    @Transactional
    public EvVehicleResponse createVehicle(EvVehicleRequest request, User user) {
        if (request.getVehicleName() == null || request.getVehicleName().trim().isEmpty()) {
            throw new IllegalArgumentException("Vehicle name is required");
        }
        if (request.getRatePerPercent() == null) {
            throw new IllegalArgumentException("Rate per percent is required");
        }
        EvVehicle vehicle = EvVehicle.builder()
                .vehicleName(request.getVehicleName().trim())
                .batteryCapacityKw(request.getBatteryCapacityKw())
                .seatingCapacity(request.getSeatingCapacity())
                .ratePerPercent(request.getRatePerPercent())
                .isActive(true)
                .updatedBy(user)
                .build();
        return EvVehicleResponse.from(evVehicleRepository.save(vehicle));
    }

    @Transactional
    public EvVehicleResponse updateVehicle(UUID id, EvVehicleRequest request, User user) {
        EvVehicle vehicle = evVehicleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + id));
        if (request.getVehicleName() != null && !request.getVehicleName().trim().isEmpty()) {
            vehicle.setVehicleName(request.getVehicleName().trim());
        }
        if (request.getBatteryCapacityKw() != null) vehicle.setBatteryCapacityKw(request.getBatteryCapacityKw());
        if (request.getSeatingCapacity() != null) vehicle.setSeatingCapacity(request.getSeatingCapacity());
        if (request.getRatePerPercent() != null) vehicle.setRatePerPercent(request.getRatePerPercent());
        vehicle.setUpdatedBy(user);
        return EvVehicleResponse.from(evVehicleRepository.save(vehicle));
    }

    @Transactional
    public void deleteVehicle(UUID id, User user) {
        EvVehicle vehicle = evVehicleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + id));
        vehicle.setIsActive(false);
        vehicle.setUpdatedBy(user);
        evVehicleRepository.save(vehicle);
    }
}
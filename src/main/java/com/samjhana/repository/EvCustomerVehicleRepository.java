package com.samjhana.repository;

import com.samjhana.entity.EvCustomerVehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EvCustomerVehicleRepository extends JpaRepository<EvCustomerVehicle, UUID> {
    Optional<EvCustomerVehicle> findByPlateNumberAndDeletedAtIsNull(String plateNumber);
}

package com.samjhana.repository;

import com.samjhana.entity.EvVehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EvVehicleRepository extends JpaRepository<EvVehicle, UUID> {

    List<EvVehicle> findByIsActiveTrueOrderByVehicleNameAsc();

    List<EvVehicle> findAllByOrderByVehicleNameAsc();
}

package com.samjhana.repository;

import com.samjhana.entity.FuelPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FuelPriceRepository extends JpaRepository<FuelPrice, UUID> {

    // Get the latest price for a fuel type (on or before given date)
    Optional<FuelPrice> findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(
            FuelPrice.FuelType fuelType, LocalDate date);

    // Get price for specific date and fuel type
    Optional<FuelPrice> findByFuelTypeAndEffectiveDate(FuelPrice.FuelType fuelType, LocalDate effectiveDate);

    // Get all prices for a fuel type ordered by date desc
    List<FuelPrice> findByFuelTypeOrderByEffectiveDateDesc(FuelPrice.FuelType fuelType);

    // Get all prices ordered by date desc
    List<FuelPrice> findAllByOrderByEffectiveDateDescFuelTypeAsc();

    // Get prices for a date range
    List<FuelPrice> findByEffectiveDateBetweenOrderByEffectiveDateDesc(LocalDate startDate, LocalDate endDate);
}

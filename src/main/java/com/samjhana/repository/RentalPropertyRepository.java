package com.samjhana.repository;

import com.samjhana.entity.RentalProperty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RentalPropertyRepository extends JpaRepository<RentalProperty, UUID> {

    List<RentalProperty> findByIsActiveTrueOrderByPropertyNameAsc();

    List<RentalProperty> findAllByOrderByPropertyNameAsc();
}

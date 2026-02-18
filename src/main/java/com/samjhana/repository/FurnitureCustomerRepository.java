package com.samjhana.repository;

import com.samjhana.entity.FurnitureCustomer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FurnitureCustomerRepository extends JpaRepository<FurnitureCustomer, UUID> {

    List<FurnitureCustomer> findByIsActiveTrueOrderByNameAsc();

    List<FurnitureCustomer> findByPhoneContaining(String phone);
}

package com.samjhana.repository;

import com.samjhana.entity.RestaurantDish;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RestaurantDishRepository extends JpaRepository<RestaurantDish, UUID> {

    List<RestaurantDish> findByDeletedAtIsNullOrderBySortOrderAscNameAsc();

    List<RestaurantDish> findByDeletedAtIsNullAndShowOnWebsiteTrueOrderBySortOrderAscNameAsc();

    Optional<RestaurantDish> findByIdAndDeletedAtIsNull(UUID id);

    long countByDeletedAtIsNull();
}

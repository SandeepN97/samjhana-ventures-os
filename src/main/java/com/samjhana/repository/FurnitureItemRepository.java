package com.samjhana.repository;

import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.FurnitureItem.FurnitureCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FurnitureItemRepository extends JpaRepository<FurnitureItem, UUID> {

    List<FurnitureItem> findByIsActiveTrueOrderByNameAsc();

    List<FurnitureItem> findByCategoryAndIsActiveTrue(FurnitureCategory category);

    List<FurnitureItem> findByStockQtyLessThanEqualAndIsActiveTrue(int reorderLevel);
}

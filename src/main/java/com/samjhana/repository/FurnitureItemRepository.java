package com.samjhana.repository;

import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.FurnitureItem.FurnitureCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FurnitureItemRepository extends JpaRepository<FurnitureItem, UUID> {

    List<FurnitureItem> findByIsActiveTrueOrderByNameAsc();

    List<FurnitureItem> findByCategoryAndIsActiveTrue(FurnitureCategory category);

    List<FurnitureItem> findByStockQtyLessThanEqualAndIsActiveTrue(int reorderLevel);

    List<FurnitureItem> findBySlugIsNull();

    Optional<FurnitureItem> findByIdAndIsActiveTrue(UUID id);

    boolean existsBySlug(String slug);

    /** Takes {@code qty} off the stock in one guarded statement; returns 0 and changes nothing when there is not enough. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update FurnitureItem i set i.stockQty = i.stockQty - :qty "
            + "where i.id = :id and i.isActive = true and i.stockQty >= :qty")
    int removeStock(@Param("id") UUID id, @Param("qty") int qty);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update FurnitureItem i set i.stockQty = i.stockQty + :qty where i.id = :id")
    int addStock(@Param("id") UUID id, @Param("qty") int qty);
}

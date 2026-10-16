package com.samjhana.repository;

import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.FurnitureItem.FurnitureCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FurnitureItemRepository extends JpaRepository<FurnitureItem, UUID> {

    List<FurnitureItem> findByIsActiveTrueOrderByNameAsc();

    List<FurnitureItem> findByCategoryAndIsActiveTrue(FurnitureCategory category);

    List<FurnitureItem> findBySlugIsNull();

    boolean existsBySlug(String slug);

    /** Takes {@code qty} off the stock in one guarded statement; returns 0 and changes nothing when there is not enough. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update FurnitureItem i set i.stockQty = i.stockQty - :qty "
            + "where i.id = :id and i.isActive = true and :qty > 0 and i.stockQty >= :qty")
    int removeStock(@Param("id") UUID id, @Param("qty") int qty);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update FurnitureItem i set i.stockQty = i.stockQty + :qty where i.id = :id and :qty > 0")
    int addStock(@Param("id") UUID id, @Param("qty") int qty);

    /**
     * Takes {@code qty} off the stock in one statement, but never below zero: a counter sale for more than the recorded
     * stock takes it to zero, as it always did. One statement rather than read, subtract and write back, so two sales
     * (or a sale and an online order) at the same moment cannot overwrite each other (finding P1a-13).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update FurnitureItem i set i.stockQty = case when i.stockQty > :qty then i.stockQty - :qty else 0 end "
            + "where i.id = :id and :qty > 0")
    int removeStockUpTo(@Param("id") UUID id, @Param("qty") int qty);
}

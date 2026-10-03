package com.samjhana.repository;

import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BeekeepingProduct.BeekeepingCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BeekeepingProductRepository extends JpaRepository<BeekeepingProduct, UUID> {

    List<BeekeepingProduct> findByDeletedAtIsNullOrderByNameAsc();

    List<BeekeepingProduct> findByCategoryAndDeletedAtIsNullOrderByNameAsc(BeekeepingCategory category);

    List<BeekeepingProduct> findByDeletedAtIsNullAndShowOnWebsiteTrueOrderByNameAsc();

    Optional<BeekeepingProduct> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsBySku(String sku);

    boolean existsBySlug(String slug);

    /**
     * Takes {@code qty} off the stock in one guarded statement. Returns 0 (and changes nothing) when the
     * product is missing, removed, or has fewer than {@code qty} in stock.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update BeekeepingProduct p set p.stockQty = p.stockQty - :qty "
            + "where p.id = :id and p.deletedAt is null and p.stockQty >= :qty")
    int removeStock(@Param("id") UUID id, @Param("qty") int qty);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update BeekeepingProduct p set p.stockQty = p.stockQty + :qty "
            + "where p.id = :id and p.deletedAt is null")
    int addStock(@Param("id") UUID id, @Param("qty") int qty);
}

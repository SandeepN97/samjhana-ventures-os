package com.samjhana.repository;

import com.samjhana.entity.ShopOrder;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShopOrderRepository extends JpaRepository<ShopOrder, UUID> {

    Optional<ShopOrder> findByOrderNumber(String orderNumber);

    boolean existsByOrderNumber(String orderNumber);

    /** The newest orders, as many as the page asks for and no more: the table grows without limit. */
    List<ShopOrder> findAllByOrderByCreatedAtDesc(Pageable page);

    List<ShopOrder> findByStatusOrderByCreatedAtDesc(ShopOrder.Status status, Pageable page);

    /**
     * The newest orders whose number, customer name or phone contains the text. {@code pattern} is a LIKE pattern
     * written with {@code !} as the escape character (see {@code ShopOrderService.likePattern}).
     */
    @Query("select o from ShopOrder o where lower(o.orderNumber) like :pattern escape '!' "
            + "or lower(o.customerName) like :pattern escape '!' or o.customerPhone like :pattern escape '!' "
            + "order by o.createdAt desc")
    List<ShopOrder> search(@Param("pattern") String pattern, Pageable page);

    @Query("select o from ShopOrder o where o.status = :status and (lower(o.orderNumber) like :pattern escape '!' "
            + "or lower(o.customerName) like :pattern escape '!' or o.customerPhone like :pattern escape '!') "
            + "order by o.createdAt desc")
    List<ShopOrder> searchByStatus(@Param("status") ShopOrder.Status status, @Param("pattern") String pattern, Pageable page);

    @Query("select o.status, count(o) from ShopOrder o group by o.status")
    List<Object[]> countByStatus();

    /**
     * Moves the order to {@code next} only while it is still in the status {@code before}, in one statement (finding
     * P1a-05). Returns 1 for the one request that moved it and 0 for any other: the row stays locked until the
     * transaction ends, so a second request waits, then finds the status already changed.
     * {@code cancelReason} and {@code completedAt} are only given for the move that sets them; both are empty on every
     * earlier status, so writing them with the move loses nothing.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ShopOrder o set o.status = :next, o.statusUpdatedBy = :by, o.cancelReason = :reason, "
            + "o.completedAt = :completedAt, o.updatedAt = :now where o.id = :id and o.status = :before")
    int moveStatus(@Param("id") UUID id, @Param("before") ShopOrder.Status before, @Param("next") ShopOrder.Status next,
                   @Param("by") String by, @Param("reason") String reason,
                   @Param("completedAt") LocalDateTime completedAt, @Param("now") LocalDateTime now);

    /** Writes the staff notes and nothing else, so a status change made at the same moment is not undone. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ShopOrder o set o.internalNotes = :notes, o.updatedAt = :now where o.id = :id")
    int saveNotes(@Param("id") UUID id, @Param("notes") String notes, @Param("now") LocalDateTime now);
}

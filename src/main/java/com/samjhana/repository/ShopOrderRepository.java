package com.samjhana.repository;

import com.samjhana.entity.ShopOrder;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
}

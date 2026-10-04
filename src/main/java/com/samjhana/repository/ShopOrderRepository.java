package com.samjhana.repository;

import com.samjhana.entity.ShopOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShopOrderRepository extends JpaRepository<ShopOrder, UUID> {

    Optional<ShopOrder> findByOrderNumber(String orderNumber);

    boolean existsByOrderNumber(String orderNumber);

    List<ShopOrder> findAllByOrderByCreatedAtDesc();

    List<ShopOrder> findByStatusOrderByCreatedAtDesc(ShopOrder.Status status);

    @Query("select o.status, count(o) from ShopOrder o group by o.status")
    List<Object[]> countByStatus();
}

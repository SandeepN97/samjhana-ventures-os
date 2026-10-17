package com.samjhana.repository;

import com.samjhana.entity.ShopOrder;
import com.samjhana.entity.ShopOrder.Status;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding P1a-05: the two guarded statements the online-order status code relies on. The move only works while the
 * order is still in the status the caller saw, and the notes are written without touching anything else.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ShopOrderRepositoryStatusTest {

    @Autowired ShopOrderRepository orders;
    @PersistenceContext EntityManager entityManager;

    private ShopOrder newOrder(Status status) {
        ShopOrder order = new ShopOrder();
        order.setOrderNumber("SV-261016-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase());
        order.setCustomerName("Hari Thapa");
        order.setCustomerPhone("9801234567");
        order.setFulfilment(ShopOrder.Fulfilment.PICKUP);
        order.setPaymentMethod(ShopOrder.PaymentMethod.PAY_AT_SHOP);
        order.setStatus(status);
        order.setSubtotal(new BigDecimal("100"));
        order.setTotal(new BigDecimal("100"));
        order.setInternalNotes("first note");
        return orders.saveAndFlush(order);
    }

    private ShopOrder reload(ShopOrder order) {
        entityManager.flush();
        entityManager.clear();
        return orders.findById(order.getId()).orElseThrow();
    }

    @Test
    void shouldMoveTheOrderAndRecordWhoAndWhen_whenItIsStillInTheStatusTheCallerSaw() {
        ShopOrder order = newOrder(Status.CONFIRMED);
        LocalDateTime now = LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);   // the database keeps less than a nanosecond

        int moved = orders.moveStatus(order.getId(), Status.CONFIRMED, Status.COMPLETED, "staff", null, now, now);

        assertThat(moved).isEqualTo(1);
        ShopOrder after = reload(order);
        assertThat(after.getStatus()).isEqualTo(Status.COMPLETED);
        assertThat(after.getStatusUpdatedBy()).isEqualTo("staff");
        assertThat(after.getCompletedAt()).isEqualTo(now);
        assertThat(after.getCancelReason()).isNull();
    }

    @Test
    void shouldRecordTheReason_whenTheMoveIsACancellation() {
        ShopOrder order = newOrder(Status.READY);

        int moved = orders.moveStatus(order.getId(), Status.READY, Status.CANCELLED, "manager", "Customer changed their mind",
                null, LocalDateTime.now());

        assertThat(moved).isEqualTo(1);
        ShopOrder after = reload(order);
        assertThat(after.getStatus()).isEqualTo(Status.CANCELLED);
        assertThat(after.getCancelReason()).isEqualTo("Customer changed their mind");
        assertThat(after.getCompletedAt()).isNull();
    }

    @Test
    void shouldChangeNothing_whenTheOrderIsNoLongerInTheStatusTheCallerSaw() {
        ShopOrder order = newOrder(Status.COMPLETED);

        int moved = orders.moveStatus(order.getId(), Status.CONFIRMED, Status.CANCELLED, "manager", "too late", null, LocalDateTime.now());

        assertThat(moved).isZero();
        ShopOrder after = reload(order);
        assertThat(after.getStatus()).isEqualTo(Status.COMPLETED);
        assertThat(after.getCancelReason()).isNull();
        assertThat(after.getStatusUpdatedBy()).isNull();
    }

    @Test
    void shouldMoveTheOrderOnlyOnce_whenTheSameMoveIsAskedForTwice() {
        ShopOrder order = newOrder(Status.CONFIRMED);
        LocalDateTime now = LocalDateTime.now();

        int first = orders.moveStatus(order.getId(), Status.CONFIRMED, Status.COMPLETED, "staff", null, now, now);
        int second = orders.moveStatus(order.getId(), Status.CONFIRMED, Status.COMPLETED, "manager", null, now, now);

        assertThat(first).isEqualTo(1);
        assertThat(second).isZero();
        assertThat(reload(order).getStatusUpdatedBy()).isEqualTo("staff");
    }

    @Test
    void shouldChangeNothing_forAnOrderThatDoesNotExist() {
        assertThat(orders.moveStatus(UUID.randomUUID(), Status.NEW, Status.CONFIRMED, "staff", null, null, LocalDateTime.now())).isZero();
        assertThat(orders.saveNotes(UUID.randomUUID(), "x", LocalDateTime.now())).isZero();
    }

    @Test
    void shouldWriteTheNotesAndNothingElse() {
        ShopOrder order = newOrder(Status.CONFIRMED);

        int written = orders.saveNotes(order.getId(), "Call before delivery", LocalDateTime.now());

        assertThat(written).isEqualTo(1);
        ShopOrder after = reload(order);
        assertThat(after.getInternalNotes()).isEqualTo("Call before delivery");
        assertThat(after.getStatus()).isEqualTo(Status.CONFIRMED);
        assertThat(after.getCustomerName()).isEqualTo("Hari Thapa");
        assertThat(after.getTotal()).isEqualByComparingTo("100");
    }

    @Test
    void shouldClearTheNotes_whenGivenNone() {
        ShopOrder order = newOrder(Status.NEW);

        orders.saveNotes(order.getId(), null, LocalDateTime.now());

        assertThat(reload(order).getInternalNotes()).isNull();
    }
}

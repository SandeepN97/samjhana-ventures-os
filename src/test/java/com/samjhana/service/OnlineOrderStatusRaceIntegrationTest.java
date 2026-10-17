package com.samjhana.service;

import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.ShopOrder;
import com.samjhana.entity.User;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.ShopOrderRepository;
import com.samjhana.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;

/**
 * Finding P1a-05: changing the status of an online order checked the order's status, did the work that goes with the
 * change (record the sale, give the held stock back) and then saved, with nothing to stop a second request doing the
 * same in between. Two people completing the same order booked the sale twice; two cancelling it returned the stock
 * twice; a completion and a cancellation both happened. Not a transactional test: the point is two real transactions
 * at once.
 */
@SpringBootTest
@ActiveProfiles("test")
class OnlineOrderStatusRaceIntegrationTest {

    private static final AtomicInteger PHONES = new AtomicInteger(7000);

    @Autowired ShopOrderService orders;
    @SpyBean ShopOrderRepository orderRepository;
    @Autowired FurnitureItemRepository furniture;
    @Autowired BeekeepingProductRepository honey;
    @Autowired BusinessUnitRepository businessUnits;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JdbcTemplate jdbc;
    @PersistenceContext EntityManager entityManager;

    private User staff;
    private User manager;
    private FurnitureItem sofa;
    private BeekeepingProduct jar;

    @BeforeEach
    void fixtures() {
        reset(orderRepository);
        for (String code : List.of("furniture", "beekeeping")) {
            if (businessUnits.findByCode(code).isEmpty()) {
                businessUnits.save(BusinessUnit.builder().code(code).name(code).nameNepali(code).build());
            }
        }
        staff = newUser("order-staff-", User.UserRole.STAFF);
        manager = newUser("order-manager-", User.UserRole.MANAGER);
        String unique = UUID.randomUUID().toString().substring(0, 8);
        sofa = furniture.save(FurnitureItem.builder().name("Race sofa").sku("RACE-SOFA-" + unique).slug("race-sofa-" + unique)
                .category(FurnitureItem.FurnitureCategory.SOFA).sellingPrice(new BigDecimal("45000")).stockQty(5).build());
        jar = honey.save(BeekeepingProduct.builder().name("Race honey").sku("RACE-HNY-" + unique).slug("race-hny-" + unique)
                .category(BeekeepingProduct.BeekeepingCategory.HONEY).sellingPrice(new BigDecimal("850")).stockQty(5)
                .showOnWebsite(true).build());
    }

    private User newUser(String prefix, User.UserRole role) {
        return users.save(User.builder().username(prefix + UUID.randomUUID().toString().substring(0, 8))
                .passwordHash(passwordEncoder.encode("not-used")).fullName(prefix).fullNameNepali(prefix).role(role).build());
    }

    /** Places an order for two sofas and one jar of honey, and moves it on to confirmed. */
    private UUID confirmedOrder() {
        String phone = "98" + PHONES.incrementAndGet() + "5678";
        Map<String, Object> placed = orders.place(new ShopOrderService.PlaceOrderRequest("Hari Thapa", phone, null, "PICKUP",
                null, null, null, null,
                List.of(new ShopOrderService.Item(sofa.getSlug(), 2), new ShopOrderService.Item(jar.getSlug(), 1)), null));
        UUID id = jdbc.queryForObject("select id from shop_orders where order_number = ?", UUID.class, placed.get("orderNumber"));
        orders.updateStatus(id, "CONFIRMED", null, staff);
        return id;
    }

    private String statusOf(UUID id) {
        return jdbc.queryForObject("select status from shop_orders where id = ?", String.class, id);
    }

    private int salesBookedFor(UUID id) {
        return jdbc.queryForObject("select count(*) from transactions where reference_number = "
                + "(select order_number from shop_orders where id = ?)", Integer.class, id);
    }

    private int sofaStock() {
        return jdbc.queryForObject("select stock_qty from furniture_items where id = ?", Integer.class, sofa.getId());
    }

    private int jarStock() {
        return jdbc.queryForObject("select stock_qty from beekeeping_products where id = ?", Integer.class, jar.getId());
    }

    /** Makes every read of an order wait until both requests have read it (or half a second has passed). */
    private void holdReadsUntilBothHaveRead() {
        CountDownLatch bothHaveRead = new CountDownLatch(2);
        doAnswer(call -> {
            Optional<ShopOrder> read = Optional.ofNullable(entityManager.find(ShopOrder.class, call.getArgument(0)));
            bothHaveRead.countDown();
            bothHaveRead.await(500, TimeUnit.MILLISECONDS);
            return read;
        }).when(orderRepository).findById(any());
    }

    /** Runs the two jobs at the same moment and returns what each one threw (null when it worked). */
    @SafeVarargs
    private List<Throwable> atTheSameMoment(Callable<?>... jobs) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(jobs.length);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<?>> running = new ArrayList<>();
            for (Callable<?> job : jobs) {
                running.add(pool.submit(() -> {
                    go.await();
                    return job.call();
                }));
            }
            go.countDown();
            List<Throwable> outcomes = new ArrayList<>();
            for (Future<?> future : running) {
                try {
                    future.get(30, TimeUnit.SECONDS);
                    outcomes.add(null);
                } catch (ExecutionException e) {
                    outcomes.add(e.getCause());
                }
            }
            return outcomes;
        } finally {
            pool.shutdownNow();
        }
    }

    // ------------------------------------------------------------------ ordinary use

    @Test
    void shouldBookOneSalePerBusinessAndKeepTheStockHeld_whenAnOrderIsCompleted() {
        UUID id = confirmedOrder();

        Map<String, Object> done = orders.updateStatus(id, "COMPLETED", null, staff);

        assertThat(done.get("status")).isEqualTo("COMPLETED");
        assertThat(statusOf(id)).isEqualTo("COMPLETED");
        assertThat(salesBookedFor(id)).isEqualTo(2);
        assertThat(sofaStock()).isEqualTo(3);
        assertThat(jarStock()).isEqualTo(4);
    }

    @Test
    void shouldGiveTheHeldStockBackAndBookNothing_whenAManagerCancelsAnOrder() {
        UUID id = confirmedOrder();

        Map<String, Object> done = orders.updateStatus(id, "CANCELLED", "Customer changed their mind", manager);

        assertThat(done.get("status")).isEqualTo("CANCELLED");
        assertThat(statusOf(id)).isEqualTo("CANCELLED");
        assertThat(salesBookedFor(id)).isZero();
        assertThat(sofaStock()).isEqualTo(5);
        assertThat(jarStock()).isEqualTo(5);
        assertThat(jdbc.queryForObject("select cancel_reason from shop_orders where id = ?", String.class, id))
                .isEqualTo("Customer changed their mind");
    }

    @Test
    void shouldRecordWhoChangedTheOrderAndWhen() {
        UUID id = confirmedOrder();

        orders.updateStatus(id, "COMPLETED", null, staff);

        assertThat(jdbc.queryForObject("select status_updated_by from shop_orders where id = ?", String.class, id)).isEqualTo(staff.getUsername());
        assertThat(jdbc.queryForObject("select completed_at from shop_orders where id = ?", java.sql.Timestamp.class, id)).isNotNull();
    }

    @Test
    void shouldRefuseToCancel_whenTheCallerIsNotAManager_andChangeNothing() {
        UUID id = confirmedOrder();

        assertThatThrownBy(() -> orders.updateStatus(id, "CANCELLED", "no", staff)).isInstanceOf(AccessDeniedException.class);

        assertThat(statusOf(id)).isEqualTo("CONFIRMED");
        assertThat(sofaStock()).isEqualTo(3);
    }

    @Test
    void shouldRefuseAMoveThatIsNotAllowed_andChangeNothing() {
        UUID id = confirmedOrder();
        orders.updateStatus(id, "COMPLETED", null, staff);

        assertThatThrownBy(() -> orders.updateStatus(id, "CANCELLED", "too late", manager))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("completed")
                .hasMessageContaining("cancelled");

        assertThat(statusOf(id)).isEqualTo("COMPLETED");
        assertThat(sofaStock()).isEqualTo(3);
        assertThat(salesBookedFor(id)).isEqualTo(2);
    }

    // ------------------------------------------------------------------ two requests at the same moment

    @Test
    void shouldBookTheSaleOnce_whenTwoPeopleCompleteTheSameOrderAtTheSameMoment() throws Exception {
        UUID id = confirmedOrder();
        holdReadsUntilBothHaveRead();

        List<Throwable> outcomes = atTheSameMoment(
                () -> orders.updateStatus(id, "COMPLETED", null, staff),
                () -> orders.updateStatus(id, "COMPLETED", null, manager));

        assertThat(outcomes).as("one request works, the other is told the order has already moved on").containsOnlyOnce((Throwable) null);
        assertThat(outcomes.stream().filter(e -> e != null).findFirst().orElseThrow()).isInstanceOf(IllegalArgumentException.class);
        assertThat(statusOf(id)).isEqualTo("COMPLETED");
        assertThat(salesBookedFor(id)).as("sales booked: one per business").isEqualTo(2);
    }

    @Test
    void shouldGiveTheStockBackOnce_whenTwoManagersCancelTheSameOrderAtTheSameMoment() throws Exception {
        UUID id = confirmedOrder();
        holdReadsUntilBothHaveRead();

        List<Throwable> outcomes = atTheSameMoment(
                () -> orders.updateStatus(id, "CANCELLED", "first", manager),
                () -> orders.updateStatus(id, "CANCELLED", "second", manager));

        assertThat(outcomes).containsOnlyOnce((Throwable) null);
        assertThat(statusOf(id)).isEqualTo("CANCELLED");
        assertThat(sofaStock()).as("sofa stock after one cancellation").isEqualTo(5);
        assertThat(jarStock()).as("honey stock after one cancellation").isEqualTo(5);
    }

    @Test
    void shouldLetOnlyOneWin_whenOneCompletesAndAnotherCancelsAtTheSameMoment() throws Exception {
        UUID id = confirmedOrder();
        holdReadsUntilBothHaveRead();

        List<Throwable> outcomes = atTheSameMoment(
                () -> orders.updateStatus(id, "COMPLETED", null, staff),
                () -> orders.updateStatus(id, "CANCELLED", "changed mind", manager));

        assertThat(outcomes).containsOnlyOnce((Throwable) null);
        String status = statusOf(id);
        if (status.equals("COMPLETED")) {
            assertThat(salesBookedFor(id)).isEqualTo(2);
            assertThat(sofaStock()).isEqualTo(3);
            assertThat(jarStock()).isEqualTo(4);
        } else {
            assertThat(status).isEqualTo("CANCELLED");
            assertThat(salesBookedFor(id)).isZero();
            assertThat(sofaStock()).isEqualTo(5);
            assertThat(jarStock()).isEqualTo(5);
        }
    }

    @Test
    void shouldNotUndoAStatusChange_whenNotesAreSavedAtTheSameMoment() throws Exception {
        UUID id = confirmedOrder();
        holdReadsUntilBothHaveRead();

        List<Throwable> outcomes = atTheSameMoment(
                () -> orders.updateStatus(id, "READY", null, staff),
                () -> orders.updateNotes(id, "Call before delivery"));

        assertThat(outcomes).containsOnly((Throwable) null);
        assertThat(statusOf(id)).isEqualTo("READY");
        assertThat(jdbc.queryForObject("select internal_notes from shop_orders where id = ?", String.class, id))
                .isEqualTo("Call before delivery");
    }
}

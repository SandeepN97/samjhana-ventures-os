package com.samjhana.service;

import com.samjhana.dto.TransactionRequest;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.User;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;

/**
 * Findings P0-11 and P1a-13: a furniture sale records what it took off the stock. A line with a negative quantity used
 * to add to the stock; and the stock was read, changed in memory and written back as an absolute number, so two sales
 * at the same moment (or a sale and an online order) overwrote each other and the stock ended too high.
 * Not a transactional test: the point is two real transactions at once.
 */
@SpringBootTest
@ActiveProfiles("test")
class FurnitureStockChangeIntegrationTest {

    @Autowired TransactionService transactionService;
    @SpyBean FurnitureItemRepository items;
    @Autowired BusinessUnitRepository businessUnits;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JdbcTemplate jdbc;
    @PersistenceContext EntityManager entityManager;

    private User staff;

    @BeforeEach
    void fixtures() {
        reset(items);
        if (businessUnits.findByCode(BusinessUnit.CODE_FURNITURE).isEmpty()) {
            businessUnits.save(BusinessUnit.builder().code(BusinessUnit.CODE_FURNITURE).name("Furniture").nameNepali("फर्निचर")
                    .icon("🪑").calculationStrategy("FurnitureStrategy").displayOrder(3).build());
        }
        staff = users.save(User.builder().username("stock-staff-" + UUID.randomUUID().toString().substring(0, 8))
                .passwordHash(passwordEncoder.encode("not-used")).fullName("Stock Staff").fullNameNepali("स्टक")
                .role(User.UserRole.STAFF).build());
    }

    private FurnitureItem newItem(int stock) {
        return items.save(FurnitureItem.builder().name("Test sofa").sku("STOCK-" + UUID.randomUUID())
                .category(FurnitureItem.FurnitureCategory.SOFA).stockQty(stock).sellingPrice(new BigDecimal("1000")).build());
    }

    private int stockOf(FurnitureItem item) {
        return jdbc.queryForObject("select stock_qty from furniture_items where id = ?", Integer.class, item.getId());
    }

    private int transactionsRecorded() {
        return jdbc.queryForObject("select count(*) from transactions where entered_by = ?", Integer.class, staff.getId());
    }

    private static Map<String, Object> line(FurnitureItem item, Object quantity) {
        return Map.of("itemId", item.getId().toString(), "itemName", item.getName(), "quantity", quantity, "unitPrice", 1000);
    }

    private TransactionRequest request(String type, Object... lines) {
        TransactionRequest request = new TransactionRequest();
        request.setBusinessCode(BusinessUnit.CODE_FURNITURE);
        request.setTransactionType(type);
        request.setAmount(new BigDecimal("1000"));
        request.setCustomFields(Map.of("itemName", "Test sofa", "quantity", 1, "items", List.of(lines)));
        return request;
    }

    // ------------------------------------------------------------------ ordinary sales

    @Test
    void shouldTakeTheSoldQuantityOffTheStock() {
        FurnitureItem sofa = newItem(5);

        transactionService.create(request("SALE", line(sofa, 3)), staff);

        assertThat(stockOf(sofa)).isEqualTo(2);
    }

    @Test
    void shouldTakeEveryLineOffTheStock_includingTwoLinesForTheSameItem() {
        FurnitureItem sofa = newItem(10);
        FurnitureItem chair = newItem(10);

        transactionService.create(request("SALE", line(sofa, 2), line(chair, 4), line(sofa, 1)), staff);

        assertThat(stockOf(sofa)).isEqualTo(7);
        assertThat(stockOf(chair)).isEqualTo(6);
    }

    @Test
    void shouldAddToTheStock_whenAPurchaseIsRecorded() {
        FurnitureItem sofa = newItem(1);

        transactionService.create(request("PURCHASE", line(sofa, 4)), staff);

        assertThat(stockOf(sofa)).isEqualTo(5);
    }

    @Test
    void shouldTakeStockToZeroAndRecordTheSale_whenTheSaleIsLargerThanTheRecordedStock() {
        FurnitureItem sofa = newItem(2);
        int before = transactionsRecorded();

        transactionService.create(request("SALE", line(sofa, 5)), staff);

        assertThat(stockOf(sofa)).isZero();
        assertThat(transactionsRecorded()).isEqualTo(before + 1);
    }

    @Test
    void shouldRecordTheSaleAndIgnoreTheLine_whenTheItemDoesNotExist() {
        int before = transactionsRecorded();
        FurnitureItem gone = FurnitureItem.builder().id(UUID.randomUUID()).name("Gone").build();

        transactionService.create(request("SALE", line(gone, 1)), staff);

        assertThat(transactionsRecorded()).isEqualTo(before + 1);
    }

    // ------------------------------------------------------------------ bad quantities (P0-11)

    @Test
    void shouldRefuseALineWithANegativeQuantity_andChangeNothing() {
        FurnitureItem sofa = newItem(5);
        int before = transactionsRecorded();

        assertThatThrownBy(() -> transactionService.create(request("SALE", line(sofa, -5)), staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("items[0].quantity");

        assertThat(stockOf(sofa)).isEqualTo(5);
        assertThat(transactionsRecorded()).isEqualTo(before);
    }

    @Test
    void shouldRefuseASaleWhenOneOfItsLinesIsBad_andLeaveTheOtherLinesAlone() {
        FurnitureItem sofa = newItem(5);
        FurnitureItem chair = newItem(5);

        assertThatThrownBy(() -> transactionService.create(request("SALE", line(sofa, 2), line(chair, 0)), staff))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(stockOf(sofa)).isEqualTo(5);
        assertThat(stockOf(chair)).isEqualTo(5);
    }

    @Test
    void shouldRefuseAHugeQuantity() {
        FurnitureItem sofa = newItem(5);

        assertThatThrownBy(() -> transactionService.create(request("PURCHASE", line(sofa, 2_000_000_000)), staff))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(stockOf(sofa)).isEqualTo(5);
    }

    // ------------------------------------------------------------------ two sales at the same moment (P1a-13)

    @Test
    void shouldNotLoseASale_whenTwoSalesOfTheSameItemAreRecordedAtTheSameMoment() throws Exception {
        FurnitureItem sofa = newItem(2);

        // Hold every read of the item back until both sales have got that far (or half a second has passed), so that a
        // sale which works from what it read would find the same picture as the other one and overwrite it.
        CountDownLatch bothHaveRead = new CountDownLatch(2);
        doAnswer(call -> {
            Optional<FurnitureItem> read = Optional.ofNullable(entityManager.find(FurnitureItem.class, call.getArgument(0)));
            bothHaveRead.countDown();
            bothHaveRead.await(500, TimeUnit.MILLISECONDS);
            return read;
        }).when(items).findById(any());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<?>> sales = new ArrayList<>();
            for (int n = 0; n < 2; n++) {
                sales.add(pool.submit(() -> {
                    go.await();
                    return transactionService.create(request("SALE", line(sofa, 1)), staff);
                }));
            }
            go.countDown();
            for (Future<?> sale : sales) sale.get(30, TimeUnit.SECONDS);

            assertThat(stockOf(sofa)).as("stock after two sales of one each").isZero();
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void shouldNotLoseASale_whenManySalesOfTheSameItemRunAtOnce() throws Exception {
        FurnitureItem sofa = newItem(20);

        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<?>> sales = new ArrayList<>();
            for (int n = 0; n < 16; n++) {
                sales.add(pool.submit(() -> {
                    go.await();
                    return transactionService.create(request("SALE", line(sofa, 1)), staff);
                }));
            }
            go.countDown();
            for (Future<?> sale : sales) sale.get(60, TimeUnit.SECONDS);

            assertThat(stockOf(sofa)).as("stock after sixteen sales of one each").isEqualTo(4);
        } finally {
            pool.shutdownNow();
        }
    }
}

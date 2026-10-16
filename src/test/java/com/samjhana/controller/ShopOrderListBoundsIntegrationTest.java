package com.samjhana.controller;

import com.samjhana.entity.ShopOrder;
import com.samjhana.entity.ShopOrderLine;
import com.samjhana.entity.User;
import com.samjhana.repository.ShopOrderRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding K-03: the staff online-orders list used to load the whole orders table, cut it to 300 afterwards, and
 * then ask the database for each order's lines one order at a time (about 300 extra questions per call, repeated
 * every 30 seconds by every open page). It must now read at most 300 orders and fetch their lines in a few
 * batches, while search still reaches orders older than the newest 300.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ShopOrderListBoundsIntegrationTest {

    private static final int SEEDED = 320;
    /** The seeded orders are dated tomorrow onwards, so they are the newest whatever else is in the database. */
    private static final LocalDateTime FIRST = LocalDateTime.now().plusDays(1).withNano(0);

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ShopOrderRepository orderRepository;
    @Autowired EntityManager entityManager;
    @Autowired EntityManagerFactory entityManagerFactory;
    @Autowired JdbcTemplate jdbcTemplate;

    private String staff;
    private Statistics statistics;

    @BeforeEach
    void setUp() {
        User user = userRepository.findByUsername("orders-staff").orElseGet(() -> userRepository.save(
                User.builder().username("orders-staff").passwordHash(passwordEncoder.encode("x"))
                        .fullName("orders-staff").fullNameNepali("orders-staff").role(User.UserRole.STAFF).build()));
        staff = "Bearer " + jwtUtil.generateToken(user);
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
    }

    private static String number(int i) {
        return String.format("LIST-%04d", i);
    }

    private ShopOrder order(String orderNumber, String name, String phone, ShopOrder.Status status, int lines) {
        ShopOrder o = new ShopOrder();
        o.setOrderNumber(orderNumber);
        o.setCustomerName(name);
        o.setCustomerPhone(phone);
        o.setFulfilment(ShopOrder.Fulfilment.PICKUP);
        o.setPaymentMethod(ShopOrder.PaymentMethod.PAY_AT_SHOP);
        o.setStatus(status);
        o.setSubtotal(new BigDecimal("100"));
        o.setTotal(new BigDecimal("100"));
        for (int l = 0; l < lines; l++) {
            ShopOrderLine line = new ShopOrderLine();
            line.setProductType("FURNITURE");
            line.setProductId(UUID.randomUUID());
            line.setProductSlug("item-" + l);
            line.setProductName("Item " + l);
            line.setUnitPrice(new BigDecimal("50"));
            line.setQuantity(1);
            line.setLineTotal(new BigDecimal("50"));
            o.addLine(line);
        }
        return o;
    }

    /** Saves the orders, gives order i the time FIRST + i seconds (so a higher number is newer), and forgets what was loaded. */
    private void seed(java.util.List<ShopOrder> orders) {
        orderRepository.saveAll(orders);
        entityManager.flush();
        for (int i = 0; i < orders.size(); i++) {
            jdbcTemplate.update("update shop_orders set created_at = ? where order_number = ?",
                    Timestamp.valueOf(FIRST.plusSeconds(i)), orders.get(i).getOrderNumber());
        }
        entityManager.clear();
        statistics.clear();
    }

    private java.util.List<ShopOrder> manyOrders() {
        java.util.List<ShopOrder> orders = new java.util.ArrayList<>();
        for (int i = 0; i < SEEDED; i++) {
            orders.add(order(number(i), "Customer " + i, "98000" + String.format("%05d", i), ShopOrder.Status.NEW, 2));
        }
        return orders;
    }

    @Test
    void shouldReturnOnlyTheNewest300Orders_newestFirst() throws Exception {
        seed(manyOrders());
        mockMvc.perform(get("/api/shop-orders").param("status", "ALL").header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(300))
                .andExpect(jsonPath("$[0].orderNumber").value(number(SEEDED - 1)))
                .andExpect(jsonPath("$[299].orderNumber").value(number(SEEDED - 300)))
                .andExpect(jsonPath("$[0].items.length()").value(2));
    }

    @Test
    void shouldNotReadMoreThan300OrdersFromTheDatabase() throws Exception {
        seed(manyOrders());
        mockMvc.perform(get("/api/shop-orders").param("status", "ALL").header("Authorization", staff)).andExpect(status().isOk());
        assertThat(statistics.getEntityStatistics(ShopOrder.class.getName()).getLoadCount()).isLessThanOrEqualTo(300);
    }

    @Test
    void shouldFetchTheLinesInAFewBatches_notOneQueryPerOrder() throws Exception {
        seed(manyOrders());
        mockMvc.perform(get("/api/shop-orders").param("status", "ALL").header("Authorization", staff)).andExpect(status().isOk());
        // one query for the orders, a few for their lines, a couple for the signed-in user; 300 orders used to mean 300+
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(15);
    }

    @Test
    void shouldAlsoBoundTheListOfOneStatus() throws Exception {
        seed(manyOrders());
        mockMvc.perform(get("/api/shop-orders").param("status", "NEW").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(300));
        assertThat(statistics.getEntityStatistics(ShopOrder.class.getName()).getLoadCount()).isLessThanOrEqualTo(300);
    }

    // ---- search must still reach the whole table, not only the newest 300 ----

    private java.util.List<ShopOrder> manyOrdersWithAnOldKnownOne() {
        java.util.List<ShopOrder> orders = manyOrders();
        orders.set(0, order(number(0), "Zed Findme", "9811100099", ShopOrder.Status.COMPLETED, 1));   // the oldest of all
        return orders;
    }

    @Test
    void shouldFindAnOrderOlderThanTheNewest300_bySearchingItsName() throws Exception {
        seed(manyOrdersWithAnOldKnownOne());
        mockMvc.perform(get("/api/shop-orders").param("search", "findme").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].orderNumber").value(number(0)));
        mockMvc.perform(get("/api/shop-orders").param("search", "  ZED FINDME ").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void shouldFindAnOrderOlderThanTheNewest300_bySearchingItsPhoneOrNumber() throws Exception {
        seed(manyOrdersWithAnOldKnownOne());
        mockMvc.perform(get("/api/shop-orders").param("search", "1110009").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].orderNumber").value(number(0)));
        mockMvc.perform(get("/api/shop-orders").param("search", "list-0000").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].orderNumber").value(number(0)));
    }

    @Test
    void shouldKeepTheStatusFilter_whenSearching() throws Exception {
        seed(manyOrdersWithAnOldKnownOne());
        mockMvc.perform(get("/api/shop-orders").param("status", "COMPLETED").param("search", "findme").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/shop-orders").param("status", "NEW").param("search", "findme").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void shouldReturnNoMoreThan300_whenASearchMatchesEverything() throws Exception {
        seed(manyOrders());
        mockMvc.perform(get("/api/shop-orders").param("search", "customer").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(300))
                .andExpect(jsonPath("$[0].orderNumber").value(number(SEEDED - 1)));
    }

    @Test
    void shouldTreatPercentAndUnderscoreInTheSearchAsPlainText() throws Exception {
        seed(java.util.List.of(
                order(number(1), "Hari", "9800000001", ShopOrder.Status.NEW, 1),
                order(number(2), "100% Real_Honey", "9800000002", ShopOrder.Status.NEW, 1)));
        mockMvc.perform(get("/api/shop-orders").param("search", "%").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].orderNumber").value(number(2)));
        mockMvc.perform(get("/api/shop-orders").param("search", "h_ri").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/shop-orders").param("search", "100% real_honey").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void shouldStillRefuseAnUnknownStatus() throws Exception {
        mockMvc.perform(get("/api/shop-orders").param("status", "BOGUS").header("Authorization", staff))
                .andExpect(status().isBadRequest());
    }
}

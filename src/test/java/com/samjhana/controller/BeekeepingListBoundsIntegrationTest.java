package com.samjhana.controller;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.TransactionRepository;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding K-02: the beekeeping dashboard and order list used to read the shop's whole transaction history (every
 * row with its full stored JSON) on each visit. They must now read a handful of rows: the dashboard counts today's
 * sales in the database and loads the five newest orders, and the order list returns one page at a time.
 *
 * <p>Order i (0 = newest) is dated three to a day going back from today, so orders 0, 1 and 2 are today's. Order
 * i has the amount 100 + i. Order 0 also carries 100 KB of extra text that must never reach a response.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class BeekeepingListBoundsIntegrationTest {

    private static final int SEEDED = 210;
    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Kathmandu"));

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired EntityManager entityManager;
    @Autowired EntityManagerFactory entityManagerFactory;
    @Autowired JdbcTemplate jdbcTemplate;

    private String staff;
    private User staffUser;
    private BusinessUnit beekeeping;
    private Statistics statistics;

    @BeforeEach
    void setUp() {
        staffUser = userRepository.findByUsername("bee-list-staff").orElseGet(() -> userRepository.save(
                User.builder().username("bee-list-staff").passwordHash(passwordEncoder.encode("x"))
                        .fullName("Bee Staff").fullNameNepali("Bee Staff").role(User.UserRole.STAFF).build()));
        staff = "Bearer " + jwtUtil.generateToken(staffUser);
        beekeeping = businessUnitRepository.findByCode("beekeeping").orElseGet(() -> businessUnitRepository.save(
                BusinessUnit.builder().code("beekeeping").name("Beekeeping Shop").nameNepali("मौरीपालन पसल")
                        .calculationStrategy("BeekeepingStrategy").build()));
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
    }

    private String fields(String customerName, String extra) {
        return "{\"customerName\":\"" + customerName + "\",\"customerPhone\":\"9800000000\",\"paymentMethod\":\"CASH\""
                + extra + ",\"items\":[{\"itemId\":\"p1\",\"itemName\":\"Wild Honey\",\"quantity\":1,\"unitPrice\":100,\"total\":100}]}";
    }

    /** Saves {@code SEEDED} orders (order i dated TODAY minus i/3 days, amount 100 + i) and forgets what was loaded. */
    private void seed(String oldestCustomerName) {
        List<Transaction> rows = new ArrayList<>();
        for (int i = 0; i < SEEDED; i++) {
            String name = (i == SEEDED - 1 && oldestCustomerName != null) ? oldestCustomerName : "Customer " + i;
            String extra = i == 0 ? ",\"junk\":\"" + "x".repeat(100_000) + "\"" : "";
            rows.add(Transaction.builder().business(beekeeping).enteredBy(staffUser)
                    .transactionType(Transaction.TransactionType.SALE).transactionDate(TODAY.minusDays(i / 3))
                    .amount(new BigDecimal(100 + i)).customFields(fields(name, extra)).build());
        }
        transactionRepository.saveAll(rows);
        entityManager.flush();
        LocalDateTime base = LocalDateTime.now().minusMinutes(10);
        for (int i = 0; i < rows.size(); i++) {
            jdbcTemplate.update("update transactions set created_at = ? where id = ?",
                    Timestamp.valueOf(base.minusSeconds(i)), rows.get(i).getId());
        }
        entityManager.clear();
        statistics.clear();
    }

    private long transactionsRead() {
        return statistics.getEntityStatistics(Transaction.class.getName()).getLoadCount();
    }

    // ---- dashboard ----

    @Test
    void shouldCountTodaysSalesInTheDatabase_forTheDashboard() throws Exception {
        seed(null);
        mockMvc.perform(get("/api/beekeeping/dashboard").header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todaySalesCount").value(3))
                .andExpect(jsonPath("$.todayRevenue").value(303));
    }

    @Test
    void shouldReadOnlyTheFiveNewestOrders_forTheDashboard() throws Exception {
        seed(null);
        mockMvc.perform(get("/api/beekeeping/dashboard").header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recentOrders.length()").value(5))
                .andExpect(jsonPath("$.recentOrders[0].customerName").value("Customer 0"))
                .andExpect(jsonPath("$.recentOrders[4].customerName").value("Customer 4"))
                .andExpect(content().string(not(containsString("junk"))));
        assertThat(transactionsRead()).isLessThanOrEqualTo(5);
    }

    @Test
    void shouldAskTheDatabaseOnlyAFewQuestions_forTheDashboard() throws Exception {
        seed(null);
        mockMvc.perform(get("/api/beekeeping/dashboard").header("Authorization", staff)).andExpect(status().isOk());
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(12);
    }

    // ---- order list ----

    @Test
    void shouldReturnTheNewest50Orders_whenNoPageIsAskedFor() throws Exception {
        seed(null);
        mockMvc.perform(get("/api/beekeeping/orders").header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(50))
                .andExpect(jsonPath("$[0].customerName").value("Customer 0"))
                .andExpect(jsonPath("$[49].customerName").value("Customer 49"))
                .andExpect(jsonPath("$[0].items[0].itemName").value("Wild Honey"))
                .andExpect(content().string(not(containsString("junk"))));
        assertThat(transactionsRead()).isLessThanOrEqualTo(50);
    }

    @Test
    void shouldReturnTheNextPage_whenAskedFor() throws Exception {
        seed(null);
        mockMvc.perform(get("/api/beekeeping/orders").param("page", "1").param("size", "100").header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(100))
                .andExpect(jsonPath("$[0].customerName").value("Customer 100"));
        mockMvc.perform(get("/api/beekeeping/orders").param("page", "2").param("size", "100").header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(SEEDED - 200))
                .andExpect(jsonPath("$[0].customerName").value("Customer 200"));
        mockMvc.perform(get("/api/beekeeping/orders").param("page", "3").param("size", "100").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void shouldNeverReturnMoreThan200OrdersAtOnce() throws Exception {
        seed(null);
        mockMvc.perform(get("/api/beekeeping/orders").param("size", "1000").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(200));
        assertThat(transactionsRead()).isLessThanOrEqualTo(200);
    }

    @Test
    void shouldFallBackToTheFirstPage_whenThePageOrSizeIsNotUsable() throws Exception {
        seed(null);
        for (String bad : new String[]{"-3", "abc", "", "1.5"}) {
            mockMvc.perform(get("/api/beekeeping/orders").param("page", bad).param("size", bad).header("Authorization", staff))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(50))
                    .andExpect(jsonPath("$[0].customerName").value("Customer 0"));
        }
    }

    @Test
    void shouldFindAnOlderOrderByCustomerName_withinTheNewest500() throws Exception {
        seed("Zed Findme");
        mockMvc.perform(get("/api/beekeeping/orders").param("search", "findme").header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].customerName").value("Zed Findme"));
        mockMvc.perform(get("/api/beekeeping/orders").param("search", "findme").param("page", "1").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void shouldRequireLogin_forTheOrderList() throws Exception {
        mockMvc.perform(get("/api/beekeeping/orders")).andExpect(status().isUnauthorized());
    }
}

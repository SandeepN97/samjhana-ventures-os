package com.samjhana.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding K-01: every petrol sale used to load the pump's whole petrol history (sales, purchases, rejected rows, with
 * their stored JSON) just to find what the pump last paid per litre. It must now read one small page of purchases,
 * and still choose the newest purchase of the right fuel that was not rejected.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PetrolPurchaseRateLookupIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Kathmandu"));

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired EntityManager entityManager;
    @Autowired EntityManagerFactory entityManagerFactory;
    @Autowired ObjectMapper objectMapper;

    private String staff;
    private User staffUser;
    private BusinessUnit petrol;
    private Statistics statistics;

    @BeforeEach
    void setUp() {
        staffUser = userRepository.findByUsername("pump-staff").orElseGet(() -> userRepository.save(
                User.builder().username("pump-staff").passwordHash(passwordEncoder.encode("x"))
                        .fullName("Pump Staff").fullNameNepali("Pump Staff").role(User.UserRole.STAFF).build()));
        staff = "Bearer " + jwtUtil.generateToken(staffUser);
        petrol = businessUnitRepository.findByCode("petrol").orElseGet(() -> businessUnitRepository.save(
                BusinessUnit.builder().code("petrol").name("Petrol Pump").nameNepali("पेट्रोल पम्प")
                        .calculationStrategy("PetrolStrategy").build()));
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
    }

    private Transaction row(Transaction.TransactionType type, Transaction.TransactionStatus status, int daysAgo, String fields) {
        return Transaction.builder().business(petrol).enteredBy(staffUser).transactionType(type)
                .transactionDate(TODAY.minusDays(daysAgo)).amount(new BigDecimal("1000")).status(status).customFields(fields).build();
    }

    private static String fuel(String fuelType, String rate, String extra) {
        return "{\"fuelType\":\"" + fuelType + "\",\"liters\":10,\"ratePerLiter\":" + rate + extra + "}";
    }

    /**
     * 90 sales with 20 KB of extra text each, then 30 purchases: a rejected petrol purchase at 999 (the newest), a petrol
     * purchase at 158.5, and older purchases of petrol at 100 and of diesel at 150. Forgets what was loaded afterwards.
     */
    private void seedHistory() {
        List<Transaction> rows = new ArrayList<>();
        String junk = ",\"junk\":\"" + "x".repeat(20_000) + "\"";
        for (int i = 0; i < 90; i++) {
            rows.add(row(Transaction.TransactionType.SALE, Transaction.TransactionStatus.APPROVED, 10 + i % 30, fuel("petrol", "170", junk)));
        }
        rows.add(row(Transaction.TransactionType.PURCHASE, Transaction.TransactionStatus.REJECTED, 1, fuel("petrol", "999", "")));
        rows.add(row(Transaction.TransactionType.PURCHASE, Transaction.TransactionStatus.APPROVED, 2, fuel("petrol", "158.5", "")));
        for (int i = 0; i < 28; i++) {
            rows.add(row(Transaction.TransactionType.PURCHASE, Transaction.TransactionStatus.APPROVED, 5 + i,
                    i % 2 == 0 ? fuel("diesel", "150", "") : fuel("petrol", "100", "")));
        }
        transactionRepository.saveAll(rows);
        entityManager.flush();
        entityManager.clear();
        statistics.clear();
    }

    private MvcResult sellPetrol() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("businessCode", "petrol", "transactionType", "SALE",
                "amount", 1700, "transactionDate", TODAY.toString(),
                "customFields", Map.of("fuelType", "petrol", "liters", 10, "ratePerLiter", 170)));
        return mockMvc.perform(post("/api/transactions").header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk()).andReturn();
    }

    private Map<String, Object> storedFieldsOfTheSale(MvcResult result) throws Exception {
        UUID id = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
        entityManager.flush();
        entityManager.clear();
        return objectMapper.readValue(transactionRepository.findById(id).orElseThrow().getCustomFields(),
                new TypeReference<Map<String, Object>>() {});
    }

    @Test
    void shouldReadOnlyOnePageOfPurchases_whenAPetrolSaleIsEntered() throws Exception {
        seedHistory();
        sellPetrol();
        assertThat(statistics.getEntityStatistics(Transaction.class.getName()).getLoadCount()).isLessThanOrEqualTo(25);
    }

    @Test
    void shouldStoreTheRateOfTheNewestPurchaseOfThatFuelThatWasNotRejected() throws Exception {
        seedHistory();
        MvcResult result = sellPetrol();
        Map<String, Object> stored = storedFieldsOfTheSale(result);
        assertThat(new BigDecimal(stored.get("purchaseRate").toString())).isEqualByComparingTo("158.5");
    }

    @Test
    void shouldHideThePurchaseRateFromStaff_inTheResponse() throws Exception {
        seedHistory();
        String response = sellPetrol().getResponse().getContentAsString();
        assertThat(response).doesNotContain("purchaseRate").doesNotContain("158.5");
    }

    @Test
    void shouldSaveTheSaleWithoutACost_whenThePumpHasNeverBoughtThatFuel() throws Exception {
        MvcResult result = sellPetrol();
        assertThat(storedFieldsOfTheSale(result)).doesNotContainKey("purchaseRate");
    }
}

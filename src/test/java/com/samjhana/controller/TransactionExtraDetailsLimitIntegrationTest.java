package com.samjhana.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import jakarta.persistence.EntityManager;
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

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding F-06: the extra details on an entry used to have no size limit, so a STAFF login could store megabyte-sized
 * blobs in an ordinary sale (the row is stored twice, with its audit copy, and read by many screens). Through the real
 * routes, an oversized entry or edit must answer 400 and change nothing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TransactionExtraDetailsLimitIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Kathmandu"));

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired EntityManager entityManager;
    @Autowired ObjectMapper objectMapper;

    private String staff;
    private String manager;

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    @BeforeEach
    void setUp() {
        staff = bearer("extra-staff", User.UserRole.STAFF);
        manager = bearer("extra-manager", User.UserRole.MANAGER);
        if (businessUnitRepository.findByCode("petrol").isEmpty()) {
            businessUnitRepository.save(BusinessUnit.builder().code("petrol").name("Petrol Pump").nameNepali("पेट्रोल पम्प")
                    .calculationStrategy("PetrolStrategy").build());
        }
    }

    private String petrolSale(String note) throws Exception {
        Map<String, Object> fields = new LinkedHashMap<>(Map.of("fuelType", "petrol", "liters", 10, "ratePerLiter", 170));
        if (note != null) fields.put("note", note);
        return objectMapper.writeValueAsString(Map.of("businessCode", "petrol", "transactionType", "SALE",
                "amount", 1700, "transactionDate", TODAY.toString(), "customFields", fields));
    }

    private MvcResult createAs(String token, String body) throws Exception {
        return mockMvc.perform(post("/api/transactions").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
    }

    @Test
    void shouldRefuseAnOrdinarySaleCarrying100KBOfExtraText_andStoreNothing() throws Exception {
        long rows = transactionRepository.count();
        long audits = auditLogRepository.count();

        mockMvc.perform(post("/api/transactions").header("Authorization", staff)
                        .contentType(MediaType.APPLICATION_JSON).content(petrolSale("x".repeat(100_000))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("too large")));

        assertThat(transactionRepository.count()).isEqualTo(rows);
        assertThat(auditLogRepository.count()).isEqualTo(audits);
    }

    @Test
    void shouldStillAcceptAnOrdinarySale() throws Exception {
        long rows = transactionRepository.count();

        mockMvc.perform(post("/api/transactions").header("Authorization", staff)
                        .contentType(MediaType.APPLICATION_JSON).content(petrolSale("paid in cash")))
                .andExpect(status().isOk());

        assertThat(transactionRepository.count()).isEqualTo(rows + 1);
    }

    @Test
    void shouldRefuseAManagersEditThatAddsA100KBBlob_andKeepTheOldDetails() throws Exception {
        MvcResult created = createAs(manager, petrolSale("first"));
        UUID id = UUID.fromString(objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText());
        String before = transactionRepository.findById(id).orElseThrow().getCustomFields();

        mockMvc.perform(put("/api/transactions/" + id).header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content(petrolSale("x".repeat(100_000))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("too large")));

        entityManager.flush();
        entityManager.clear();
        Transaction after = transactionRepository.findById(id).orElseThrow();
        assertThat(after.getCustomFields()).isEqualTo(before);
    }
}

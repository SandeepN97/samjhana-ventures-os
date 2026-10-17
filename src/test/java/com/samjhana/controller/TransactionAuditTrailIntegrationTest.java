package com.samjhana.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Findings P0-03 and P1b-03, through the real routes: a manager's edit, approval or rejection leaves an audit row that
 * holds the figures and the status as they were and as they became, and an edit is refused when it would give an
 * entry an amount of zero.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TransactionAuditTrailIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Kathmandu"));

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired ObjectMapper objectMapper;

    private String manager;

    @BeforeEach
    void setUp() {
        User user = userRepository.findByUsername("audit-manager").orElseGet(() -> userRepository.save(
                User.builder().username("audit-manager").passwordHash(passwordEncoder.encode("x"))
                        .fullName("audit-manager").fullNameNepali("audit-manager").role(User.UserRole.MANAGER).build()));
        manager = "Bearer " + jwtUtil.generateToken(user);
        if (businessUnitRepository.findByCode("petrol").isEmpty()) {
            businessUnitRepository.save(BusinessUnit.builder().code("petrol").name("Petrol Pump").nameNepali("पेट्रोल पम्प")
                    .calculationStrategy("PetrolStrategy").build());
        }
    }

    private String sale(Object amount, String note) throws Exception {
        return objectMapper.writeValueAsString(Map.of("businessCode", "petrol", "transactionType", "SALE",
                "amount", amount, "transactionDate", TODAY.toString(), "notes", note,
                "customFields", Map.of("fuelType", "petrol", "liters", 10, "ratePerLiter", 170)));
    }

    private UUID createSale() throws Exception {
        String body = mockMvc.perform(post("/api/transactions").header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content(sale(1700, "first")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(body).get("id").asText());
    }

    private List<AuditLog> auditRows(UUID id, AuditLog.AuditAction action) {
        return auditLogRepository.findAll().stream()
                .filter(a -> id.equals(a.getEntityId()) && a.getAction() == action).toList();
    }

    @Test
    void shouldKeepTheOldAndNewAmount_whenAManagerEditsASale() throws Exception {
        UUID id = createSale();

        mockMvc.perform(put("/api/transactions/{id}", id).header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content(sale(10, "changed after the cash was counted")))
                .andExpect(status().isOk());

        List<AuditLog> rows = auditRows(id, AuditLog.AuditAction.UPDATE);
        assertThat(rows).hasSize(1);
        JsonNode before = objectMapper.readTree(rows.get(0).getOldValues());
        JsonNode after = objectMapper.readTree(rows.get(0).getNewValues());
        assertThat(before.get("amount").asText()).isEqualTo("1700");
        assertThat(before.get("notes").asText()).isEqualTo("first");
        assertThat(before.get("customFields").get("liters").asInt()).isEqualTo(10);
        assertThat(after.get("amount").asText()).isEqualTo("10");
        assertThat(after.get("notes").asText()).isEqualTo("changed after the cash was counted");
        assertThat(rows.get(0).getDescription()).isEqualTo("Updated transaction (changed: amount, notes)");
        assertThat(rows.get(0).getUser().getUsername()).isEqualTo("audit-manager");
    }

    @Test
    void shouldRefuseAnEditToAnAmountOfZero_andChangeNothing() throws Exception {
        UUID id = createSale();
        long rowsBefore = auditLogRepository.count();

        mockMvc.perform(put("/api/transactions/{id}", id).header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content(sale(0, "zero")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Amount must be greater than zero")));

        assertThat(auditLogRepository.count()).isEqualTo(rowsBefore);
        mockMvc.perform(put("/api/transactions/{id}", id).header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content(sale(1700, "still fine")))
                .andExpect(status().isOk());
    }

    @Test
    void shouldKeepThePreviousStatusAndTheReason_whenAManagerRejectsASale() throws Exception {
        UUID id = createSale();

        mockMvc.perform(patch("/api/transactions/{id}/reject", id).header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"entered twice\"}"))
                .andExpect(status().isOk());

        List<AuditLog> rows = auditRows(id, AuditLog.AuditAction.REJECT);
        assertThat(rows).hasSize(1);
        JsonNode before = objectMapper.readTree(rows.get(0).getOldValues());
        JsonNode after = objectMapper.readTree(rows.get(0).getNewValues());
        assertThat(before.get("status").asText()).isEqualTo("APPROVED");
        assertThat(before.get("amount").asText()).isEqualTo("1700");
        assertThat(after.get("status").asText()).isEqualTo("REJECTED");
        assertThat(after.get("reviewNotes").asText()).isEqualTo("entered twice");
        assertThat(after.get("reviewedBy").asText()).isEqualTo("audit-manager");
    }

    @Test
    void shouldKeepEveryRejectionReason_whenTheSameSaleIsRejectedAndApprovedAgain() throws Exception {
        UUID id = createSale();
        mockMvc.perform(patch("/api/transactions/{id}/reject", id).header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"first reason\"}")).andExpect(status().isOk());
        mockMvc.perform(patch("/api/transactions/{id}/approve", id).header("Authorization", manager)).andExpect(status().isOk());
        mockMvc.perform(patch("/api/transactions/{id}/reject", id).header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"second reason\"}")).andExpect(status().isOk());

        List<String> reasons = auditRows(id, AuditLog.AuditAction.REJECT).stream().map(a -> {
            try { return objectMapper.readTree(a.getNewValues()).get("reviewNotes").asText(); }
            catch (Exception e) { throw new IllegalStateException(e); }
        }).toList();
        assertThat(reasons).containsExactlyInAnyOrder("first reason", "second reason");
        JsonNode approval = objectMapper.readTree(auditRows(id, AuditLog.AuditAction.APPROVE).get(0).getOldValues());
        assertThat(approval.get("status").asText()).isEqualTo("REJECTED");
        assertThat(approval.get("reviewNotes").asText()).isEqualTo("first reason");
    }
}

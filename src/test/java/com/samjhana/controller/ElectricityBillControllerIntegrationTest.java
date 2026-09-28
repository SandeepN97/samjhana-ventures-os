package com.samjhana.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.User;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * NEA electricity bills and the profit worked out from them are business-sensitive, like the
 * nea_rate setting: staff must not be able to read them through the API.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ElectricityBillControllerIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ObjectMapper mapper;

    private String billId;

    @BeforeEach
    void bill() throws Exception {
        String body = mockMvc.perform(post("/api/ev/electricity-bills")
                        .header("Authorization", bearerFor("bill-manager", User.UserRole.MANAGER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"periodStart\":\"2026-08-01\",\"periodEnd\":\"2026-08-31\","
                                + "\"billedKwh\":1500,\"amountPaid\":18000,\"referenceNumber\":\"NEA-1\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        billId = mapper.readTree(body).get("id").asText();
    }

    private String bearerFor(String username, User.UserRole role) {
        if (userRepository.findByUsername(username).isEmpty()) {
            userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                    .fullName(username).fullNameNepali(username).role(role).build());
        }
        return "Bearer " + jwtUtil.generateToken(userRepository.findByUsername(username).orElseThrow());
    }

    @Test
    void shouldRefuseStaff_whenListingElectricityBills() throws Exception {
        mockMvc.perform(get("/api/ev/electricity-bills").header("Authorization", bearerFor("bill-staff", User.UserRole.STAFF)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$[0]").doesNotExist());
    }

    @Test
    void shouldRefuseStaff_whenOpeningTheProfitReconciliation() throws Exception {
        mockMvc.perform(get("/api/ev/electricity-bills/" + billId + "/reconciliation")
                        .header("Authorization", bearerFor("bill-staff", User.UserRole.STAFF)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.profit").doesNotExist())
                .andExpect(jsonPath("$.electricityCost").doesNotExist());
    }

    @Test
    void shouldShowBillsAndReconciliation_whenUserIsAManager() throws Exception {
        String manager = bearerFor("bill-manager", User.UserRole.MANAGER);
        mockMvc.perform(get("/api/ev/electricity-bills").header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].referenceNumber").value("NEA-1"));
        mockMvc.perform(get("/api/ev/electricity-bills/" + billId + "/reconciliation").header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.electricityCost").value(18000))
                .andExpect(jsonPath("$.profit").exists());
    }

    @Test
    void shouldShowBills_whenUserIsAnAdmin() throws Exception {
        mockMvc.perform(get("/api/ev/electricity-bills").header("Authorization", bearerFor("bill-admin", User.UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].amountPaid").value(18000));
    }

    @Test
    void shouldRequireLogin_forElectricityBills() throws Exception {
        mockMvc.perform(get("/api/ev/electricity-bills")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/ev/electricity-bills/" + billId + "/reconciliation")).andExpect(status().isUnauthorized());
    }
}

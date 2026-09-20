package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Approving, rejecting and editing transactions is for managers and admins only. An unknown id
 * (404) proves the caller got past authorisation; 401/403 must arrive before any lookup happens.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TransactionReviewSecurityIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private final String unknownId = UUID.randomUUID().toString();

    private String bearerFor(String username, User.UserRole role) {
        if (userRepository.findByUsername(username).isEmpty()) {
            userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                    .fullName(username).fullNameNepali(username).role(role).build());
        }
        return "Bearer " + jwtUtil.generateToken(username);
    }

    @Test
    void shouldReturn401_whenApprovingWithoutLoggingIn() throws Exception {
        mockMvc.perform(patch("/api/transactions/{id}/approve", unknownId)).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldReturn401_whenRejectingWithoutLoggingIn() throws Exception {
        mockMvc.perform(patch("/api/transactions/{id}/reject", unknownId)).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldReturn403BeforeAnyLookup_whenStaffApproves() throws Exception {
        mockMvc.perform(patch("/api/transactions/{id}/approve", unknownId)
                        .header("Authorization", bearerFor("tx-staff", User.UserRole.STAFF)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn403BeforeAnyLookup_whenStaffRejects() throws Exception {
        mockMvc.perform(patch("/api/transactions/{id}/reject", unknownId)
                        .header("Authorization", bearerFor("tx-staff", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"no\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn403_whenStaffEditsATransaction() throws Exception {
        mockMvc.perform(put("/api/transactions/{id}", unknownId)
                        .header("Authorization", bearerFor("tx-staff", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReachTheServiceAndReturn404_whenAManagerApprovesAnUnknownTransaction() throws Exception {
        mockMvc.perform(patch("/api/transactions/{id}/approve", unknownId)
                        .header("Authorization", bearerFor("tx-manager", User.UserRole.MANAGER)))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldReachTheServiceAndReturn404_whenAnAdminRejectsAnUnknownTransaction() throws Exception {
        mockMvc.perform(patch("/api/transactions/{id}/reject", unknownId)
                        .header("Authorization", bearerFor("tx-admin", User.UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"duplicate\"}"))
                .andExpect(status().isNotFound());
    }
}

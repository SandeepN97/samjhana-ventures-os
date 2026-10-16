package com.samjhana.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding A-01: the ceiling is for the open login endpoint. Someone who is already signed in can still change their own
 * password while the ceiling is used up, and doing so does not use any of it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "samjhana.security.login.global-per-minute=3")
@Transactional
class ChangePasswordCeilingIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @Test
    void shouldLetASignedInUserChangeTheirPassword_whenTheLoginCeilingIsUsedUp() throws Exception {
        User user = userRepository.save(User.builder().username("ceil-cp").passwordHash(passwordEncoder.encode("old-password-1"))
                .fullName("c").fullNameNepali("c").role(User.UserRole.STAFF).isActive(true).build());
        String token = "Bearer " + jwtUtil.generateToken(user);
        for (int i = 0; i < 3; i++) {   // use up the three logins a minute
            mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"username\":\"made-up-" + i + "\",\"password\":\"guess\"}")).andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"another\",\"password\":\"guess\"}")).andExpect(status().isTooManyRequests());

        mockMvc.perform(post("/api/auth/change-password").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("currentPassword", "old-password-1", "newPassword", "new-password-22"))))
                .andExpect(status().isOk());
    }
}

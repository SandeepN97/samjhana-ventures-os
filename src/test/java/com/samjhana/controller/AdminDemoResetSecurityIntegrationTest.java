package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The demo reset bean only exists in dev and staging. Under any other profile (here: test, standing in
 * for prod) the endpoint must answer 404 and report the feature as unavailable, so a stray tap or a
 * stolen admin token can never wipe real data.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminDemoResetSecurityIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private String bearerFor(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    @Test
    void shouldReturn404_whenAdminResetsOutsideDevAndStaging() throws Exception {
        mockMvc.perform(post("/api/admin/demo-reset").header("Authorization", bearerFor("reset-admin", User.UserRole.ADMIN)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Demo reset is not available in this environment"));
    }

    @Test
    void shouldReportDemoResetUnavailable_whenOutsideDevAndStaging() throws Exception {
        mockMvc.perform(get("/api/admin/features").header("Authorization", bearerFor("reset-admin", User.UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.demoReset").value(false));
    }

    @Test
    void shouldReturn403_whenManagerResets() throws Exception {
        mockMvc.perform(post("/api/admin/demo-reset").header("Authorization", bearerFor("reset-mgr", User.UserRole.MANAGER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn403_whenStaffAsksForAdminFeatures() throws Exception {
        mockMvc.perform(get("/api/admin/features").header("Authorization", bearerFor("reset-staff", User.UserRole.STAFF)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn401_whenResettingWithoutLoggingIn() throws Exception {
        mockMvc.perform(post("/api/admin/demo-reset")).andExpect(status().isUnauthorized());
    }
}

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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Wrong current passwords on /api/auth/change-password count towards the same limit as wrong
 * logins (10 per 15 minutes per account), so a stolen token can't be used to keep guessing the
 * real password. Every test uses fresh usernames: the limit is kept in memory for the whole run.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ChangePasswordThrottleIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private User createUser(String prefix, User.UserRole role, String password) {
        String username = prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
        return userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode(password))
                .fullName(username).fullNameNepali(username).role(role).build());
    }

    private ResultActions changePassword(User caller, String username, String current, String next) throws Exception {
        Map<String, String> body = new HashMap<>();
        if (username != null) body.put("username", username);
        body.put("currentPassword", current);
        body.put("newPassword", next);
        return mockMvc.perform(post("/api/auth/change-password")
                .header("Authorization", "Bearer " + jwtUtil.generateToken(caller))
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)));
    }

    private ResultActions login(String username, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("username", username, "password", password))));
    }

    private boolean passwordIs(User user, String plaintext) {
        return passwordEncoder.matches(plaintext, userRepository.findById(user.getId()).orElseThrow().getPassword());
    }

    @Test
    void shouldRefuseEvenTheRightPassword_afterTenWrongGuesses() throws Exception {
        User staff = createUser("cpt-staff", User.UserRole.STAFF, "real-password-1");
        for (int i = 0; i < 10; i++) {
            changePassword(staff, null, "guess-" + i, "new-password-2").andExpect(status().isBadRequest());
        }

        changePassword(staff, null, "real-password-1", "new-password-2")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Too many wrong passwords. Try again in 15 minutes."));

        assertTrue(passwordIs(staff, "real-password-1"));
    }

    @Test
    void shouldStillAcceptTheRightPassword_afterNineWrongGuesses() throws Exception {
        User staff = createUser("cpt-staff", User.UserRole.STAFF, "real-password-1");
        for (int i = 0; i < 9; i++) {
            changePassword(staff, null, "guess-" + i, "new-password-2").andExpect(status().isBadRequest());
        }

        changePassword(staff, null, "real-password-1", "new-password-2").andExpect(status().isOk());

        assertTrue(passwordIs(staff, "new-password-2"));
    }

    @Test
    void shouldAlsoBlockLogin_whenTheGuessesCameThroughChangePassword() throws Exception {
        User staff = createUser("cpt-staff", User.UserRole.STAFF, "real-password-1");
        for (int i = 0; i < 10; i++) {
            changePassword(staff, null, "guess-" + i, "new-password-2");
        }

        login(staff.getUsername(), "real-password-1").andExpect(status().isTooManyRequests());
    }

    @Test
    void shouldCountWrongLogins_towardsTheChangePasswordLimit() throws Exception {
        User staff = createUser("cpt-staff", User.UserRole.STAFF, "real-password-1");
        for (int i = 0; i < 10; i++) {
            login(staff.getUsername(), "guess-" + i).andExpect(status().isUnauthorized());
        }

        changePassword(staff, null, "real-password-1", "new-password-2").andExpect(status().isTooManyRequests());
    }

    @Test
    void shouldLimitAnAdminTheSameWay_whetherTheNamedUserExistsOrNot() throws Exception {
        User admin = createUser("cpt-admin", User.UserRole.ADMIN, "admin-password-1");
        User target = createUser("cpt-target", User.UserRole.STAFF, "target-password-1");
        String unknown = "cpt-nobody-" + UUID.randomUUID().toString().substring(0, 8);
        for (int i = 0; i < 10; i++) {
            changePassword(admin, target.getUsername(), "guess-" + i, "reset-password-9").andExpect(status().isBadRequest());
            changePassword(admin, unknown, "guess-" + i, "reset-password-9").andExpect(status().isBadRequest());
        }

        changePassword(admin, target.getUsername(), "target-password-1", "reset-password-9")
                .andExpect(status().isTooManyRequests());
        changePassword(admin, unknown, "anything", "reset-password-9").andExpect(status().isTooManyRequests());
        assertTrue(passwordIs(target, "target-password-1"));
        // The admin's own account is not the one being guessed, so it is not locked.
        login(admin.getUsername(), "admin-password-1").andExpect(status().isOk());
    }
}

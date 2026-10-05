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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * With the per-address limits switched ON: an attacker's address is blocked, the real owner on another
 * address is not, spraying many usernames from one address is stopped, and a faked forwarding header
 * does not help. Each test uses its own usernames and addresses because the counters live in memory.
 */
@SpringBootTest(properties = "samjhana.security.login.ip-limits-enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class LoginAddressLimitsIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JwtUtil jwtUtil;

    private User create(String username, String password, User.UserRole role) {
        return userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode(password))
                .fullName(username).fullNameNepali(username).role(role).isActive(true).build());
    }

    private ResultActions login(String username, String password, String forwardedFor) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .header("X-Forwarded-For", forwardedFor)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"));
    }

    @Test
    void shouldBlockTheAttackerButNotTheRealOwner_onAnotherAddress() throws Exception {
        create("al-owner", "right-password-1", User.UserRole.ADMIN);
        for (int i = 0; i < 5; i++) {
            login("al-owner", "guess-" + i, "198.51.100.21").andExpect(status().isUnauthorized());
        }

        login("al-owner", "right-password-1", "198.51.100.21").andExpect(status().isTooManyRequests());
        login("al-owner", "right-password-1", "203.0.113.21").andExpect(status().isOk());
    }

    @Test
    void shouldStopAnAddress_thatSpraysManyUsernames() throws Exception {
        create("al-victim", "right-password-2", User.UserRole.STAFF);
        for (int i = 0; i < 30; i++) {
            login("al-nobody-" + i, "guess", "198.51.100.22").andExpect(status().isUnauthorized());
        }

        login("al-victim", "right-password-2", "198.51.100.22")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Too many wrong passwords. Try again in 15 minutes."));
        login("al-victim", "right-password-2", "203.0.113.22").andExpect(status().isOk());
    }

    @Test
    void shouldNotLetAFakedLeftHandAddressDodgeTheLimit() throws Exception {
        create("al-faked", "right-password-3", User.UserRole.STAFF);
        for (int i = 0; i < 5; i++) {
            login("al-faked", "guess-" + i, "9.9.9." + i + ", 198.51.100.23").andExpect(status().isUnauthorized());
        }

        login("al-faked", "right-password-3", "1.1.1.1, 198.51.100.23").andExpect(status().isTooManyRequests());
    }

    @Test
    void shouldLogInNormally_afterAFewMistakes() throws Exception {
        create("al-typo", "right-password-4", User.UserRole.STAFF);
        for (int i = 0; i < 3; i++) login("al-typo", "typo-" + i, "198.51.100.24").andExpect(status().isUnauthorized());

        login("al-typo", "right-password-4", "198.51.100.24").andExpect(status().isOk());
    }

    @Test
    void shouldLetAnAdminSeeTheAddressTheServerSees() throws Exception {
        User admin = create("al-admin", "x", User.UserRole.ADMIN);

        mockMvc.perform(get("/api/auth/my-address")
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(admin))
                        .header("X-Forwarded-For", "9.9.9.9, 198.51.100.25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resolvedAddress").value("198.51.100.25"))
                .andExpect(jsonPath("$.forwardedFor").value("9.9.9.9, 198.51.100.25"))
                .andExpect(jsonPath("$.trustedProxyHops").value(0))
                .andExpect(jsonPath("$.addressLimitsEnabled").value(true));
    }

    @Test
    void shouldRefuseTheAddressPageToAManager() throws Exception {
        User manager = create("al-manager", "x", User.UserRole.MANAGER);

        mockMvc.perform(get("/api/auth/my-address").header("Authorization", "Bearer " + jwtUtil.generateToken(manager)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldRefuseTheAddressPage_whenNotLoggedIn() throws Exception {
        mockMvc.perform(get("/api/auth/my-address")).andExpect(status().isUnauthorized());
    }
}

package com.samjhana.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A token must stop working as soon as the account is deactivated or its password changes, not when
 * it expires days later. Runs through the real security filter chain.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TokenRevocationIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ObjectMapper objectMapper;
    @Value("${samjhana.security.jwt.secret}") String secret;

    private User create(String username, User.UserRole role, String password) {
        return userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode(password))
                .fullName(username).fullNameNepali(username).role(role).isActive(true).build());
    }

    @Test
    void shouldAcceptTheToken_whenTheAccountIsActiveAndUnchanged() throws Exception {
        User staff = create("rv-active", User.UserRole.STAFF, "password-1");
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + jwtUtil.generateToken(staff)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldRejectAnExistingToken_whenTheAdminDeactivatesTheAccount() throws Exception {
        User admin = create("rv-admin", User.UserRole.ADMIN, "password-1");
        User staff = create("rv-leaver", User.UserRole.STAFF, "password-1");
        String staffToken = "Bearer " + jwtUtil.generateToken(staff);

        mockMvc.perform(delete("/api/admin/users/rv-leaver").header("Authorization", "Bearer " + jwtUtil.generateToken(admin)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/transactions").header("Authorization", staffToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRejectOldTokensButKeepThisDeviceSignedIn_whenTheUserChangesTheirPassword() throws Exception {
        User staff = create("rv-changer", User.UserRole.STAFF, "old-password-1");
        String otherDevice = "Bearer " + jwtUtil.generateToken(staff);

        String body = mockMvc.perform(post("/api/auth/change-password").header("Authorization", otherDevice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"old-password-1\",\"newPassword\":\"new-password-2\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode response = objectMapper.readTree(body);

        mockMvc.perform(get("/api/auth/me").header("Authorization", otherDevice))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + response.get("token").asText()))
                .andExpect(status().isOk());
    }

    @Test
    void shouldRejectAToken_whenAnAdminResetsThatUsersPassword() throws Exception {
        User admin = create("rv-admin2", User.UserRole.ADMIN, "admin-pass-1");
        User staff = create("rv-reset", User.UserRole.STAFF, "staff-pass-1");
        String staffToken = "Bearer " + jwtUtil.generateToken(staff);

        mockMvc.perform(post("/api/auth/change-password").header("Authorization", "Bearer " + jwtUtil.generateToken(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"rv-reset\",\"currentPassword\":\"staff-pass-1\",\"newPassword\":\"staff-pass-2\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/me").header("Authorization", staffToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRejectATokenIssuedWithoutAPasswordFingerprint() throws Exception {
        create("rv-legacy", User.UserRole.ADMIN, "password-1");
        String legacy = Jwts.builder().subject("rv-legacy").issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + legacy))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRejectAToken_forAUserThatNoLongerExists() throws Exception {
        User ghost = User.builder().username("rv-ghost").passwordHash("x").role(User.UserRole.ADMIN).isActive(true).build();
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + jwtUtil.generateToken(ghost)))
                .andExpect(status().isUnauthorized());
    }
}

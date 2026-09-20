package com.samjhana.controller;

import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.User;
import com.samjhana.repository.ChargePointRepository;
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

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Runs against the seeded in-memory DB (ChargePointSeeder inserts the three chargers on
 * startup). Class is @Transactional so tests that edit a charger are rolled back.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ChargePointControllerIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ChargePointRepository chargePointRepository;

    private String bearer;

    @BeforeEach
    void authenticate() {
        if (userRepository.findByUsername("admin").isEmpty()) {
            userRepository.save(User.builder()
                    .username("admin")
                    .passwordHash(passwordEncoder.encode("admin"))
                    .fullName("Test Admin")
                    .fullNameNepali("परीक्षण प्रशासक")
                    .role(User.UserRole.ADMIN)
                    .locale("en")
                    .build());
        }
        bearer = "Bearer " + jwtUtil.generateToken("admin");
    }

    private ChargePoint byCode(String code) {
        return chargePointRepository.findAll().stream()
                .filter(c -> code.equals(c.getCode()))
                .findFirst()
                .orElseThrow();
    }

    @Test
    void shouldReturnThreeSeededChargersInDisplayOrder_whenAuthenticated() throws Exception {
        mockMvc.perform(get("/api/charge-points").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].code").value("HD-D180-CC-01"))
                .andExpect(jsonPath("$[0].model").value("HD-D180-CC"))
                .andExpect(jsonPath("$[0].maxPowerKw").value(80.0))
                .andExpect(jsonPath("$[1].code").value("HQC23-80-01"))
                .andExpect(jsonPath("$[1].model").value("HQC23-80/1000/260-Y02-CC"))
                .andExpect(jsonPath("$[2].code").value("HD-D140-E-01"))
                .andExpect(jsonPath("$[2].maxPowerKw").value(40.0))
                .andExpect(jsonPath("$[0].id").isNotEmpty())
                // internal/soft-delete fields must not leak to the client
                .andExpect(jsonPath("$[0].deletedAt").doesNotExist())
                .andExpect(jsonPath("$[0].isActive").doesNotExist());
    }

    @Test
    void shouldReturn401_whenNoToken() throws Exception {
        mockMvc.perform(get("/api/charge-points"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldExcludeInactiveCharger_whenChargerIsDeactivated() throws Exception {
        ChargePoint charger = byCode("HD-D180-CC-01");
        charger.setIsActive(false);
        chargePointRepository.saveAndFlush(charger);

        mockMvc.perform(get("/api/charge-points").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.code=='HD-D180-CC-01')]").isEmpty());
    }

    @Test
    void shouldExcludeSoftDeletedCharger_whenDeletedAtIsSet() throws Exception {
        ChargePoint charger = byCode("HD-D140-E-01");
        charger.setDeletedAt(LocalDateTime.now());
        chargePointRepository.saveAndFlush(charger);

        mockMvc.perform(get("/api/charge-points").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.code=='HD-D140-E-01')]").isEmpty());
    }

    // ------------------------------------------------------------------ admin: secrets + lock behavior

    private String tokenFor(String username, User.UserRole role) {
        if (userRepository.findByUsername(username).isEmpty()) {
            userRepository.save(User.builder()
                    .username(username)
                    .passwordHash(passwordEncoder.encode("not-used"))
                    .fullName(username)
                    .fullNameNepali(username)
                    .role(role)
                    .build());
        }
        return "Bearer " + jwtUtil.generateToken(username);
    }

    @Test
    void shouldNeverExposeSecretsOrSoftDeleteFields_whenListingChargers() throws Exception {
        mockMvc.perform(get("/api/charge-points").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].connectionStatus").value("OFFLINE"))
                .andExpect(jsonPath("$[0].lockBehavior").value("EXPLICIT_UNLOCK"))
                .andExpect(jsonPath("$[0].secret").doesNotExist())
                .andExpect(jsonPath("$[0].ocppAuthSecretHash").doesNotExist());
    }

    @Test
    void shouldRotateSecretAndReturnItOnce_whenAdmin() throws Exception {
        ChargePoint charger = byCode("HD-D180-CC-01");
        String oldHash = charger.getOcppAuthSecretHash();

        String body = mockMvc.perform(post("/api/charge-points/" + charger.getId() + "/rotate-secret")
                        .header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secret").isNotEmpty())
                .andExpect(jsonPath("$.warning").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        String newSecret = new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).get("secret").asText();

        ChargePoint reloaded = chargePointRepository.findById(charger.getId()).orElseThrow();
        assertThat(reloaded.getOcppAuthSecretHash()).isNotEqualTo(oldHash);
        assertThat(passwordEncoder.matches(newSecret, reloaded.getOcppAuthSecretHash())).isTrue();
        // Only a hash is stored: the clear-text secret is not in the entity.
        assertThat(reloaded.getOcppAuthSecretHash()).doesNotContain(newSecret);
    }

    @Test
    void shouldForbidSecretRotation_whenNotAdmin() throws Exception {
        ChargePoint charger = byCode("HD-D180-CC-01");
        String oldHash = charger.getOcppAuthSecretHash();

        mockMvc.perform(post("/api/charge-points/" + charger.getId() + "/rotate-secret")
                        .header("Authorization", tokenFor("ev-staff-user", User.UserRole.STAFF)))
                .andExpect(status().isForbidden());

        assertThat(chargePointRepository.findById(charger.getId()).orElseThrow().getOcppAuthSecretHash())
                .isEqualTo(oldHash);
    }

    @Test
    void shouldRequireLogin_whenRotatingSecretWithoutToken() throws Exception {
        mockMvc.perform(post("/api/charge-points/" + byCode("HD-D180-CC-01").getId() + "/rotate-secret"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldReturnNotFound_whenRotatingSecretForUnknownCharger() throws Exception {
        mockMvc.perform(post("/api/charge-points/" + java.util.UUID.randomUUID() + "/rotate-secret")
                        .header("Authorization", bearer))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldUpdateLockBehaviorAndAudit_whenAdmin() throws Exception {
        ChargePoint charger = byCode("HD-D140-E-01");

        mockMvc.perform(patch("/api/charge-points/" + charger.getId() + "/lock-behavior")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lockBehavior\":\"AUTO_UNLOCK_ON_STOP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lockBehavior").value("AUTO_UNLOCK_ON_STOP"));

        assertThat(chargePointRepository.findById(charger.getId()).orElseThrow().getLockBehavior())
                .isEqualTo(ChargePoint.LockBehavior.AUTO_UNLOCK_ON_STOP);
    }

    @Test
    void shouldRejectUnknownLockBehavior_whenValueIsInvalid() throws Exception {
        ChargePoint charger = byCode("HD-D140-E-01");

        mockMvc.perform(patch("/api/charge-points/" + charger.getId() + "/lock-behavior")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lockBehavior\":\"WHENEVER\"}"))
                .andExpect(status().isBadRequest());

        assertThat(chargePointRepository.findById(charger.getId()).orElseThrow().getLockBehavior())
                .isEqualTo(ChargePoint.LockBehavior.EXPLICIT_UNLOCK);
    }

    @Test
    void shouldForbidLockBehaviorChange_whenStaff() throws Exception {
        mockMvc.perform(patch("/api/charge-points/" + byCode("HD-D140-E-01").getId() + "/lock-behavior")
                        .header("Authorization", tokenFor("ev-staff-user", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lockBehavior\":\"AUTO_UNLOCK_ON_STOP\"}"))
                .andExpect(status().isForbidden());
    }
}

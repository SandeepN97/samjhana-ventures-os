package com.samjhana.controller;

import com.samjhana.entity.SystemSetting;
import com.samjhana.entity.User;
import com.samjhana.repository.SystemSettingRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The NEA electricity cost is business-sensitive: staff must not be able to read it via the API. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SystemSettingControllerIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired SystemSettingRepository settingRepository;

    @BeforeEach
    void settings() {
        settingRepository.save(SystemSetting.builder().settingKey("nea_rate").settingValue("12.5").build());
        settingRepository.save(SystemSetting.builder().settingKey("shop_name").settingValue("Samjhana").build());
    }

    private String bearerFor(String username, User.UserRole role) {
        if (userRepository.findByUsername(username).isEmpty()) {
            userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                    .fullName(username).fullNameNepali(username).role(role).build());
        }
        return "Bearer " + jwtUtil.generateToken(username);
    }

    @Test
    void shouldHideTheNeaRateFromStaff() throws Exception {
        mockMvc.perform(get("/api/settings/nea_rate").header("Authorization", bearerFor("setting-staff", User.UserRole.STAFF)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.value").doesNotExist());
    }

    @Test
    void shouldShowTheNeaRateToAnAdmin() throws Exception {
        mockMvc.perform(get("/api/settings/nea_rate").header("Authorization", bearerFor("setting-admin", User.UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("12.5"));
    }

    @Test
    void shouldShowTheNeaRateToAManager() throws Exception {
        mockMvc.perform(get("/api/settings/nea_rate").header("Authorization", bearerFor("setting-manager", User.UserRole.MANAGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("12.5"));
    }

    @Test
    void shouldRequireLoginForTheNeaRate() throws Exception {
        mockMvc.perform(get("/api/settings/nea_rate")).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldStillLetStaffReadOrdinarySettings() throws Exception {
        mockMvc.perform(get("/api/settings/shop_name").header("Authorization", bearerFor("setting-staff", User.UserRole.STAFF)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("Samjhana"));
    }

    @Test
    void shouldReturnAnEmptyValue_whenAManagerReadsAnUnsetNeaRate() throws Exception {
        settingRepository.deleteById("nea_rate");

        mockMvc.perform(get("/api/settings/nea_rate").header("Authorization", bearerFor("setting-admin", User.UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value(""));
    }
}

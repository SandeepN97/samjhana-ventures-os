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

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding B-01: reading a setting was refused for staff only for the one key "nea_rate" (a deny-list). The documented
 * rule (docs/ROLES.md) is that settings are for managers and admins; every key is now refused for staff, and a key
 * the app does not know is not found, instead of answering with an empty value.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SettingsReadAccessIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired SystemSettingRepository settings;

    private String staff;
    private String manager;

    private String token(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x")).fullName(username)
                        .fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    @BeforeEach
    void setUp() {
        staff = token("b01-staff", User.UserRole.STAFF);
        manager = token("b01-manager", User.UserRole.MANAGER);
        settings.save(SystemSetting.builder().settingKey("nea_rate").settingValue("12.5").updatedBy("test").build());
        settings.save(SystemSetting.builder().settingKey("something_else").settingValue("secret-looking").updatedBy("test").build());
    }

    @Test
    void shouldRefuseStaff_forTheNeaRate() throws Exception {
        mockMvc.perform(get("/api/settings/nea_rate").header("Authorization", staff)).andExpect(status().isForbidden());
    }

    @Test
    void shouldRefuseStaff_forAnyOtherKeyToo() throws Exception {
        mockMvc.perform(get("/api/settings/something_else").header("Authorization", staff)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/settings/ev_rate_per_kwh").header("Authorization", staff)).andExpect(status().isForbidden());
    }

    @Test
    void shouldLetAManagerReadTheNeaRate() throws Exception {
        mockMvc.perform(get("/api/settings/nea_rate").header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.key").value("nea_rate"))
                .andExpect(jsonPath("$.value").value("12.5"));
    }

    @Test
    void shouldAnswerWithAnEmptyValue_whenTheNeaRateHasNotBeenSetYet() throws Exception {
        settings.deleteById("nea_rate");

        mockMvc.perform(get("/api/settings/nea_rate").header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value(""));
    }

    @Test
    void shouldNotFindAKeyTheAppDoesNotKnow_evenForAManager() throws Exception {
        mockMvc.perform(get("/api/settings/something_else").header("Authorization", manager))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value(containsString("Unknown setting")));
    }
}

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
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
        return "Bearer " + jwtUtil.generateToken(userRepository.findByUsername(username).orElseThrow());
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

    // ---- saving settings --------------------------------------------------------------------------

    private ResultActions save(String key, String value, String bearer) throws Exception {
        return mockMvc.perform(put("/api/settings/" + key)
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"value\":\"" + value + "\"}"));
    }

    @Test
    void shouldSaveTheNeaRate_whenAManagerEntersAPositiveNumber() throws Exception {
        save("nea_rate", " 13.25 ", bearerFor("setting-manager", User.UserRole.MANAGER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("13.25"));

        assertEquals("13.25", settingRepository.findById("nea_rate").orElseThrow().getSettingValue());
    }

    @Test
    void shouldRefuseToSaveASettingTheAppDoesNotUse() throws Exception {
        save("shop_name", "Somewhere Else", bearerFor("setting-admin", User.UserRole.ADMIN))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unknown setting: shop_name"));
        save("brand_new_key", "x", bearerFor("setting-admin", User.UserRole.ADMIN)).andExpect(status().isBadRequest());

        assertEquals("Samjhana", settingRepository.findById("shop_name").orElseThrow().getSettingValue());
        assertTrue(settingRepository.findById("brand_new_key").isEmpty());
    }

    @Test
    void shouldRefuseAnNeaRateThatIsNotAPositiveNumber() throws Exception {
        String manager = bearerFor("setting-manager", User.UserRole.MANAGER);
        for (String bad : new String[] {"abc", "0", "-5", ""}) {
            save("nea_rate", bad, manager)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("NEA rate must be a number greater than 0"));
        }

        assertEquals("12.5", settingRepository.findById("nea_rate").orElseThrow().getSettingValue());
    }

    @Test
    void shouldNotLetStaffSaveTheNeaRate() throws Exception {
        save("nea_rate", "1", bearerFor("setting-staff", User.UserRole.STAFF)).andExpect(status().isForbidden());

        assertEquals("12.5", settingRepository.findById("nea_rate").orElseThrow().getSettingValue());
    }
}

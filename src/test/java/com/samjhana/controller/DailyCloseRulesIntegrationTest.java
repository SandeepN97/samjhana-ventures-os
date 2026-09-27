package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import com.samjhana.service.DailyReportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Which days may be closed, and by whom. A closed day is final, so this is guarded on the server. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DailyCloseRulesIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired DailyReportService dailyReportService;

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    private LocalDate businessDate() {
        return LocalDate.parse(dailyReportService.getBusinessDate().get("date").toString());
    }

    private String body(LocalDate date) {
        return "{\"cashCounted\":1000" + (date == null ? "" : ",\"date\":\"" + date + "\"") + "}";
    }

    @Test
    void shouldLetStaffCloseTheCurrentDay() throws Exception {
        mockMvc.perform(post("/api/daily-reports/close").header("Authorization", bearer("dc-staff", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON).content(body(businessDate())))
                .andExpect(status().isOk());
    }

    @Test
    void shouldCloseTheCurrentDay_whenNoDateIsGiven() throws Exception {
        LocalDate expected = businessDate();
        mockMvc.perform(post("/api/daily-reports/close").header("Authorization", bearer("dc-staff", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON).content(body(null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reportDate").value(expected.toString()));
    }

    @Test
    void shouldRefuseClosingAFutureDay_evenForAnAdmin() throws Exception {
        mockMvc.perform(post("/api/daily-reports/close").header("Authorization", bearer("dc-admin", User.UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON).content(body(businessDate().plusDays(3))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot close a day that hasn't happened yet"));
    }

    @Test
    void shouldRefuseStaffClosingAnEarlierDay() throws Exception {
        mockMvc.perform(post("/api/daily-reports/close").header("Authorization", bearer("dc-staff", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON).content(body(businessDate().minusDays(4))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only an admin or manager can close an earlier day"));
    }

    @Test
    void shouldLetAManagerCloseAMissedEarlierDay() throws Exception {
        mockMvc.perform(post("/api/daily-reports/close").header("Authorization", bearer("dc-mgr", User.UserRole.MANAGER))
                        .contentType(MediaType.APPLICATION_JSON).content(body(businessDate().minusDays(4))))
                .andExpect(status().isOk());
    }

    @Test
    void shouldAnswer400_whenTheDateIsNotADate() throws Exception {
        mockMvc.perform(post("/api/daily-reports/close").header("Authorization", bearer("dc-mgr", User.UserRole.MANAGER))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"cashCounted\":1,\"date\":\"yesterday\"}"))
                .andExpect(status().isBadRequest());
    }
}

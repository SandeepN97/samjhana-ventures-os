package com.samjhana.controller;

import com.samjhana.SamjhanaVenturesOsApplication;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.TransactionRepository;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sales are filed under Nepal's date, so "today" in Analytics must be Nepal's today too, not the
 * server's UTC date (which lags 5h45m and made new sales look missing each Nepal morning).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AnalyticsTodayIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired TransactionRepository transactionRepository;

    @Test
    void shouldRunTheServerOnNepalTime() {
        assertThat(TimeZone.getDefault().getID()).isEqualTo(SamjhanaVenturesOsApplication.BUSINESS_TIME_ZONE);
        assertThat(LocalDate.now()).isEqualTo(LocalDate.now(ZoneId.of("Asia/Kathmandu")));
    }

    @Test
    void shouldCountAnEvSaleFiledUnderNepalsDate_inTodaysAnalytics() throws Exception {
        User admin = userRepository.save(User.builder().username("an-admin").passwordHash(passwordEncoder.encode("x"))
                .fullName("a").fullNameNepali("a").role(User.UserRole.ADMIN).build());
        BusinessUnit ev = businessUnitRepository.findByCode("ev").orElseGet(() -> businessUnitRepository.save(
                BusinessUnit.builder().code("ev").name("EV").nameNepali("EV").build()));
        transactionRepository.save(Transaction.builder().business(ev).enteredBy(admin)
                .transactionType(Transaction.TransactionType.SALE)
                .transactionDate(LocalDate.now(ZoneId.of("Asia/Kathmandu")))
                .amount(new BigDecimal("812")).status(Transaction.TransactionStatus.APPROVED).customFields("{}").build());

        mockMvc.perform(get("/api/analytics/summary?period=today&offset=0")
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businesses.ev.revenue").value(812.0));
    }
}

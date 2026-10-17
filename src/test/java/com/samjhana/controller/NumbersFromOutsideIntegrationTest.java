package com.samjhana.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.MarkChargeSessionPaidRequest;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.User;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.DailyReportRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Findings G-01 and D-01 at the front door: a money or quantity written with an extreme exponent ("1e100",
 * "1E+1000000000") is refused when the request is read, and the daily close treats a counted-cash figure like that as
 * invalid, so the arithmetic that follows never sees it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class NumbersFromOutsideIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired DailyReportRepository dailyReportRepository;
    @Autowired BusinessUnitRepository businessUnitRepository;

    @BeforeEach
    void setUp() {
        if (businessUnitRepository.findByCode("petrol").isEmpty()) {
            businessUnitRepository.save(BusinessUnit.builder().code("petrol").name("Petrol Pump").nameNepali("पेट्रोल पम्प")
                    .calculationStrategy("PetrolStrategy").build());
        }
    }

    private String staff() {
        User user = userRepository.findByUsername("num-staff").orElseGet(() -> userRepository.save(
                User.builder().username("num-staff").passwordHash(passwordEncoder.encode("x"))
                        .fullName("num-staff").fullNameNepali("num-staff").role(User.UserRole.STAFF).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    // ---- request bodies are read through the shared ObjectMapper ----

    @ParameterizedTest
    @ValueSource(strings = {"1E+1000000000", "1e100", "1E+10", "1E-13", "1234567890123456789012345678901"})
    void shouldRefuseAnExtremeAmountInATransactionRequest(String amount) {
        assertThatThrownBy(() -> objectMapper.readValue("{\"amount\":" + amount + "}", TransactionRequest.class))
                .isInstanceOf(JsonProcessingException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"1E+1000000000", "1e100", "1E-13"})
    void shouldRefuseAnExtremeAmountWhenMarkingAChargeSessionPaid(String amount) {
        assertThatThrownBy(() -> objectMapper.readValue("{\"method\":\"CASH\",\"amount\":" + amount + "}",
                MarkChargeSessionPaidRequest.class)).isInstanceOf(JsonProcessingException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"1700", "1700.50", "0.01", "1E+3", "999999999999.99"})
    void shouldStillReadOrdinaryAmounts(String amount) throws Exception {
        TransactionRequest request = objectMapper.readValue("{\"amount\":" + amount + "}", TransactionRequest.class);
        assertThat(request.getAmount()).isEqualByComparingTo(new BigDecimal(amount));
    }

    @Test
    void shouldAnswer400_whenAnExtremeAmountIsPostedAsASale() throws Exception {
        String body = "{\"businessCode\":\"petrol\",\"transactionType\":\"SALE\",\"amount\":1e100,"
                + "\"customFields\":{\"fuelType\":\"petrol\",\"liters\":10,\"ratePerLiter\":170}}";
        mockMvc.perform(post("/api/transactions").header("Authorization", staff())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    // ---- the daily close takes the counted cash as text ----

    @ParameterizedTest
    @ValueSource(strings = {"\"1e100\"", "\"1e-100\"", "\"abc\""})
    void shouldRefuseAnExtremeCountedCash_andCloseNothing(String cashCounted) throws Exception {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kathmandu"));
        mockMvc.perform(post("/api/daily-reports/close").header("Authorization", staff())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"cashCounted\":" + cashCounted + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid cashCounted value"));
        assertThat(dailyReportRepository.findByReportDate(today)).isEmpty();
    }

    @Test
    void shouldStillCloseTheDay_withOrdinaryCountedCash() throws Exception {
        mockMvc.perform(post("/api/daily-reports/close").header("Authorization", staff())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"cashCounted\":\"12345.50\"}"))
                .andExpect(status().isOk());
    }
}

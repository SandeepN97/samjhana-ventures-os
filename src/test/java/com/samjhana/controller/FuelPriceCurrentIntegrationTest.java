package com.samjhana.controller;

import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.User;
import com.samjhana.repository.FuelPriceRepository;
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

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * /api/fuel-prices/current is open without a login (deploy health check), so anonymous callers must
 * only get the public shape: no internal IDs and no staff names.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FuelPriceCurrentIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired FuelPriceRepository fuelPriceRepository;

    private User setter;

    @BeforeEach
    void setUp() {
        setter = userRepository.save(User.builder().username("fp-setter").passwordHash(passwordEncoder.encode("x"))
                .fullName("Price Setter Name").fullNameNepali("x").role(User.UserRole.ADMIN).build());
        fuelPriceRepository.save(FuelPrice.builder().fuelType(FuelPrice.FuelType.PETROL)
                .pricePerLiter(new BigDecimal("171.00")).effectiveDate(LocalDate.now().minusDays(400)).updatedBy(setter).build());
    }

    @Test
    void shouldGiveAnonymousCallersPricesWithoutIdsOrStaffNames() throws Exception {
        mockMvc.perform(get("/api/fuel-prices/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.petrol.pricePerLiter").exists())
                .andExpect(jsonPath("$.petrol.id").doesNotExist())
                .andExpect(jsonPath("$.petrol.updatedByName").doesNotExist());
    }

    @Test
    void shouldGiveSignedInUsersTheFullRecord() throws Exception {
        mockMvc.perform(get("/api/fuel-prices/current").header("Authorization", "Bearer " + jwtUtil.generateToken(setter)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.petrol.updatedByName").exists());
    }

    @Test
    void shouldStillRequireALogin_forThePriceHistory() throws Exception {
        mockMvc.perform(get("/api/fuel-prices")).andExpect(status().isUnauthorized());
    }
}

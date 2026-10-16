package com.samjhana.controller;

import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.FuelPriceRepository;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding P0-02 at the endpoint: {@code POST /api/transactions} for a fuel sale checks the amount against litres x
 * rate. Staff cannot record a sale that does not add up; a manager can (a discount or a correction), and it is audited.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TransactionAmountCheckIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired FuelPriceRepository fuelPriceRepository;
    @Autowired AuditLogRepository auditLogRepository;

    private static final String TEN_LITRES_AT_170 =
            "\"customFields\":{\"fuelType\":\"petrol\",\"liters\":10,\"ratePerLiter\":170}";

    @BeforeEach
    void setUp() {
        businessUnitRepository.findByCode("petrol").orElseGet(() -> businessUnitRepository.save(
                BusinessUnit.builder().code("petrol").name("petrol").nameNepali("petrol").build()));
        // a price that took effect yesterday is the price in force today
        fuelPriceRepository.save(FuelPrice.builder().fuelType(FuelPrice.FuelType.PETROL)
                .pricePerLiter(new BigDecimal("170.00"))
                .effectiveDate(LocalDate.now(ZoneId.of("Asia/Kathmandu")).minusDays(1)).build());
    }

    private String bearerFor(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() ->
                userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    private ResultActions postFuelSale(String bearer, String amount) throws Exception {
        String body = "{\"businessCode\":\"petrol\",\"transactionType\":\"SALE\",\"amount\":" + amount + "," + TEN_LITRES_AT_170 + "}";
        return mockMvc.perform(post("/api/transactions").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void shouldReturn400_whenStaffPostsAFuelSaleThatDoesNotAddUp() throws Exception {
        postFuelSale(bearerFor("amt-staff", User.UserRole.STAFF), "1000")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("does not add up")));
    }

    @Test
    void shouldAcceptTheSale_whenStaffPostsAFuelSaleThatAddsUp() throws Exception {
        postFuelSale(bearerFor("amt-staff", User.UserRole.STAFF), "1700")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(1700));
    }

    @Test
    void shouldKeepTheManagersAmountAndAuditTheOverride_whenAManagerPostsADifferentAmount() throws Exception {
        postFuelSale(bearerFor("amt-manager", User.UserRole.MANAGER), "1500")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(1500));

        assertThat(auditLogRepository.findAll()).extracting(AuditLog::getDescription)
                .anyMatch(d -> d != null && d.startsWith("AMOUNT OVERRIDE by amt-manager"));
    }
}

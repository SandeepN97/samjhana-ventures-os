package com.samjhana.controller;

import com.samjhana.entity.AuditLog;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Findings P0-08 and P1b-08, through the real routes: a manager's fuel price is refused when it cannot be a price, and
 * a price change leaves an audit row with the old and new price.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FuelPriceAuditIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2031, 3, 5);   // far from any seeded price

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired FuelPriceRepository fuelPrices;
    @Autowired AuditLogRepository auditLogRepository;

    private String manager;
    private String staff;

    @BeforeEach
    void setUp() {
        manager = bearer("price-manager", User.UserRole.MANAGER);
        staff = bearer("price-staff", User.UserRole.STAFF);
    }

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    private String body(String fuel, String price) {
        return "{\"fuelType\":\"" + fuel + "\",\"pricePerLiter\":" + price + ",\"effectiveDate\":\"" + DAY + "\"}";
    }

    private List<AuditLog> rowsFor(FuelPrice price) {
        return auditLogRepository.findAll().stream().filter(a -> price.getId().equals(a.getEntityId())).toList();
    }

    @Test
    void shouldRefuseAPriceOfZeroOrAbsurdSize_andChangeNothing() throws Exception {
        long rows = auditLogRepository.count();
        for (String price : new String[] {"0", "-170", "10000.01", "1e9"}) {
            mockMvc.perform(post("/api/fuel-prices").header("Authorization", manager)
                            .contentType(MediaType.APPLICATION_JSON).content(body("PETROL", price)))
                    .andExpect(status().isBadRequest());
        }
        assertThat(fuelPrices.findByFuelTypeAndEffectiveDate(FuelPrice.FuelType.PETROL, DAY)).isEmpty();
        assertThat(auditLogRepository.count()).isEqualTo(rows);
    }

    @Test
    void shouldSayWhichPriceIsOutOfRange_inTheBulkForm() throws Exception {
        mockMvc.perform(post("/api/fuel-prices/bulk").header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"petrolPrice\":170,\"dieselPrice\":0,\"effectiveDate\":\"" + DAY + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Diesel price must be between")));
        assertThat(fuelPrices.findByFuelTypeAndEffectiveDate(FuelPrice.FuelType.PETROL, DAY)).isEmpty();
    }

    @Test
    void shouldRecordTheFirstPriceAndTheLaterChange_withWhoDidIt() throws Exception {
        mockMvc.perform(post("/api/fuel-prices").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content(body("DIESEL", "160.00"))).andExpect(status().isOk());
        mockMvc.perform(post("/api/fuel-prices").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content(body("DIESEL", "158.50"))).andExpect(status().isOk());

        FuelPrice stored = fuelPrices.findByFuelTypeAndEffectiveDate(FuelPrice.FuelType.DIESEL, DAY).orElseThrow();
        List<AuditLog> rows = rowsFor(stored);
        assertThat(rows).extracting(AuditLog::getAction).containsExactlyInAnyOrder(AuditLog.AuditAction.CREATE, AuditLog.AuditAction.UPDATE);
        AuditLog change = rows.stream().filter(a -> a.getAction() == AuditLog.AuditAction.UPDATE).findFirst().orElseThrow();
        assertThat(change.getOldValues()).contains("160");
        assertThat(change.getNewValues()).contains("158.50");
        assertThat(change.getUser().getUsername()).isEqualTo("price-manager");
    }

    @Test
    void shouldStillRefuseStaff() throws Exception {
        mockMvc.perform(post("/api/fuel-prices").header("Authorization", staff)
                        .contentType(MediaType.APPLICATION_JSON).content(body("PETROL", "170")))
                .andExpect(status().isForbidden());
    }
}

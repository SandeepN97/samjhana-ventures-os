package com.samjhana.controller;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.TransactionRepository;
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
 * Staff never see loans anywhere, so Analytics must not hand them loan figures either: not a loan
 * entry, and not loan money folded into the totals. Admins and managers still see everything.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AnalyticsVisibilityIntegrationTest {

    private static final String ALL_TIME = "/api/analytics/summary?startDate=2000-01-01&endDate=2100-01-01";

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired TransactionRepository transactionRepository;

    private User admin;

    @BeforeEach
    void transactions() {
        admin = user("analytics-admin", User.UserRole.ADMIN);
        save("petrol", Transaction.TransactionType.SALE, "1000");
        save("loan", Transaction.TransactionType.DISBURSEMENT, "150000");
        save("loan", Transaction.TransactionType.PAYMENT, "20000");
    }

    private User user(String username, User.UserRole role) {
        return userRepository.findByUsername(username).orElseGet(() -> userRepository.save(User.builder()
                .username(username).passwordHash(passwordEncoder.encode("x"))
                .fullName(username).fullNameNepali(username).role(role).build()));
    }

    private void save(String code, Transaction.TransactionType type, String amount) {
        BusinessUnit unit = businessUnitRepository.findByCode(code).orElseGet(() -> businessUnitRepository.save(
                BusinessUnit.builder().code(code).name(code).nameNepali(code).build()));
        transactionRepository.save(Transaction.builder().business(unit).enteredBy(admin)
                .transactionType(type).transactionDate(LocalDate.now().minusDays(3))
                .amount(new BigDecimal(amount)).status(Transaction.TransactionStatus.APPROVED)
                .customFields("{\"borrowerName\":\"Ram\",\"principal\":150000}").build());
    }

    private String bearer(User user) {
        return "Bearer " + jwtUtil.generateToken(user);
    }

    @Test
    void shouldLeaveLoansOutOfStaffAnalytics_evenOverAllTime() throws Exception {
        mockMvc.perform(get(ALL_TIME).header("Authorization", bearer(user("analytics-staff", User.UserRole.STAFF))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businesses.loan").doesNotExist())
                .andExpect(jsonPath("$.businesses.petrol.revenue").value(1000))
                .andExpect(jsonPath("$.totalRevenue").value(1000))
                .andExpect(jsonPath("$.totalExpenses").value(0))
                .andExpect(jsonPath("$.transactionCount").value(1))
                .andExpect(jsonPath("$.loanPortfolio").isEmpty())
                .andExpect(jsonPath("$.totalProfit").isEmpty());
    }

    @Test
    void shouldStillShowLoansToAManager() throws Exception {
        mockMvc.perform(get(ALL_TIME).header("Authorization", bearer(user("analytics-manager", User.UserRole.MANAGER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businesses.loan.expenses").value(150000))
                .andExpect(jsonPath("$.businesses.loan.revenue").value(20000))
                .andExpect(jsonPath("$.totalRevenue").value(21000))
                .andExpect(jsonPath("$.transactionCount").value(3))
                .andExpect(jsonPath("$.loanPortfolio.activeLoans").value(1));
    }

    @Test
    void shouldStillShowLoansToAnAdmin() throws Exception {
        mockMvc.perform(get(ALL_TIME).header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businesses.loan.count").value(2))
                .andExpect(jsonPath("$.totalExpenses").value(150000));
    }

    @Test
    void shouldRequireLogin_forAnalytics() throws Exception {
        mockMvc.perform(get(ALL_TIME)).andExpect(status().isUnauthorized());
    }
}

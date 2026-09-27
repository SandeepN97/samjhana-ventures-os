package com.samjhana.controller;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.TransactionRepository;
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

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Furniture pricing is admin-only and cost prices are hidden from staff; staff can't read loan
 * transactions. Checked through the real security filter chain, not just the UI.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RoleAccessIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired FurnitureItemRepository furnitureItemRepository;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired TransactionRepository transactionRepository;

    private FurnitureItem sofa;
    private String staff;
    private String manager;
    private String admin;

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    private BusinessUnit unit(String code) {
        return businessUnitRepository.findByCode(code).orElseGet(() -> businessUnitRepository.save(
                BusinessUnit.builder().code(code).name(code).nameNepali(code).build()));
    }

    @BeforeEach
    void setUp() {
        staff = bearer("ra-staff", User.UserRole.STAFF);
        manager = bearer("ra-manager", User.UserRole.MANAGER);
        admin = bearer("ra-admin", User.UserRole.ADMIN);
        sofa = furnitureItemRepository.save(FurnitureItem.builder().name("Sofa").sku("RA-SOF-1")
                .category(FurnitureItem.FurnitureCategory.SOFA)
                .purchasePrice(new BigDecimal("30000")).sellingPrice(new BigDecimal("45000")).stockQty(3).build());
    }

    // ---- furniture ----------------------------------------------------------------------------------

    @Test
    void shouldHideCostPricesFromStaff_whenListingItems() throws Exception {
        mockMvc.perform(get("/api/furniture/items").header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.sku=='RA-SOF-1')].sellingPrice").exists())
                .andExpect(jsonPath("$[?(@.sku=='RA-SOF-1')].purchasePrice").doesNotExist());
    }

    @Test
    void shouldShowCostPricesToManagers() throws Exception {
        mockMvc.perform(get("/api/furniture/items/{id}", sofa.getId()).header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purchasePrice").value(30000));
    }

    @Test
    void shouldRefuseStaffChangingAPrice_withAMessage() throws Exception {
        mockMvc.perform(put("/api/furniture/items/{id}", sofa.getId()).header("Authorization", staff)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"sellingPrice\":100}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void shouldRefuseManagersChangingAPrice_becausePricingIsAdminOnly() throws Exception {
        mockMvc.perform(put("/api/furniture/items/{id}", sofa.getId()).header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"sellingPrice\":100}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldLetAdminsChangeAPrice() throws Exception {
        mockMvc.perform(put("/api/furniture/items/{id}", sofa.getId()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"sellingPrice\":47000}"))
                .andExpect(status().isOk());
    }

    @Test
    void shouldRefuseStaffAddingOrRemovingItems() throws Exception {
        mockMvc.perform(post("/api/furniture/items").header("Authorization", staff)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Chair\",\"category\":\"CHAIR\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/furniture/items/{id}", sofa.getId()).header("Authorization", staff))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldRefuseStaffAdjustingStock_butAllowManagers() throws Exception {
        mockMvc.perform(patch("/api/furniture/items/{id}/stock", sofa.getId()).header("Authorization", staff)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"adjustment\":-3}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/furniture/items/{id}/stock", sofa.getId()).header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"adjustment\":1}"))
                .andExpect(status().isOk());
    }

    // ---- transactions -------------------------------------------------------------------------------

    @Test
    void shouldHideLoanTransactionsFromStaff_butNotFromManagers() throws Exception {
        User owner = userRepository.findByUsername("ra-admin").orElseThrow();
        Transaction loanTxn = transactionRepository.save(Transaction.builder().business(unit("loan")).enteredBy(owner)
                .transactionType(Transaction.TransactionType.EXPENSE).transactionDate(LocalDate.now())
                .amount(new BigDecimal("500000")).status(Transaction.TransactionStatus.APPROVED)
                .customFields("{\"bankName\":\"NIC Asia\"}").build());

        mockMvc.perform(get("/api/transactions").header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", not(hasItem(loanTxn.getId().toString()))));
        mockMvc.perform(get("/api/transactions/{id}", loanTxn.getId()).header("Authorization", staff))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/transactions").header("Authorization", manager))
                .andExpect(jsonPath("$[*].id", hasItem(loanTxn.getId().toString())));
    }

    @Test
    void shouldStripProfitFromTheDayViewForStaff() throws Exception {
        User owner = userRepository.findByUsername("ra-admin").orElseThrow();
        LocalDate day = LocalDate.now().minusDays(3);
        transactionRepository.save(Transaction.builder().business(unit("petrol")).enteredBy(owner)
                .transactionType(Transaction.TransactionType.SALE).transactionDate(day)
                .amount(new BigDecimal("1700")).status(Transaction.TransactionStatus.APPROVED)
                .customFields("{\"fuelType\":\"petrol\",\"liters\":10,\"purchaseRate\":160}").build());

        mockMvc.perform(get("/api/daily-reports/{date}/transactions", day).header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].customFields", not(org.hamcrest.Matchers.containsString("purchaseRate"))));
    }
}

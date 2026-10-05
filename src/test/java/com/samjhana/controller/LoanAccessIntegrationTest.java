package com.samjhana.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bank loans: only an admin adds a new loan, edits a loan entry or approves one. A manager records the
 * payments made to the bank. Staff have no access. Uses the same data the Loans screen sends.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class LoanAccessIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired ObjectMapper objectMapper;

    private String staff;
    private String manager;
    private String admin;
    private User adminUser;

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
        staff = bearer("la-staff", User.UserRole.STAFF);
        manager = bearer("la-manager", User.UserRole.MANAGER);
        admin = bearer("la-admin", User.UserRole.ADMIN);
        adminUser = userRepository.findByUsername("la-admin").orElseThrow();
        unit("loan");
        unit("petrol");
    }

    private ResultActions createTransaction(String authorization, String json) throws Exception {
        return mockMvc.perform(post("/api/transactions").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private static final String NEW_LOAN = "{\"businessCode\":\"loan\",\"transactionType\":\"EXPENSE\","
            + "\"transactionDate\":\"" + LocalDate.now() + "\",\"amount\":500000,\"notes\":\"\","
            + "\"customFields\":{\"loanType\":\"NEW_LOAN\",\"bankName\":\"NIC Asia\",\"loanAmount\":500000,\"interestRate\":11,"
            + "\"principal\":500000,\"startDate\":\"" + LocalDate.now() + "\",\"borrowerName\":\"Samjhana\"}}";

    private static final String PAYMENT = "{\"businessCode\":\"loan\",\"transactionType\":\"SALE\","
            + "\"transactionDate\":\"" + LocalDate.now() + "\",\"amount\":25000,\"notes\":\"\","
            + "\"customFields\":{\"loanType\":\"PAYMENT\",\"loanId\":\"abc\",\"principalAmount\":20000,\"interestAmount\":5000,"
            + "\"principal\":500000,\"interestRate\":11,\"startDate\":\"" + LocalDate.now() + "\",\"borrowerName\":\"Samjhana\"}}";

    private Transaction loanEntry() {
        return transactionRepository.save(Transaction.builder().business(unit("loan")).enteredBy(adminUser)
                .transactionType(Transaction.TransactionType.EXPENSE).transactionDate(LocalDate.now())
                .amount(new BigDecimal("500000")).status(Transaction.TransactionStatus.APPROVED)
                .customFields("{\"bankName\":\"NIC Asia\"}").build());
    }

    // ---- adding ----

    @Test
    void shouldLetAnAdminAddANewLoan() throws Exception {
        createTransaction(admin, NEW_LOAN).andExpect(status().isOk());
    }

    @Test
    void shouldRefuseAManagerAddingANewLoan() throws Exception {
        createTransaction(manager, NEW_LOAN)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only an admin can add a new loan or change loan entries"));
    }

    @Test
    void shouldLetAManagerRecordAPaymentToTheBank() throws Exception {
        createTransaction(manager, PAYMENT).andExpect(status().isOk());
    }

    @Test
    void shouldLetAnAdminRecordAPaymentToo() throws Exception {
        createTransaction(admin, PAYMENT).andExpect(status().isOk());
    }

    @Test
    void shouldRefuseAManagerDisguisingANewLoanAsAPayment() throws Exception {
        String disguised = PAYMENT.replace("\"loanType\":\"PAYMENT\"", "\"loanType\":\"NEW_LOAN\"");
        createTransaction(manager, disguised).andExpect(status().isForbidden());
    }

    @Test
    void shouldRefuseAManagerSendingOtherLoanEntryTypes() throws Exception {
        String disbursement = PAYMENT.replace("\"transactionType\":\"SALE\"", "\"transactionType\":\"DISBURSEMENT\"");
        createTransaction(manager, disbursement).andExpect(status().isForbidden());
    }

    @Test
    void shouldRefuseStaffAnyLoanEntry() throws Exception {
        createTransaction(staff, NEW_LOAN).andExpect(status().isForbidden());
        createTransaction(staff, PAYMENT).andExpect(status().isForbidden());
    }

    @Test
    void shouldNotChangeWhatManagersCanDoOutsideLoans() throws Exception {
        String petrolSale = "{\"businessCode\":\"petrol\",\"transactionType\":\"SALE\","
                + "\"transactionDate\":\"" + LocalDate.now() + "\",\"amount\":1700,"
                + "\"customFields\":{\"fuelType\":\"petrol\",\"liters\":10,\"ratePerLiter\":170}}";
        createTransaction(manager, petrolSale).andExpect(status().isOk());
    }


    // ---- editing and approving ----

    @Test
    void shouldLetOnlyAnAdminEditALoanEntry() throws Exception {
        Transaction entry = loanEntry();
        String body = "{\"notes\":\"corrected\"}";

        mockMvc.perform(put("/api/transactions/{id}", entry.getId()).header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only an admin can add a new loan or change loan entries"));
        mockMvc.perform(put("/api/transactions/{id}", entry.getId()).header("Authorization", staff)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/transactions/{id}", entry.getId()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    @Test
    void shouldLetOnlyAnAdminApproveOrRejectALoanEntry() throws Exception {
        Transaction entry = loanEntry();

        mockMvc.perform(patch("/api/transactions/{id}/approve", entry.getId()).header("Authorization", manager))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/transactions/{id}/reject", entry.getId()).header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"no\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/transactions/{id}/approve", entry.getId()).header("Authorization", admin))
                .andExpect(status().isOk());
    }

    @Test
    void shouldStillLetAManagerEditAndApproveOtherBusinessesEntries() throws Exception {
        Transaction petrol = transactionRepository.save(Transaction.builder().business(unit("petrol")).enteredBy(adminUser)
                .transactionType(Transaction.TransactionType.SALE).transactionDate(LocalDate.now())
                .amount(new BigDecimal("1700")).status(Transaction.TransactionStatus.APPROVED)
                .customFields("{\"fuelType\":\"petrol\",\"liters\":10}").build());

        mockMvc.perform(put("/api/transactions/{id}", petrol.getId()).header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"notes\":\"fixed\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/transactions/{id}/approve", petrol.getId()).header("Authorization", manager))
                .andExpect(status().isOk());
    }
}

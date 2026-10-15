package com.samjhana.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.LoanReceiptRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A manager pays the bank and records it with the bank's reference and a photo of the receipt; the payment waits,
 * uncounted, until an admin approves it. An admin's own payment is approved at once. The photo is private.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class LoanPaymentReviewIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired LoanReceiptRepository receiptRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired ObjectMapper objectMapper;

    private String staff, manager, otherManager, admin;

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    @BeforeEach
    void setUp() {
        staff = bearer("lp-staff", User.UserRole.STAFF);
        manager = bearer("lp-manager", User.UserRole.MANAGER);
        otherManager = bearer("lp-manager2", User.UserRole.MANAGER);
        admin = bearer("lp-admin", User.UserRole.ADMIN);
        businessUnitRepository.findByCode("loan").orElseGet(() -> businessUnitRepository.save(
                BusinessUnit.builder().code("loan").name("loan").nameNepali("loan").build()));
    }

    private static byte[] photo(String format) throws Exception {
        BufferedImage image = new BufferedImage(40, 30, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    private String upload(String authorization, byte[] bytes) throws Exception {
        String body = mockMvc.perform(multipart("/api/loans/receipts")
                        .file(new MockMultipartFile("file", "receipt.jpg", "image/jpeg", bytes))
                        .header("Authorization", authorization))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("receiptId").asText();
    }

    private String paymentJson(String reference, String receiptId) {
        String refPart = reference == null ? "" : ",\"bankReference\":\"" + reference + "\"";
        String receiptPart = receiptId == null ? "" : ",\"receiptId\":\"" + receiptId + "\"";
        return "{\"businessCode\":\"loan\",\"transactionType\":\"SALE\",\"transactionDate\":\"" + LocalDate.now()
                + "\",\"amount\":25000,\"notes\":\"\",\"customFields\":{\"loanType\":\"PAYMENT\",\"loanId\":\"abc\","
                + "\"principalAmount\":20000,\"interestAmount\":5000" + refPart + receiptPart + "}}";
    }

    private ResultActions pay(String authorization, String json) throws Exception {
        return mockMvc.perform(post("/api/transactions").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private String payAndGetId(String authorization, String json) throws Exception {
        String body = pay(authorization, json).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asText();
    }

    // ---- a manager's payment waits ----

    @Test
    void shouldHoldAManagersPaymentForReview_withTheBankReferenceAndReceipt() throws Exception {
        String receiptId = upload(manager, photo("jpg"));
        pay(manager, paymentJson("NIC-778899", receiptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING_REVIEW"))
                .andExpect(jsonPath("$.referenceNumber").value("NIC-778899"));
    }

    @Test
    void shouldNotCountAWaitingPayment_inTheSummaryOrTheWaitingCountUntilApproved() throws Exception {
        String receiptId = upload(manager, photo("jpg"));
        String id = payAndGetId(manager, paymentJson("NIC-1", receiptId));

        mockMvc.perform(get("/api/loans/pending-payments").header("Authorization", admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(1));
        assertThat(transactionRepository.findById(java.util.UUID.fromString(id)).orElseThrow().getStatus())
                .isEqualTo(Transaction.TransactionStatus.PENDING_REVIEW);

        mockMvc.perform(patch("/api/transactions/{id}/approve", id).header("Authorization", admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        mockMvc.perform(get("/api/loans/pending-payments").header("Authorization", admin))
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void shouldApproveAnAdminsOwnPaymentAtOnce() throws Exception {
        pay(admin, paymentJson("NIC-2", null))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
    }

    @Test
    void shouldRefuseAPaymentWithoutTheBankReference() throws Exception {
        String receiptId = upload(manager, photo("jpg"));
        pay(manager, paymentJson(null, receiptId)).andExpect(status().isBadRequest());
        pay(admin, paymentJson("  ", null)).andExpect(status().isBadRequest());
    }

    @Test
    void shouldRefuseAManagersPaymentWithoutAReceiptPhoto() throws Exception {
        pay(manager, paymentJson("NIC-3", null)).andExpect(status().isBadRequest());
    }

    @Test
    void shouldRefuseAReceiptThatIsUnknownOrAnotherManagersOrAlreadyUsed() throws Exception {
        pay(manager, paymentJson("NIC-4", java.util.UUID.randomUUID().toString())).andExpect(status().isBadRequest());

        String mine = upload(manager, photo("jpg"));
        pay(otherManager, paymentJson("NIC-5", mine)).andExpect(status().isBadRequest());

        pay(manager, paymentJson("NIC-6", mine)).andExpect(status().isOk());
        pay(manager, paymentJson("NIC-7", mine)).andExpect(status().isBadRequest());
    }

    // ---- admin review ----

    @Test
    void shouldLetOnlyAnAdminApprove() throws Exception {
        String id = payAndGetId(manager, paymentJson("NIC-8", upload(manager, photo("jpg"))));
        mockMvc.perform(patch("/api/transactions/{id}/approve", id).header("Authorization", manager))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/transactions/{id}/approve", id).header("Authorization", staff))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldRequireAReasonToRejectAndKeepTheEntry() throws Exception {
        String id = payAndGetId(manager, paymentJson("NIC-9", upload(manager, photo("jpg"))));

        mockMvc.perform(patch("/api/transactions/{id}/reject", id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch("/api/transactions/{id}/reject", id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Wrong amount\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.reviewNotes").value("Wrong amount"));
        assertThat(transactionRepository.findById(java.util.UUID.fromString(id))).isPresent();
    }

    // ---- the photo ----

    @Test
    void shouldStoreTheReceiptAsAPlainJpeg_andServeItOnlyToAdminAndManager() throws Exception {
        String receiptId = upload(manager, photo("png"));

        var served = mockMvc.perform(get("/api/loans/receipts/{id}", receiptId).header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/jpeg"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(served[0] & 0xFF).isEqualTo(0xFF);
        assertThat(served[1] & 0xFF).isEqualTo(0xD8);

        mockMvc.perform(get("/api/loans/receipts/{id}", receiptId).header("Authorization", manager)).andExpect(status().isOk());
        mockMvc.perform(get("/api/loans/receipts/{id}", receiptId).header("Authorization", staff)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/loans/receipts/{id}", receiptId)).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldNotServeAReceiptThroughThePublicSite() throws Exception {
        String receiptId = upload(manager, photo("jpg"));
        mockMvc.perform(get("/api/public/media/{id}", receiptId)).andExpect(status().isNotFound());
    }

    @Test
    void shouldRecordWhoOpenedAReceipt() throws Exception {
        String receiptId = upload(manager, photo("jpg"));
        long before = auditLogRepository.count();
        mockMvc.perform(get("/api/loans/receipts/{id}", receiptId).header("Authorization", admin)).andExpect(status().isOk());
        assertThat(auditLogRepository.count()).isEqualTo(before + 1);
        AuditLog last = auditLogRepository.findAll().stream()
                .filter(a -> a.getDescription() != null && a.getDescription().contains("Opened loan receipt")).findFirst().orElseThrow();
        assertThat(last.getUser().getUsername()).isEqualTo("lp-admin");
    }

    @Test
    void shouldRefuseAFileThatIsNotAJpegOrPng() throws Exception {
        mockMvc.perform(multipart("/api/loans/receipts")
                        .file(new MockMultipartFile("file", "x.jpg", "image/jpeg", "<svg/>".getBytes()))
                        .header("Authorization", manager))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRefuseAPhotoOverThreeMegabytes() throws Exception {
        mockMvc.perform(multipart("/api/loans/receipts")
                        .file(new MockMultipartFile("file", "big.jpg", "image/jpeg", new byte[3 * 1024 * 1024 + 1]))
                        .header("Authorization", manager))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRefuseStaffUploadingAReceipt() throws Exception {
        mockMvc.perform(multipart("/api/loans/receipts")
                        .file(new MockMultipartFile("file", "r.jpg", "image/jpeg", photo("jpg")))
                        .header("Authorization", staff))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/loans/pending-payments").header("Authorization", staff)).andExpect(status().isForbidden());
    }

    // ---- the Loans screen's own data ----

    @Test
    void shouldAcceptTheDataTheLoansScreenSendsForANewLoan() throws Exception {
        String newLoan = "{\"businessCode\":\"loan\",\"transactionType\":\"EXPENSE\",\"transactionDate\":\"" + LocalDate.now()
                + "\",\"amount\":500000,\"notes\":\"\",\"customFields\":{\"loanType\":\"NEW_LOAN\",\"bankName\":\"NIC Asia\","
                + "\"loanAmount\":500000,\"interestRate\":null}}";
        pay(admin, newLoan).andExpect(status().isOk());
    }

    @Test
    void shouldRefuseANewLoanWithoutABankName() throws Exception {
        String newLoan = "{\"businessCode\":\"loan\",\"transactionType\":\"EXPENSE\",\"transactionDate\":\"" + LocalDate.now()
                + "\",\"amount\":500000,\"customFields\":{\"loanType\":\"NEW_LOAN\",\"loanAmount\":500000}}";
        pay(admin, newLoan).andExpect(status().isBadRequest());
    }
}

package com.samjhana.controller;

import com.samjhana.entity.LoanReceipt;
import com.samjhana.entity.MediaAsset;
import com.samjhana.entity.User;
import com.samjhana.repository.LoanReceiptRepository;
import com.samjhana.repository.MediaAssetRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import com.samjhana.testsupport.TestImages;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding F-03 through the real upload routes: with the stores set to 1 MB each, a store that is already full
 * refuses the next upload with a clear message, while removed pictures do not count against the limit.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {"samjhana.storage.media-max-total-mb=1", "samjhana.storage.receipt-max-total-mb=1"})
@Transactional
class UploadQuotaIntegrationTest {

    /** A store already holding exactly its 1 MB limit: any further upload would pass it. */
    private static final long FULL = 1024L * 1024L;

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired MediaAssetRepository mediaRepository;
    @Autowired LoanReceiptRepository receiptRepository;

    private String manager;

    @BeforeEach
    void setUp() {
        User user = userRepository.findByUsername("quota-manager").orElseGet(() -> userRepository.save(
                User.builder().username("quota-manager").passwordHash(passwordEncoder.encode("x"))
                        .fullName("quota-manager").fullNameNepali("quota-manager").role(User.UserRole.MANAGER).build()));
        manager = "Bearer " + jwtUtil.generateToken(user);
    }

    private ResultActions uploadPicture() throws Exception {
        return mockMvc.perform(multipart("/api/media")
                .file(new MockMultipartFile("file", "a.png", "image/png", TestImages.png())).header("Authorization", manager));
    }

    private ResultActions uploadReceipt() throws Exception {
        return mockMvc.perform(multipart("/api/loans/receipts")
                .file(new MockMultipartFile("file", "r.png", "image/png", TestImages.png())).header("Authorization", manager));
    }

    private void storedPicture(long sizeBytes, LocalDateTime deletedAt) {
        mediaRepository.save(MediaAsset.builder().contentType("image/png").sizeBytes(sizeBytes).uploadedBy("someone")
                .data(new byte[]{1}).deletedAt(deletedAt).build());
    }

    private void storedReceipt(long sizeBytes, LocalDateTime deletedAt) {
        receiptRepository.save(LoanReceipt.builder().contentType("image/jpeg").sizeBytes(sizeBytes).uploadedBy("someone")
                .data(new byte[]{1}).deletedAt(deletedAt).build());
    }

    @Test
    void shouldAcceptAPictureAndAReceipt_whenThereIsRoom() throws Exception {
        uploadPicture().andExpect(status().isOk());
        uploadReceipt().andExpect(status().isOk());
    }

    @Test
    void shouldRefuseAPicture_whenTheStoredPicturesAlreadyFillTheLimit() throws Exception {
        storedPicture(FULL, null);
        uploadPicture().andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Picture storage is full")));
    }

    @Test
    void shouldRefuseAReceipt_whenTheStoredReceiptsAlreadyFillTheLimit() throws Exception {
        storedReceipt(FULL, null);
        uploadReceipt().andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Receipt storage is full")));
    }

    @Test
    void shouldNotCountRemovedPicturesAgainstTheLimit() throws Exception {
        storedPicture(FULL, LocalDateTime.now().minusDays(1));
        uploadPicture().andExpect(status().isOk());
    }

    @Test
    void shouldNotCountRemovedReceiptsAgainstTheLimit() throws Exception {
        storedReceipt(FULL, LocalDateTime.now().minusDays(1));
        uploadReceipt().andExpect(status().isOk());
    }

    @Test
    void shouldKeepTheTwoStoresApart() throws Exception {
        storedPicture(FULL, null);
        uploadReceipt().andExpect(status().isOk());
    }
}

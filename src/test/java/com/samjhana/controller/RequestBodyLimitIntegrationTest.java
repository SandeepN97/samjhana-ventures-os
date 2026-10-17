package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.ShopOrderRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding F-01, through the real routes: a request body is looked at for its size before anything else runs (login,
 * security, JSON parsing), so a stranger cannot make the server build giant strings. The EV start, which carries a
 * photo, may be bigger; file uploads keep their own limit.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RequestBodyLimitIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ShopOrderRepository orderRepository;

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    private static String startBody(String photo) {
        return "{\"chargePointId\":\"NO-SUCH-CHARGER\",\"plateNumber\":\"BA1PA1234\",\"targetPercent\":80,"
                + "\"platePhotoDataUrl\":\"" + photo + "\"}";
    }

    @Test
    void shouldAnswer413_whenAnAnonymousShopOrderCarriesA1MBName() throws Exception {
        long orders = orderRepository.count();
        String body = "{\"customerName\":\"" + "x".repeat(1_000_000) + "\",\"customerPhone\":\"9800000000\","
                + "\"fulfilment\":\"PICKUP\",\"items\":[]}";

        mockMvc.perform(post("/api/public/shop/orders").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("TOO_LARGE"));

        assertThat(orderRepository.count()).isEqualTo(orders);
    }

    @Test
    void shouldAnswer413_whenALoginCarriesA1MBUsername() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + "u".repeat(1_000_000) + "\",\"password\":\"x\"}"))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void shouldAnswer413BeforeAnyLoginCheck_whenAnUnknownCallerSendsAHugeBodyToAProtectedRoute() throws Exception {
        mockMvc.perform(post("/api/transactions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"notes\":\"" + "n".repeat(600_000) + "\"}"))
                .andExpect(status().isPayloadTooLarge());   // not 401: the size is looked at first
    }

    @Test
    void shouldAnswer413_whenASignedInUserSendsMoreThan512KBToAnOrdinaryRoute() throws Exception {
        mockMvc.perform(post("/api/transactions").header("Authorization", bearer("limit-staff", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"notes\":\"" + "n".repeat(600_000) + "\"}"))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void shouldStillAcceptAnOrdinaryBodyOf400KB_pastTheSizeCheck() throws Exception {
        // 400 KB is under the limit, so the size check lets it through and the entry is refused for its own reasons
        // (here: it names no business)
        int status = mockMvc.perform(post("/api/transactions").header("Authorization", bearer("limit-staff", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"notes\":\"" + "n".repeat(400_000) + "\"}"))
                .andReturn().getResponse().getStatus();

        assertThat(status).isNotEqualTo(413).isGreaterThanOrEqualTo(400);
    }

    // ---- the EV start, which can carry a photo ----

    @Test
    void shouldAnswer413_whenAnEvStartBodyIsOver7_5MB() throws Exception {
        mockMvc.perform(post("/api/ev/sessions/start").header("Authorization", bearer("limit-staff", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON).content(startBody("A".repeat(8_000_000))))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void shouldLetAnEvStartWithA5MBPhotoPastTheSizeCheck() throws Exception {
        // 5 MB of photo is 6,990,508 characters of base64: bigger than an ordinary body, allowed here
        String photo = "data:image/jpeg;base64," + "A".repeat(6_990_508);

        int status = mockMvc.perform(post("/api/ev/sessions/start")
                        .header("Authorization", bearer("limit-staff", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON).content(startBody(photo)))
                .andReturn().getResponse().getStatus();

        assertThat(status).as("the size check must let a 5 MB photo through").isNotEqualTo(413);
    }

    @Test
    void shouldAnswer400WithAMessage_whenThePhotoTextIsLongerThan7MillionCharacters() throws Exception {
        mockMvc.perform(post("/api/ev/sessions/start").header("Authorization", bearer("limit-staff", User.UserRole.STAFF))
                        .contentType(MediaType.APPLICATION_JSON).content(startBody("A".repeat(7_000_001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.message").value(containsString("platePhotoDataUrl")));
    }

    // ---- uploads keep their own limit ----

    @Test
    void shouldNotAnswer413_whenAFileUploadIsBiggerThanAnOrdinaryBodyButWithinTheUploadLimit() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", new byte[600_000]);

        int status = mockMvc.perform(multipart("/api/media").file(file)
                        .header("Authorization", bearer("limit-admin", User.UserRole.ADMIN)))
                .andReturn().getResponse().getStatus();

        assertThat(status).as("600 KB is fine for an upload (it is refused later for not being a real picture)").isNotEqualTo(413);
    }
}

package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
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

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Finding P0-17: an over-long username or password is refused before it reaches the login checks or the counter. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class LoginInputLimitsIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private ResultActions login(String username, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"));
    }

    @Test
    void shouldAnswer400_whenTheUsernameIsLongerThanAnyRealOne() throws Exception {
        login("u".repeat(51), "whatever").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("username")));
        login("u".repeat(100_000), "whatever").andExpect(status().isBadRequest());
    }

    @Test
    void shouldAnswer400_whenThePasswordIsLongerThanAnyRealOne() throws Exception {
        login("dad", "p".repeat(129)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("password")));
    }

    @Test
    void shouldAnswer401_forAnUnknownUserWithinTheLimits() throws Exception {
        login("u".repeat(50), "p".repeat(128)).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldNotCountARefusedOverLongUsernameAsAWrongPassword() throws Exception {
        userRepository.save(User.builder().username("lim-user").passwordHash(passwordEncoder.encode("right-password-1"))
                .fullName("lim").fullNameNepali("lim").role(User.UserRole.STAFF).isActive(true).build());
        for (int i = 0; i < 15; i++) login("lim-user" + "x".repeat(60), "guess-" + i).andExpect(status().isBadRequest());

        login("lim-user", "right-password-1").andExpect(status().isOk());
    }
}

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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding A-01: a stream of login attempts, each naming a new username, used to cost one BCrypt comparison apiece with
 * nothing to stop it. The whole login endpoint now admits only so many attempts a minute (here set to 5; the default is
 * 120), whoever makes them, and answers the rest at once without checking any password.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "samjhana.security.login.global-per-minute=5")
@Transactional
class LoginEndpointCeilingIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private ResultActions login(String username, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"));
    }

    @Test
    void shouldAnswerAtOnce_toEveryAttemptOverTheCeiling_evenWithTheRightPassword() throws Exception {
        userRepository.save(User.builder().username("ceiling-user").passwordHash(passwordEncoder.encode("right-password-1"))
                .fullName("c").fullNameNepali("c").role(User.UserRole.STAFF).isActive(true).build());

        for (int i = 0; i < 5; i++) {
            login("made-up-" + i, "guess").andExpect(status().isUnauthorized());   // within the ceiling: checked as usual
        }

        login("ceiling-user", "right-password-1").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Too many sign-in attempts right now. Please wait a minute and try again."));
        login("made-up-99", "guess").andExpect(status().isTooManyRequests());
    }
}

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Repeated wrong passwords lock that username out for a while, even if the right one follows. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class LoginThrottleIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private void create(String username, String password) {
        userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode(password))
                .fullName(username).fullNameNepali(username).role(User.UserRole.STAFF).isActive(true).build());
    }

    private ResultActions login(String username, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"));
    }

    @Test
    void shouldRefuseEvenTheRightPassword_afterTenWrongOnes() throws Exception {
        create("lt-target", "right-password-1");
        for (int i = 0; i < 10; i++) {
            login("lt-target", "guess-" + i).andExpect(status().isUnauthorized());
        }

        login("lt-target", "right-password-1")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Too many wrong passwords. Try again in 15 minutes."));
    }

    @Test
    void shouldStillLetOtherUsersIn_whileOneIsLockedOut() throws Exception {
        create("lt-locked", "right-password-1");
        create("lt-other", "right-password-2");
        for (int i = 0; i < 10; i++) login("lt-locked", "guess-" + i);

        login("lt-other", "right-password-2").andExpect(status().isOk());
    }

    @Test
    void shouldLogInNormally_afterAFewMistakes() throws Exception {
        create("lt-typo", "right-password-1");
        for (int i = 0; i < 3; i++) login("lt-typo", "typo-" + i).andExpect(status().isUnauthorized());

        login("lt-typo", "right-password-1").andExpect(status().isOk());
    }
}

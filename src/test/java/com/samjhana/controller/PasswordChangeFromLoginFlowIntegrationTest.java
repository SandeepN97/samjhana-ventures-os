package com.samjhana.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.HashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The login screen's "change password" flow, replayed against the real backend. Nobody is signed in on
 * that screen and /api/auth/change-password needs a JWT, so the page logs in with the current password
 * first and uses that token once. These tests send exactly what the page sends.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PasswordChangeFromLoginFlowIntegrationTest {

    private static final String LOGIN = "/api/auth/login";
    private static final String CHANGE = "/api/auth/change-password";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private void createUser(String username, String password) {
        userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode(password))
                .fullName(username).fullNameNepali(username).role(User.UserRole.STAFF).build());
    }

    // Named authenticatedPost, not post: a method named post here would shadow the statically
    // imported MockMvcRequestBuilders.post for every unqualified call in this class, including
    // the one below, and fail to compile with an arity mismatch instead of building the request.
    private ResultActions authenticatedPost(String url, String bearer, Map<String, String> body) throws Exception {
        var request = post(url).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body));
        if (bearer != null) request = request.header("Authorization", "Bearer " + bearer);
        return mockMvc.perform(request);
    }

    private ResultActions login(String username, String password) throws Exception {
        return authenticatedPost(LOGIN, null, Map.of("username", username, "password", password));
    }

    private String loginToken(String username, String password) throws Exception {
        String body = login(username, password).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("token").asText();
    }

    /** The body the page sends to change-password: the token identifies the user, so no username. */
    private Map<String, String> changeBody(String current, String next) {
        Map<String, String> body = new HashMap<>();
        body.put("currentPassword", current);
        body.put("newPassword", next);
        return body;
    }

    @Test
    void shouldChangeThePassword_whenTheLoginPageFlowIsFollowed() throws Exception {
        createUser("flow-staff", "old-pass-123");

        String token = loginToken("flow-staff", "old-pass-123");                       // step 1: prove who you are
        authenticatedPost(CHANGE, token, changeBody("old-pass-123", "new-pass-4567"))  // step 2: change, with that token
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password changed successfully"));

        login("flow-staff", "old-pass-123").andExpect(status().isUnauthorized());      // the old password is dead
        login("flow-staff", "new-pass-4567").andExpect(status().isOk());               // the new one works
    }

    @Test
    void shouldRefuseTheOldFlow_whenChangePasswordIsCalledWithoutLoggingInFirst() throws Exception {
        createUser("flow-staff", "old-pass-123");

        // This is what the page did before the fix: name the user and send the passwords, no token.
        Map<String, String> oldFlowBody = changeBody("old-pass-123", "new-pass-4567");
        oldFlowBody.put("username", "flow-staff");
        authenticatedPost(CHANGE, null, oldFlowBody).andExpect(status().isUnauthorized());

        login("flow-staff", "old-pass-123").andExpect(status().isOk());                // nothing changed
    }

    @Test
    void shouldIssueNoTokenAndChangeNothing_whenTheCurrentPasswordIsWrong() throws Exception {
        createUser("flow-staff", "old-pass-123");

        login("flow-staff", "not-my-password")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.token").doesNotExist());

        login("flow-staff", "old-pass-123").andExpect(status().isOk());
    }

    @Test
    void shouldRefuseAShortNewPassword_evenAfterAValidLogin() throws Exception {
        createUser("flow-staff", "old-pass-123");
        String token = loginToken("flow-staff", "old-pass-123");

        authenticatedPost(CHANGE, token, changeBody("old-pass-123", "1234567"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("New password must be at least 8 characters"));

        login("flow-staff", "old-pass-123").andExpect(status().isOk());
    }
}

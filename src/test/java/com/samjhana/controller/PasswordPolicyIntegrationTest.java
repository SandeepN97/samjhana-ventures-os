package com.samjhana.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding A-02: a new password follows one rule wherever it is chosen - when a person changes theirs and when an
 * admin creates the account. Each refusal says why, with a code the screens translate. These run through the real
 * security filter chain.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PasswordPolicyIntegrationTest {

    private static final String CHANGE = "/api/auth/change-password";
    private static final String CREATE = "/api/admin/users";
    private static final String OLD = "old-password-1";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private User createUser(String username, User.UserRole role, String password) {
        return userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode(password))
                .fullName(username).fullNameNepali(username).role(role).build());
    }

    private String bearer(User user) {
        return "Bearer " + jwtUtil.generateToken(user);
    }

    private ResultActions changePassword(User caller, String targetUsername, String current, String next) throws Exception {
        Map<String, String> body = new HashMap<>();
        if (targetUsername != null) body.put("username", targetUsername);
        body.put("currentPassword", current);
        body.put("newPassword", next);
        return mockMvc.perform(post(CHANGE).header("Authorization", bearer(caller))
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)));
    }

    private ResultActions createAccount(User admin, String username, String password) throws Exception {
        Map<String, String> body = new HashMap<>();
        body.put("username", username);
        body.put("password", password);
        body.put("fullName", "New Person");
        body.put("role", "STAFF");
        return mockMvc.perform(post(CREATE).header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)));
    }

    private boolean passwordIs(String username, String plaintext) {
        return passwordEncoder.matches(plaintext, userRepository.findByUsername(username).orElseThrow().getPassword());
    }

    // ---- a person changes their own password ----------------------------------------------------

    @Test
    void shouldRefuseACommonNewPassword_andKeepTheOldOne() throws Exception {
        User staff = createUser("ppol-staff", User.UserRole.STAFF, OLD);

        changePassword(staff, null, OLD, "Password123")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_TOO_COMMON"))
                .andExpect(jsonPath("$.message").value(containsString("New password is too common")));

        assertTrue(passwordIs("ppol-staff", OLD));
    }

    @Test
    void shouldRefuseANewPasswordThatContainsTheUsername_whateverTheCapitals() throws Exception {
        User staff = createUser("ppol-staff", User.UserRole.STAFF, OLD);

        changePassword(staff, null, OLD, "My-PPOL-Staff-7731")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_HAS_USERNAME"))
                .andExpect(jsonPath("$.message").value("New password must not contain the username"));

        assertTrue(passwordIs("ppol-staff", OLD));
    }

    @Test
    void shouldRefuseANewPasswordLongerThan72Bytes_withA400AndTheOldPasswordKept() throws Exception {
        User staff = createUser("ppol-staff", User.UserRole.STAFF, OLD);
        String seventyThreeBytes = "Qx7!".repeat(18) + "z";

        changePassword(staff, null, OLD, seventyThreeBytes)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_TOO_LONG"))
                .andExpect(jsonPath("$.message").value(containsString("72")));

        assertTrue(passwordIs("ppol-staff", OLD));
    }

    @Test
    void shouldAcceptANewPasswordOfExactly72Bytes_andUseAllOfIt() throws Exception {
        User staff = createUser("ppol-staff", User.UserRole.STAFF, OLD);
        String seventyTwoBytes = "Qx7!".repeat(17) + "Qx7!";
        String sameStart = "Qx7!".repeat(17) + "Qx7?";

        changePassword(staff, null, OLD, seventyTwoBytes).andExpect(status().isOk());

        assertTrue(passwordIs("ppol-staff", seventyTwoBytes));
        assertFalse(passwordIs("ppol-staff", sameStart), "the last character is part of the password too");
    }

    @Test
    void shouldKeepTheOldSentenceAndAddACode_whenTheNewPasswordIsTooShort() throws Exception {
        User staff = createUser("ppol-staff", User.UserRole.STAFF, OLD);

        changePassword(staff, null, OLD, "Ab3$xyz")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_TOO_SHORT"))
                .andExpect(jsonPath("$.message").value("New password must be at least 8 characters"));

        assertTrue(passwordIs("ppol-staff", OLD));
    }

    @Test
    void shouldRefuseTheEightDigitsEveryoneTries_butAcceptAnOrdinaryEightCharacters() throws Exception {
        User staff = createUser("ppol-staff", User.UserRole.STAFF, OLD);

        changePassword(staff, null, OLD, "12345678").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_TOO_COMMON"));
        changePassword(staff, null, OLD, "k7Qm2xPv").andExpect(status().isOk());

        assertTrue(passwordIs("ppol-staff", "k7Qm2xPv"));
    }

    @Test
    void shouldCompareWithTheNamedUsersUsername_whenAnAdminChangesSomeoneElsesPassword() throws Exception {
        User admin = createUser("ppol-admin", User.UserRole.ADMIN, "admin-password-1");
        createUser("ppol-target", User.UserRole.STAFF, OLD);

        changePassword(admin, "ppol-target", OLD, "Ppol-Target#2026")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_HAS_USERNAME"));
        assertTrue(passwordIs("ppol-target", OLD));

        changePassword(admin, "ppol-target", OLD, "Ppol-Admin#2026").andExpect(status().isOk());   // the caller's name is not the target's
        assertTrue(passwordIs("ppol-target", "Ppol-Admin#2026"));
    }

    // ---- an admin creates an account --------------------------------------------------------------

    @Test
    void shouldRefuseACommonPassword_andNotCreateTheAccount() throws Exception {
        User admin = createUser("ppol-admin", User.UserRole.ADMIN, "admin-password-1");

        createAccount(admin, "ppol-new", "welcome123")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_TOO_COMMON"))
                .andExpect(jsonPath("$.message").value(containsString("Password is too common")));

        assertTrue(userRepository.findByUsername("ppol-new").isEmpty());
    }

    @Test
    void shouldRefuseAPasswordThatContainsTheUsername_evenWhenTheUsernameIsTypedWithCapitals() throws Exception {
        User admin = createUser("ppol-admin", User.UserRole.ADMIN, "admin-password-1");

        createAccount(admin, "  Ppol-New ", "x-PPOL-NEW-x-9")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_HAS_USERNAME"))
                .andExpect(jsonPath("$.message").value("Password must not contain the username"));

        assertTrue(userRepository.findByUsername("ppol-new").isEmpty());
    }

    @Test
    void shouldRefuseAPasswordLongerThan72Bytes_andNotCreateTheAccount() throws Exception {
        User admin = createUser("ppol-admin", User.UserRole.ADMIN, "admin-password-1");

        createAccount(admin, "ppol-new", "Qx7!".repeat(18) + "z")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_TOO_LONG"));

        assertTrue(userRepository.findByUsername("ppol-new").isEmpty());
    }

    @Test
    void shouldKeepTheOldSentenceAndAddACode_whenTheNewAccountsPasswordIsTooShort() throws Exception {
        User admin = createUser("ppol-admin", User.UserRole.ADMIN, "admin-password-1");

        createAccount(admin, "ppol-new", "Ab3$xyz")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_TOO_SHORT"))
                .andExpect(jsonPath("$.message").value("Password must be at least 8 characters"));

        assertTrue(userRepository.findByUsername("ppol-new").isEmpty());
    }

    @Test
    void shouldCreateTheAccount_whenThePasswordPassesTheRule() throws Exception {
        User admin = createUser("ppol-admin", User.UserRole.ADMIN, "admin-password-1");

        createAccount(admin, "ppol-new", "Tamghas#2026rent").andExpect(status().isOk());

        assertTrue(passwordIs("ppol-new", "Tamghas#2026rent"));
    }
}

package com.samjhana.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * /api/auth/change-password went from public (anyone could name a user) to JWT-only, with an
 * 8-character minimum. These tests run through the real security filter chain.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthChangePasswordIntegrationTest {

    private static final String URL = "/api/auth/change-password";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    // A spy so the enumeration tests can count how many BCrypt comparisons a request performs.
    @SpyBean PasswordEncoder passwordEncoder;

    /** What an admin gets when the named user is unknown or the current password is wrong: one answer for both. */
    private static final String UNIFORM_FAILURE = "Invalid username or current password";

    private User createUser(String username, User.UserRole role, String password) {
        return userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode(password))
                .fullName(username).fullNameNepali(username).role(role).build());
    }

    private String bearer(User user) {
        return "Bearer " + jwtUtil.generateToken(user.getUsername());
    }

    private ResultActions changePassword(String authorization, String username, String current, String next) throws Exception {
        Map<String, String> body = new HashMap<>();
        if (username != null) body.put("username", username);
        if (current != null) body.put("currentPassword", current);
        if (next != null) body.put("newPassword", next);
        var request = post(URL).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body));
        if (authorization != null) request = request.header("Authorization", authorization);
        return mockMvc.perform(request);
    }

    private boolean passwordIs(String username, String plaintext) {
        return passwordEncoder.matches(plaintext, userRepository.findByUsername(username).orElseThrow().getPassword());
    }

    // ---- authentication is now mandatory ----------------------------------------------------------

    @Test
    void shouldReturn401AndChangeNothing_whenNoTokenIsSent() throws Exception {
        createUser("cp-victim", User.UserRole.MANAGER, "victim-password");

        changePassword(null, "cp-victim", "victim-password", "attacker-chosen-1").andExpect(status().isUnauthorized());

        assertTrue(passwordIs("cp-victim", "victim-password"));
    }

    @Test
    void shouldReturn401_whenTheTokenIsNotAValidJwt() throws Exception {
        createUser("cp-victim", User.UserRole.MANAGER, "victim-password");

        changePassword("Bearer not-a-jwt", "cp-victim", "victim-password", "attacker-chosen-1")
                .andExpect(status().isUnauthorized());

        assertTrue(passwordIs("cp-victim", "victim-password"));
    }

    // ---- changing your own password ---------------------------------------------------------------

    @Test
    void shouldChangeTheCallersOwnPassword_whenTheCurrentPasswordMatches() throws Exception {
        User staff = createUser("cp-staff", User.UserRole.STAFF, "old-password-1");

        changePassword(bearer(staff), null, "old-password-1", "new-password-2")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password changed successfully"));

        assertTrue(passwordIs("cp-staff", "new-password-2"));
        assertFalse(passwordIs("cp-staff", "old-password-1"));
    }

    @Test
    void shouldReturn400AndKeepThePassword_whenTheCurrentPasswordIsWrong() throws Exception {
        User staff = createUser("cp-staff", User.UserRole.STAFF, "old-password-1");

        changePassword(bearer(staff), null, "guessed-wrong", "new-password-2")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Current password is incorrect"));

        assertTrue(passwordIs("cp-staff", "old-password-1"));
    }

    @Test
    void shouldReject_whenTheNewPasswordIsSevenCharacters() throws Exception {
        User staff = createUser("cp-staff", User.UserRole.STAFF, "old-password-1");

        changePassword(bearer(staff), null, "old-password-1", "1234567")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("New password must be at least 8 characters"));

        assertTrue(passwordIs("cp-staff", "old-password-1"));
    }

    @Test
    void shouldAccept_whenTheNewPasswordIsExactlyEightCharacters() throws Exception {
        User staff = createUser("cp-staff", User.UserRole.STAFF, "old-password-1");

        changePassword(bearer(staff), null, "old-password-1", "12345678").andExpect(status().isOk());

        assertTrue(passwordIs("cp-staff", "12345678"));
    }

    @Test
    void shouldReject_whenNoNewPasswordIsSent() throws Exception {
        User staff = createUser("cp-staff", User.UserRole.STAFF, "old-password-1");

        changePassword(bearer(staff), null, "old-password-1", null).andExpect(status().isBadRequest());

        assertTrue(passwordIs("cp-staff", "old-password-1"));
    }

    @Test
    void shouldReturn400_whenNoCurrentPasswordIsSent() throws Exception {
        User staff = createUser("cp-staff", User.UserRole.STAFF, "old-password-1");

        changePassword(bearer(staff), null, null, "new-password-2").andExpect(status().isBadRequest());

        assertTrue(passwordIs("cp-staff", "old-password-1"));
    }

    // ---- who may change someone else's password ---------------------------------------------------

    @Test
    void shouldNotLetANonAdminTakeOverAnotherAccount_evenWithTheVictimsPassword() throws Exception {
        createUser("cp-victim", User.UserRole.MANAGER, "victim-password");
        User attacker = createUser("cp-attacker", User.UserRole.STAFF, "attacker-password");

        // The named user is ignored for non-admins, so the victim's password is checked against the attacker's hash.
        changePassword(bearer(attacker), "cp-victim", "victim-password", "hijacked-pass-1")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Current password is incorrect"));

        assertTrue(passwordIs("cp-victim", "victim-password"));
        assertTrue(passwordIs("cp-attacker", "attacker-password"));
    }

    @Test
    void shouldOnlyChangeTheCallersOwnPassword_whenANonAdminNamesSomeoneElse() throws Exception {
        createUser("cp-victim", User.UserRole.MANAGER, "victim-password");
        User staff = createUser("cp-staff", User.UserRole.STAFF, "staff-password");

        changePassword(bearer(staff), "cp-victim", "staff-password", "staff-new-pass-1").andExpect(status().isOk());

        assertTrue(passwordIs("cp-staff", "staff-new-pass-1"));
        assertTrue(passwordIs("cp-victim", "victim-password"), "the named user's password must be untouched");
    }

    @Test
    void shouldLetAnAdminChangeAnotherUsersPassword_whenTheTargetsCurrentPasswordIsGiven() throws Exception {
        User admin = createUser("cp-admin", User.UserRole.ADMIN, "admin-password");
        createUser("cp-target", User.UserRole.STAFF, "target-password");

        changePassword(bearer(admin), "cp-target", "target-password", "reset-password-9").andExpect(status().isOk());

        assertTrue(passwordIs("cp-target", "reset-password-9"));
        assertTrue(passwordIs("cp-admin", "admin-password"), "the admin's own password is unaffected");
    }

    @Test
    void shouldKeepTheTargetsPassword_whenAnAdminGetsTheTargetsCurrentPasswordWrong() throws Exception {
        User admin = createUser("cp-admin", User.UserRole.ADMIN, "admin-password");
        createUser("cp-target", User.UserRole.STAFF, "target-password");

        changePassword(bearer(admin), "cp-target", "admin-password", "reset-password-9")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(UNIFORM_FAILURE));

        assertTrue(passwordIs("cp-target", "target-password"));
    }

    @Test
    void shouldReturnTheUniformFailure_whenAnAdminNamesAnUnknownUser() throws Exception {
        User admin = createUser("cp-admin", User.UserRole.ADMIN, "admin-password");

        changePassword(bearer(admin), "no-such-user", "whatever", "reset-password-9")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(UNIFORM_FAILURE));
    }

    // ---- an admin naming another user must not be able to learn whether that user exists ----------

    @Test
    void shouldGiveTheIdenticalResponse_whenAnAdminNamesAnUnknownUserOrGivesAKnownUserTheWrongPassword() throws Exception {
        User admin = createUser("cp-admin", User.UserRole.ADMIN, "admin-password");
        createUser("cp-target", User.UserRole.STAFF, "target-password");

        MvcResult unknownUser = changePassword(bearer(admin), "no-such-user", "target-password", "reset-password-9")
                .andExpect(status().isBadRequest()).andReturn();
        MvcResult wrongPassword = changePassword(bearer(admin), "cp-target", "not-the-password", "reset-password-9")
                .andExpect(status().isBadRequest()).andReturn();

        assertEquals(wrongPassword.getResponse().getContentAsString(), unknownUser.getResponse().getContentAsString(),
                "the response body must not reveal whether the named user exists");
        assertTrue(unknownUser.getResponse().getContentAsString().contains(UNIFORM_FAILURE));
    }

    @Test
    void shouldRunExactlyOneBcryptComparison_whetherOrNotTheNamedUserExists() throws Exception {
        User admin = createUser("cp-admin", User.UserRole.ADMIN, "admin-password");
        User target = createUser("cp-target", User.UserRole.STAFF, "target-password");
        String token = bearer(admin);

        clearInvocations(passwordEncoder);
        changePassword(token, "no-such-user", "whatever-1", "reset-password-9").andExpect(status().isBadRequest());
        ArgumentCaptor<String> hashChecked = ArgumentCaptor.forClass(String.class);
        verify(passwordEncoder, times(1)).matches(any(), hashChecked.capture());
        String standInHash = hashChecked.getValue();

        clearInvocations(passwordEncoder);
        changePassword(token, "cp-target", "not-the-password", "reset-password-9").andExpect(status().isBadRequest());
        verify(passwordEncoder, times(1)).matches(any(), any());

        // The stand-in hash costs the same as a real one (same $2a$NN$ prefix and length) and is nobody's real hash.
        assertEquals(target.getPassword().substring(0, 7), standInHash.substring(0, 7));
        assertEquals(target.getPassword().length(), standInHash.length());
        assertFalse(standInHash.equals(target.getPassword()) || standInHash.equals(admin.getPassword()));
    }

    @Test
    void shouldNotLetTheResponseTimeRevealWhetherTheNamedUserExists() throws Exception {
        User admin = createUser("cp-admin", User.UserRole.ADMIN, "admin-password");
        createUser("cp-target", User.UserRole.STAFF, "target-password");
        String token = bearer(admin);

        for (int i = 0; i < 3; i++) { // warm-up: class loading, JIT, the first BCrypt
            changePassword(token, "cp-target", "not-the-password", "reset-password-9");
            changePassword(token, "no-such-user", "not-the-password", "reset-password-9");
        }
        List<Long> known = new ArrayList<>();
        List<Long> unknown = new ArrayList<>();
        for (int i = 0; i < 7; i++) { // interleaved so machine load drifts affect both alike
            known.add(millis(() -> changePassword(token, "cp-target", "not-the-password", "reset-password-9")));
            unknown.add(millis(() -> changePassword(token, "no-such-user", "not-the-password", "reset-password-9")));
        }

        long medianKnown = median(known);
        long medianUnknown = median(unknown);
        // Without the fix an unknown user returns before any BCrypt work (a few ms against ~50-100 ms), so a
        // generous 2x bound still separates the two cases cleanly while tolerating a noisy CI machine.
        assertTrue(medianUnknown * 2 >= medianKnown,
                "response time reveals user existence: unknown=" + medianUnknown + "ms known=" + medianKnown + "ms");
    }

    @Test
    void shouldGiveANonAdminTheSameAnswer_whateverUsernameTheyName() throws Exception {
        createUser("cp-victim", User.UserRole.MANAGER, "victim-password");
        User staff = createUser("cp-staff", User.UserRole.STAFF, "staff-password");

        String namesAnExistingUser = changePassword(bearer(staff), "cp-victim", "wrong-guess-1", "new-password-9")
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        String namesAnUnknownUser = changePassword(bearer(staff), "no-such-user", "wrong-guess-1", "new-password-9")
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();

        assertEquals(namesAnExistingUser, namesAnUnknownUser);
    }

    // ---- helpers -------------------------------------------------------------------------------------

    private interface Call {
        void run() throws Exception;
    }

    private static long millis(Call call) throws Exception {
        long start = System.nanoTime();
        call.run();
        return (System.nanoTime() - start) / 1_000_000;
    }

    private static long median(List<Long> samples) {
        List<Long> sorted = new ArrayList<>(samples);
        Collections.sort(sorted);
        return sorted.get(sorted.size() / 2);
    }
}

package com.samjhana.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import com.samjhana.security.LoginAttemptService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** An admin resets a forgotten password and changes roles; the person must then choose their own password. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminUserManagementIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JwtUtil jwtUtil;
    @Autowired LoginAttemptService loginAttempts;
    @Autowired ObjectMapper objectMapper;

    private User create(String username, String password, User.UserRole role) {
        return userRepository.save(User.builder().username(username).passwordHash(passwordEncoder.encode(password))
                .fullName(username).fullNameNepali(username).role(role).isActive(true).build());
    }

    private String bearer(User user) {
        return "Bearer " + jwtUtil.generateToken(user);
    }

    private ResultActions reset(String targetUsername, String authorization) throws Exception {
        var request = post("/api/admin/users/" + targetUsername + "/reset-password");
        if (authorization != null) request = request.header("Authorization", authorization);
        return mockMvc.perform(request);
    }

    private ResultActions changeRole(String targetUsername, String role, String authorization) throws Exception {
        return mockMvc.perform(put("/api/admin/users/" + targetUsername + "/role")
                .header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"" + role + "\"}"));
    }

    private ResultActions login(String username, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"));
    }

    private String temporaryPasswordFrom(ResultActions result) throws Exception {
        JsonNode body = objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
        return body.get("temporaryPassword").asText();
    }

    // ---------- reset password ----------

    @Test
    void shouldGiveATemporaryPassword_thatWorksOnce_andForcesAChange() throws Exception {
        User admin = create("um-admin-1", "Admin-pass-1234", User.UserRole.ADMIN);
        create("um-staff-1", "forgotten-1", User.UserRole.STAFF);

        ResultActions result = reset("um-staff-1", bearer(admin)).andExpect(status().isOk());
        String temporary = temporaryPasswordFrom(result);
        assertThat(temporary).hasSizeGreaterThanOrEqualTo(12);

        login("um-staff-1", "forgotten-1").andExpect(status().isUnauthorized());
        login("um-staff-1", temporary).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.mustChangePassword").value(true));
    }

    @Test
    void shouldBlockEverythingExceptChangingThePassword_untilTheTemporaryPasswordIsReplaced() throws Exception {
        User admin = create("um-admin-2", "Admin-pass-1234", User.UserRole.ADMIN);
        create("um-staff-2", "forgotten-2", User.UserRole.STAFF);
        String temporary = temporaryPasswordFrom(reset("um-staff-2", bearer(admin)));

        String token = objectMapper.readTree(login("um-staff-2", temporary).andReturn().getResponse().getContentAsString())
                .get("token").asText();
        String header = "Bearer " + token;

        mockMvc.perform(get("/api/transactions").header("Authorization", header))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
        mockMvc.perform(get("/api/auth/me").header("Authorization", header))
                .andExpect(status().isOk());

        String body = "{\"currentPassword\":\"" + temporary + "\",\"newPassword\":\"My-own-new-pass-9\"}";
        String newToken = objectMapper.readTree(mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", header).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(get("/api/transactions").header("Authorization", "Bearer " + newToken))
                .andExpect(status().isOk());
        login("um-staff-2", "My-own-new-pass-9").andExpect(status().isOk())
                .andExpect(jsonPath("$.user.mustChangePassword").value(false));
    }

    @Test
    void shouldRefuseANewPassword_thatIsTheSameAsTheCurrentOne() throws Exception {
        User admin = create("um-admin-3", "Admin-pass-1234", User.UserRole.ADMIN);
        create("um-staff-3", "forgotten-3", User.UserRole.STAFF);
        String temporary = temporaryPasswordFrom(reset("um-staff-3", bearer(admin)));
        String token = objectMapper.readTree(login("um-staff-3", temporary).andReturn().getResponse().getContentAsString())
                .get("token").asText();

        mockMvc.perform(post("/api/auth/change-password").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + temporary + "\",\"newPassword\":\"" + temporary + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldEndTheOldSessions_whenAPasswordIsReset() throws Exception {
        User admin = create("um-admin-4", "Admin-pass-1234", User.UserRole.ADMIN);
        User staff = create("um-staff-4", "forgotten-4", User.UserRole.STAFF);
        String oldToken = bearer(staff);
        mockMvc.perform(get("/api/transactions").header("Authorization", oldToken)).andExpect(status().isOk());

        reset("um-staff-4", bearer(admin)).andExpect(status().isOk());

        mockMvc.perform(get("/api/transactions").header("Authorization", oldToken)).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldLetTheUserTryAgain_whenTheyWereBlockedForTooManyWrongPasswords() throws Exception {
        User admin = create("um-admin-5", "Admin-pass-1234", User.UserRole.ADMIN);
        create("um-staff-5", "forgotten-5", User.UserRole.STAFF);
        for (int i = 0; i < 10; i++) loginAttempts.recordFailure("um-staff-5");
        assertThat(loginAttempts.isBlocked("um-staff-5")).isTrue();

        String temporary = temporaryPasswordFrom(reset("um-staff-5", bearer(admin)));

        login("um-staff-5", temporary).andExpect(status().isOk());
    }

    @Test
    void shouldRecordTheReset_withoutTheTemporaryPassword() throws Exception {
        User admin = create("um-admin-6", "Admin-pass-1234", User.UserRole.ADMIN);
        User staff = create("um-staff-6", "forgotten-6", User.UserRole.STAFF);
        String temporary = temporaryPasswordFrom(reset("um-staff-6", bearer(admin)));

        var entries = auditLogRepository.findAll().stream()
                .filter(e -> staff.getId().equals(e.getEntityId()) && e.getEntityType() == AuditLog.EntityType.USER)
                .toList();
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).getDescription()).contains("um-staff-6").contains("um-admin-6");
        assertThat(String.valueOf(entries.get(0).getOldValues()) + entries.get(0).getNewValues() + entries.get(0).getDescription())
                .doesNotContain(temporary);
    }

    @Test
    void shouldLetAnAdminResetAnotherAdmin() throws Exception {
        User admin = create("um-admin-7", "Admin-pass-1234", User.UserRole.ADMIN);
        create("um-admin-7b", "forgotten-7", User.UserRole.ADMIN);

        reset("um-admin-7b", bearer(admin)).andExpect(status().isOk());
    }

    @Test
    void shouldRefuseTheReset_forAManagerAndForStaff() throws Exception {
        User manager = create("um-manager-8", "Manager-pass-1234", User.UserRole.MANAGER);
        User staff = create("um-staff-8", "Staff-pass-1234", User.UserRole.STAFF);
        create("um-target-8", "forgotten-8", User.UserRole.STAFF);

        reset("um-target-8", bearer(manager)).andExpect(status().isForbidden());
        reset("um-target-8", bearer(staff)).andExpect(status().isForbidden());
    }

    @Test
    void shouldRefuseTheReset_whenNotLoggedIn() throws Exception {
        create("um-target-9", "forgotten-9", User.UserRole.STAFF);
        reset("um-target-9", null).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRefuseToResetYourOwnPassword_missingUsers_andDeactivatedUsers() throws Exception {
        User admin = create("um-admin-10", "Admin-pass-1234", User.UserRole.ADMIN);
        User gone = create("um-gone-10", "forgotten-10", User.UserRole.STAFF);
        gone.setIsActive(false);
        userRepository.save(gone);

        reset("um-admin-10", bearer(admin)).andExpect(status().isBadRequest());
        reset("nobody-here-10", bearer(admin)).andExpect(status().isBadRequest());
        reset("um-gone-10", bearer(admin)).andExpect(status().isBadRequest());
    }

    // ---------- change role ----------

    @Test
    void shouldChangeARole_andTakeEffectOnTheNextRequest() throws Exception {
        User admin = create("um-admin-11", "Admin-pass-1234", User.UserRole.ADMIN);
        User staff = create("um-staff-11", "Staff-pass-1234", User.UserRole.STAFF);
        String staffToken = bearer(staff);
        mockMvc.perform(get("/api/settings/nea_rate").header("Authorization", staffToken)).andExpect(status().isForbidden());

        changeRole("um-staff-11", "MANAGER", bearer(admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.role").value("MANAGER"));

        mockMvc.perform(get("/api/settings/nea_rate").header("Authorization", staffToken)).andExpect(status().isOk());
    }

    @Test
    void shouldRecordTheRoleChange() throws Exception {
        User admin = create("um-admin-12", "Admin-pass-1234", User.UserRole.ADMIN);
        User staff = create("um-staff-12", "Staff-pass-1234", User.UserRole.STAFF);

        changeRole("um-staff-12", "MANAGER", bearer(admin)).andExpect(status().isOk());

        var entries = auditLogRepository.findAll().stream()
                .filter(e -> staff.getId().equals(e.getEntityId()) && e.getEntityType() == AuditLog.EntityType.USER)
                .toList();
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).getOldValues()).contains("STAFF");
        assertThat(entries.get(0).getNewValues()).contains("MANAGER");
    }

    @Test
    void shouldRefuseARoleChange_forYourself_anUnknownRole_theSameRole_orAMissingUser() throws Exception {
        User admin = create("um-admin-13", "Admin-pass-1234", User.UserRole.ADMIN);
        create("um-staff-13", "Staff-pass-1234", User.UserRole.STAFF);

        changeRole("um-admin-13", "STAFF", bearer(admin)).andExpect(status().isBadRequest());
        changeRole("um-staff-13", "OWNER", bearer(admin)).andExpect(status().isBadRequest());
        changeRole("um-staff-13", "STAFF", bearer(admin)).andExpect(status().isBadRequest());
        changeRole("nobody-here-13", "MANAGER", bearer(admin)).andExpect(status().isBadRequest());
    }

    @Test
    void shouldRefuseARoleChange_forAManagerAndForStaff() throws Exception {
        User manager = create("um-manager-14", "Manager-pass-1234", User.UserRole.MANAGER);
        User staff = create("um-staff-14", "Staff-pass-1234", User.UserRole.STAFF);
        create("um-target-14", "Staff-pass-1234", User.UserRole.STAFF);

        changeRole("um-target-14", "ADMIN", bearer(manager)).andExpect(status().isForbidden());
        changeRole("um-target-14", "ADMIN", bearer(staff)).andExpect(status().isForbidden());
    }
}

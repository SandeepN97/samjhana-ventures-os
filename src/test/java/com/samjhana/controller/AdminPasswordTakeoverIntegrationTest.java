package com.samjhana.controller;

import com.samjhana.dto.ChangePasswordRequest;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding P1b-02: an admin could reset another admin's password and then, using the temporary password it had just been
 * handed as the "current" one, set the new password itself, so it - not the other admin - chose it. And a password
 * change left no record of who changed whose.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdminPasswordTakeoverIntegrationTest {

    @Autowired AuthController authController;
    @Autowired AdminController adminController;
    @Autowired UserRepository users;
    @Autowired AuditLogRepository auditLogs;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired EntityManager entityManager;

    private User account(String username, User.UserRole role) {
        User saved = users.save(User.builder().username(username).passwordHash(passwordEncoder.encode("old-password-1"))
                .fullName(username).fullNameNepali(username).role(role).build());
        entityManager.flush();
        return saved;
    }

    private User stored(UUID id) {
        entityManager.flush();
        entityManager.clear();
        return users.findById(id).orElseThrow();
    }

    private ResponseEntity<?> changePassword(User actor, String targetUsername, String current, String next) {
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setUsername(targetUsername);
        request.setCurrentPassword(current);
        request.setNewPassword(next);
        return authController.changePassword(request, actor, new MockHttpServletRequest());
    }

    @SuppressWarnings("unchecked")
    private static String message(ResponseEntity<?> response) {
        return String.valueOf(((Map<String, Object>) response.getBody()).get("message"));
    }

    @SuppressWarnings("unchecked")
    private String resetAndGetTemporaryPassword(User actor, String targetUsername) {
        ResponseEntity<?> reset = adminController.resetPassword(targetUsername, actor);
        assertThat(reset.getStatusCode().value()).isEqualTo(200);
        return String.valueOf(((Map<String, Object>) reset.getBody()).get("temporaryPassword"));
    }

    private List<AuditLog> passwordRows(UUID targetId) {
        return auditLogs.findAll().stream()
                .filter(a -> targetId.equals(a.getEntityId()) && a.getDescription() != null
                        && a.getDescription().toLowerCase().contains("password changed")).toList();
    }

    private List<AuditLog> rowsAbout(UUID entityId) {
        return auditLogs.findAll().stream().filter(a -> entityId.equals(a.getEntityId())).toList();
    }

    @Test
    void shouldRecordNothing_whenTheChangeIsRefusedBecauseThePasswordIsStillTemporary() {
        User resetter = account("p1b02-quiet-resetter", User.UserRole.ADMIN);
        User victim = account("p1b02-quiet-victim", User.UserRole.ADMIN);
        String temporary = resetAndGetTemporaryPassword(resetter, victim.getUsername());
        int rowsBefore = rowsAbout(victim.getId()).size();

        ResponseEntity<?> response = changePassword(resetter, victim.getUsername(), temporary, "attacker-chosen-1");

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(rowsAbout(victim.getId())).as("audit rows about the refused change").hasSize(rowsBefore);
    }

    @Test
    void shouldRecordNothingAndChangeNothing_whenTheNewPasswordIsTooShort() {
        User admin = account("p1b02-short-actor", User.UserRole.ADMIN);
        User staff = account("p1b02-short-target", User.UserRole.STAFF);
        int rowsBefore = rowsAbout(staff.getId()).size();

        ResponseEntity<?> response = changePassword(admin, staff.getUsername(), "old-password-1", "short");

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(rowsAbout(staff.getId())).as("audit rows about the refused change").hasSize(rowsBefore);
        assertThat(passwordEncoder.matches("old-password-1", stored(staff.getId()).getPasswordHash())).isTrue();
    }

    @Test
    void shouldRefuseTheResettingAdminChoosingTheOtherAdminsNewPassword() {
        User resetter = account("p1b02-resetter", User.UserRole.ADMIN);
        User victim = account("p1b02-victim", User.UserRole.ADMIN);
        String temporary = resetAndGetTemporaryPassword(resetter, victim.getUsername());

        ResponseEntity<?> response = changePassword(resetter, victim.getUsername(), temporary, "attacker-chosen-1");

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(message(response)).containsIgnoringCase("temporary");
        User now = stored(victim.getId());
        assertThat(now.getMustChangePassword()).isTrue();
        assertThat(passwordEncoder.matches(temporary, now.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches("attacker-chosen-1", now.getPasswordHash())).isFalse();
    }

    @Test
    void shouldLetAnAdminChangeAnotherUsersPassword_afterThatUserHasChosenTheirOwn() {
        User admin = account("p1b02-helper", User.UserRole.ADMIN);
        User staff = account("p1b02-staff", User.UserRole.STAFF);

        ResponseEntity<?> response = changePassword(admin, staff.getUsername(), "old-password-1", "new-password-9");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(passwordEncoder.matches("new-password-9", stored(staff.getId()).getPasswordHash())).isTrue();
    }

    @Test
    void shouldRecordWhoChangedWhoseTemporaryPasswordWasReplaced_withoutTheNewPassword() {
        User admin = account("p1b02-recorder", User.UserRole.ADMIN);
        User staff = account("p1b02-recorded", User.UserRole.STAFF);

        changePassword(admin, staff.getUsername(), "old-password-1", "new-password-9");

        List<AuditLog> rows = passwordRows(staff.getId());
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getUser().getId()).isEqualTo(admin.getId());
        assertThat(rows.get(0).getEntityType()).isEqualTo(AuditLog.EntityType.USER);
        assertThat(rows.get(0).getDescription()).contains("p1b02-recorded").contains("p1b02-recorder");
        assertThat(String.valueOf(rows.get(0).getNewValues())).doesNotContain("new-password-9");
        assertThat(String.valueOf(rows.get(0).getOldValues())).doesNotContain("old-password-1");
    }

    @Test
    void shouldRecordAPersonChangingTheirOwnPassword() {
        User staff = account("p1b02-self", User.UserRole.STAFF);

        ResponseEntity<?> response = changePassword(staff, null, "old-password-1", "new-password-9");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        List<AuditLog> rows = passwordRows(staff.getId());
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getUser().getId()).isEqualTo(staff.getId());
    }

    @Test
    void shouldRecordNothingAndChangeNothing_whenTheCurrentPasswordIsWrong() {
        User admin = account("p1b02-wrong-actor", User.UserRole.ADMIN);
        User staff = account("p1b02-wrong-target", User.UserRole.STAFF);

        ResponseEntity<?> response = changePassword(admin, staff.getUsername(), "not-the-password", "new-password-9");

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(passwordRows(staff.getId())).isEmpty();
        assertThat(passwordEncoder.matches("old-password-1", stored(staff.getId()).getPasswordHash())).isTrue();
    }

    @Test
    void shouldLetAPersonWhoHasATemporaryPasswordChooseTheirOwn() {
        User admin = account("p1b02-giver", User.UserRole.ADMIN);
        User staff = account("p1b02-receiver", User.UserRole.STAFF);
        String temporary = resetAndGetTemporaryPassword(admin, staff.getUsername());
        User asSignedIn = stored(staff.getId());

        ResponseEntity<?> response = changePassword(asSignedIn, null, temporary, "their-own-password-7");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        User now = stored(staff.getId());
        assertThat(now.getMustChangePassword()).isFalse();
        assertThat(passwordEncoder.matches("their-own-password-7", now.getPasswordHash())).isTrue();
    }
}

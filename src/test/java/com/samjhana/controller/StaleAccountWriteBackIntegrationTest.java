package com.samjhana.controller;

import com.samjhana.dto.ChangePasswordRequest;
import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;

/**
 * Finding P1b-01: a person's own profile save (and own password change) wrote back the copy of their account that
 * was read when the request started, whole. If an admin demoted, deactivated or reset that person in between, the
 * stale copy put the old role, the active flag and the old password back, and the admin's screen still said it had
 * worked. Now each action writes only the columns it is about, so it cannot undo anything else. The same goes for the
 * admin's own actions: a role change must not undo a password someone has just chosen.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StaleAccountWriteBackIntegrationTest {

    @Autowired AuthController authController;
    @Autowired AdminController adminController;
    @SpyBean UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager entityManager;
    @Autowired PasswordEncoder passwordEncoder;

    private User account(String username, User.UserRole role) {
        User saved = users.save(User.builder().username(username).passwordHash(passwordEncoder.encode("old-password-1"))
                .fullName("Old Name").fullNameNepali("पुरानो नाम").role(role).build());
        entityManager.flush();
        return saved;
    }

    /** The copy of the account the request filter read at the start of a request: it does not change afterwards. */
    private static User snapshot(User u) {
        return User.builder().id(u.getId()).username(u.getUsername()).passwordHash(u.getPasswordHash())
                .fullName(u.getFullName()).fullNameNepali(u.getFullNameNepali()).role(u.getRole()).locale(u.getLocale())
                .timezone(u.getTimezone()).phoneNumber(u.getPhoneNumber()).isActive(u.getIsActive())
                .mustChangePassword(u.getMustChangePassword()).build();
    }

    private void changedBehindTheirBack(UUID id, String set, Object... args) {
        Object[] all = new Object[args.length + 1];
        System.arraycopy(args, 0, all, 0, args.length);
        all[args.length] = id;
        jdbc.update("update users set " + set + " where id = ?", all);
        entityManager.clear();
    }

    private User stored(UUID id) {
        entityManager.flush();
        entityManager.clear();
        return users.findById(id).orElseThrow();
    }

    // ---- the person's own profile save ----

    @Test
    void shouldNotUndoADemotion_whenThePersonSavesTheirProfile() {
        User manager = account("p1b01-profile-demoted", User.UserRole.MANAGER);
        User stale = snapshot(manager);
        changedBehindTheirBack(manager.getId(), "role = ?", "STAFF");

        authController.updateProfile(Map.of("fullName", "New Name"), stale);

        assertThat(stored(manager.getId()).getRole()).isEqualTo(User.UserRole.STAFF);
    }

    @Test
    void shouldNotUndoADeactivation_whenThePersonSavesTheirProfile() {
        User staff = account("p1b01-profile-deactivated", User.UserRole.STAFF);
        User stale = snapshot(staff);
        changedBehindTheirBack(staff.getId(), "is_active = ?", false);

        authController.updateProfile(Map.of("fullName", "New Name"), stale);

        assertThat(stored(staff.getId()).getIsActive()).isFalse();
    }

    @Test
    void shouldNotUndoAPasswordReset_whenThePersonSavesTheirProfile() {
        User staff = account("p1b01-profile-reset", User.UserRole.STAFF);
        User stale = snapshot(staff);
        changedBehindTheirBack(staff.getId(), "password_hash = ?, must_change_password = ?", "reset-hash", true);

        authController.updateProfile(Map.of("fullName", "New Name"), stale);

        User now = stored(staff.getId());
        assertThat(now.getPasswordHash()).isEqualTo("reset-hash");
        assertThat(now.getMustChangePassword()).isTrue();
    }

    @Test
    void shouldSaveBothNames_andAnswerWithTheAccountAsItIsNow() {
        User manager = account("p1b01-profile-names", User.UserRole.MANAGER);
        User stale = snapshot(manager);
        changedBehindTheirBack(manager.getId(), "role = ?", "STAFF");

        ResponseEntity<?> response = authController.updateProfile(
                Map.of("fullName", "  New Name  ", "fullNameNepali", "  नयाँ नाम "), stale);

        User now = stored(manager.getId());
        assertThat(now.getFullName()).isEqualTo("New Name");
        assertThat(now.getFullNameNepali()).isEqualTo("नयाँ नाम");
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().toString()).contains("New Name").contains("STAFF").doesNotContain("MANAGER");
    }

    @Test
    void shouldKeepTheNepaliName_whenOnlyTheEnglishNameIsGiven() {
        User staff = account("p1b01-profile-keep-nepali", User.UserRole.STAFF);

        authController.updateProfile(Map.of("fullName", "Only English"), snapshot(staff));

        User now = stored(staff.getId());
        assertThat(now.getFullName()).isEqualTo("Only English");
        assertThat(now.getFullNameNepali()).isEqualTo("पुरानो नाम");
    }

    @Test
    void shouldRefuseAnEmptyName_andChangeNothing() {
        User staff = account("p1b01-profile-empty", User.UserRole.STAFF);

        ResponseEntity<?> response = authController.updateProfile(Map.of("fullName", "   "), snapshot(staff));

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(stored(staff.getId()).getFullName()).isEqualTo("Old Name");
    }

    // ---- the person's own password change ----

    @Test
    void shouldNotUndoADemotionOrDeactivation_whenThePersonChangesTheirOwnPassword() {
        User manager = account("p1b01-own-password", User.UserRole.MANAGER);
        User stale = snapshot(manager);
        changedBehindTheirBack(manager.getId(), "role = ?, is_active = ?", "STAFF", false);
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setCurrentPassword("old-password-1");
        request.setNewPassword("brand-new-password-2");

        ResponseEntity<?> response = authController.changePassword(request, stale, new org.springframework.mock.web.MockHttpServletRequest());

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        User now = stored(manager.getId());
        assertThat(now.getRole()).isEqualTo(User.UserRole.STAFF);
        assertThat(now.getIsActive()).isFalse();
        assertThat(passwordEncoder.matches("brand-new-password-2", now.getPasswordHash())).isTrue();
        assertThat(now.getMustChangePassword()).isFalse();
    }

    @Test
    void shouldClearTheMustChangeFlag_andIssueATokenForTheNewPassword() {
        User staff = account("p1b01-own-token", User.UserRole.STAFF);
        changedBehindTheirBack(staff.getId(), "must_change_password = ?", true);
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setCurrentPassword("old-password-1");
        request.setNewPassword("brand-new-password-2");

        ResponseEntity<?> response = authController.changePassword(request, snapshot(staff), new org.springframework.mock.web.MockHttpServletRequest());

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(((Map<?, ?>) response.getBody()).get("token")).isNotNull();
        assertThat(stored(staff.getId()).getMustChangePassword()).isFalse();
    }

    // ---- the admin's actions must not undo what someone else changed in the meantime ----

    /** After the admin's request has read the account, something else changes it (here: the person chooses a new password). */
    private void somethingChangesAfterTheAccountIsRead(String username, UUID id, String set, Object... args) {
        doAnswer(invocation -> {
            Optional<User> found = entityManager.createQuery("select u from User u where u.username = :name", User.class)
                    .setParameter("name", username).getResultStream().findFirst();   // the account, as the request reads it
            jdbc.update("update users set " + set + " where id = ?", append(args, id));   // then something else changes it
            return found;
        }).when(users).findByUsername(eq(username));
    }

    private static Object[] append(Object[] args, Object last) {
        Object[] all = new Object[args.length + 1];
        System.arraycopy(args, 0, all, 0, args.length);
        all[args.length] = last;
        return all;
    }

    @Test
    void shouldNotUndoANewPassword_whenAnAdminChangesTheRole() {
        User admin = account("p1b01-admin-1", User.UserRole.ADMIN);
        User target = account("p1b01-target-role", User.UserRole.MANAGER);
        somethingChangesAfterTheAccountIsRead("p1b01-target-role", target.getId(), "password_hash = ?", "chosen-just-now");

        adminController.changeRole("p1b01-target-role", Map.of("role", "STAFF"), snapshot(admin));

        User now = stored(target.getId());
        assertThat(now.getRole()).isEqualTo(User.UserRole.STAFF);
        assertThat(now.getPasswordHash()).isEqualTo("chosen-just-now");
    }

    @Test
    void shouldNotUndoANewRole_whenAnAdminResetsThePassword() {
        User admin = account("p1b01-admin-2", User.UserRole.ADMIN);
        User target = account("p1b01-target-reset", User.UserRole.MANAGER);
        somethingChangesAfterTheAccountIsRead("p1b01-target-reset", target.getId(), "role = ?", "STAFF");

        adminController.resetPassword("p1b01-target-reset", snapshot(admin));

        User now = stored(target.getId());
        assertThat(now.getRole()).isEqualTo(User.UserRole.STAFF);
        assertThat(now.getMustChangePassword()).isTrue();
        assertThat(passwordEncoder.matches("old-password-1", now.getPasswordHash())).isFalse();
    }

    @Test
    void shouldNotUndoANewPassword_whenAnAdminDeactivatesTheAccount() {
        User admin = account("p1b01-admin-3", User.UserRole.ADMIN);
        User target = account("p1b01-target-off", User.UserRole.STAFF);
        somethingChangesAfterTheAccountIsRead("p1b01-target-off", target.getId(), "password_hash = ?", "chosen-just-now");

        adminController.deleteUser("p1b01-target-off", snapshot(admin));

        User now = stored(target.getId());
        assertThat(now.getIsActive()).isFalse();
        assertThat(now.getPasswordHash()).isEqualTo("chosen-just-now");
    }

    @Test
    void shouldChangeTheRoleDeactivateAndResetAsBefore_whenNothingElseChanges() {
        User admin = account("p1b01-admin-4", User.UserRole.ADMIN);
        User first = account("p1b01-plain-role", User.UserRole.STAFF);
        User second = account("p1b01-plain-reset", User.UserRole.STAFF);
        User third = account("p1b01-plain-off", User.UserRole.STAFF);

        adminController.changeRole("p1b01-plain-role", Map.of("role", "MANAGER"), snapshot(admin));
        adminController.resetPassword("p1b01-plain-reset", snapshot(admin));
        adminController.deleteUser("p1b01-plain-off", snapshot(admin));

        assertThat(stored(first.getId()).getRole()).isEqualTo(User.UserRole.MANAGER);
        User reset = stored(second.getId());
        assertThat(reset.getMustChangePassword()).isTrue();
        assertThat(reset.getRole()).isEqualTo(User.UserRole.STAFF);
        assertThat(stored(third.getId()).getIsActive()).isFalse();
    }

    @Test
    void shouldRefreshTheTimeTheAccountWasLastChanged_whenAnyOfTheseActionsChangesIt() {
        User admin = account("p1b01-admin-6", User.UserRole.ADMIN);
        User byProfile = account("p1b01-time-profile", User.UserRole.STAFF);
        User byRole = account("p1b01-time-role", User.UserRole.STAFF);
        User byReset = account("p1b01-time-reset", User.UserRole.STAFF);
        User byOff = account("p1b01-time-off", User.UserRole.STAFF);
        User byOwnPassword = account("p1b01-time-own", User.UserRole.STAFF);
        for (User u : new User[] {byProfile, byRole, byReset, byOff, byOwnPassword}) {
            jdbc.update("update users set updated_at = ? where id = ?", java.sql.Timestamp.valueOf("2020-01-01 00:00:00"), u.getId());
        }
        entityManager.clear();
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setCurrentPassword("old-password-1");
        request.setNewPassword("brand-new-password-2");

        authController.updateProfile(Map.of("fullName", "X"), snapshot(byProfile));
        adminController.changeRole("p1b01-time-role", Map.of("role", "MANAGER"), snapshot(admin));
        adminController.resetPassword("p1b01-time-reset", snapshot(admin));
        adminController.deleteUser("p1b01-time-off", snapshot(admin));
        authController.changePassword(request, snapshot(byOwnPassword), new org.springframework.mock.web.MockHttpServletRequest());

        java.time.LocalDateTime recent = java.time.LocalDateTime.now().minusDays(1);
        for (User u : new User[] {byProfile, byRole, byReset, byOff, byOwnPassword}) {
            assertThat(stored(u.getId()).getUpdatedAt()).as(u.getUsername()).isAfter(recent);
        }
    }

    @Test
    void shouldNotWriteAnExistingAccountBackWhole_fromAnyOfTheseActions() {
        User admin = account("p1b01-admin-5", User.UserRole.ADMIN);
        account("p1b01-no-save", User.UserRole.STAFF);
        org.mockito.Mockito.clearInvocations(users);

        authController.updateProfile(Map.of("fullName", "X"), snapshot(users.findByUsername("p1b01-no-save").orElseThrow()));
        adminController.changeRole("p1b01-no-save", Map.of("role", "MANAGER"), snapshot(admin));
        adminController.resetPassword("p1b01-no-save", snapshot(admin));
        adminController.deleteUser("p1b01-no-save", snapshot(admin));

        org.mockito.Mockito.verify(users, org.mockito.Mockito.never()).save(any(User.class));
    }
}

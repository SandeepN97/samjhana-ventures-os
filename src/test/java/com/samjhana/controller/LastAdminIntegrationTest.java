package com.samjhana.controller;

import com.samjhana.entity.AuditLog;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;

/**
 * Finding P1b-02: two admins demoting each other at the same moment each passed the "not yourself" check, each
 * request having been authorised with a role read when it started, so both succeeded and nobody was left in charge.
 * Not a transactional test: the point is two real transactions at once.
 */
@SpringBootTest
@ActiveProfiles("test")
class LastAdminIntegrationTest {

    @Autowired AdminController adminController;
    @SpyBean UserRepository users;
    @Autowired AuditLogRepository auditLogs;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired PlatformTransactionManager transactionManager;
    @PersistenceContext EntityManager entityManager;

    private final List<UUID> adminsThatWereActive = new ArrayList<>();
    private final List<UUID> createdHere = new ArrayList<>();

    @BeforeEach
    void leaveOnlyTheAdminsOfThisTest() {
        reset(users);
        adminsThatWereActive.addAll(jdbc.queryForList("select id from users where role = 'ADMIN' and is_active = true", UUID.class));
        jdbc.update("update users set is_active = false where role = 'ADMIN' and is_active = true");
    }

    @AfterEach
    void putThingsBack() {
        reset(users);
        for (UUID id : createdHere) {
            jdbc.update("update users set is_active = false, role = 'STAFF' where id = ?", id);
        }
        for (UUID id : adminsThatWereActive) {
            jdbc.update("update users set is_active = true where id = ?", id);
        }
    }

    private User newAdmin(String username) {
        User saved = users.save(User.builder().username(username).passwordHash(passwordEncoder.encode("old-password-1"))
                .fullName(username).fullNameNepali(username).role(User.UserRole.ADMIN).build());
        createdHere.add(saved.getId());
        return saved;
    }

    private static User asReadAtTheStartOfARequest(User u) {
        return User.builder().id(u.getId()).username(u.getUsername()).passwordHash(u.getPasswordHash())
                .fullName(u.getFullName()).role(u.getRole()).isActive(true).mustChangePassword(false).build();
    }

    private int activeAdmins() {
        return jdbc.queryForObject("select count(*) from users where role = 'ADMIN' and is_active = true", Integer.class);
    }

    @Test
    void shouldDemoteAnotherAdminAndRecordIt_whenAnotherAdminRemains() {
        User actor = newAdmin("p1b02-solo-actor");
        User other = newAdmin("p1b02-solo-other");

        ResponseEntity<?> response = adminController.changeRole(other.getUsername(), Map.of("role", "STAFF"),
                asReadAtTheStartOfARequest(actor));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(jdbc.queryForObject("select role from users where id = ?", String.class, other.getId())).isEqualTo("STAFF");
        assertThat(activeAdmins()).isEqualTo(1);
        List<AuditLog> rows = auditLogs.findAll().stream()
                .filter(a -> other.getId().equals(a.getEntityId()) && a.getDescription() != null
                        && a.getDescription().contains("Role of p1b02-solo-other")).toList();
        assertThat(rows).hasSize(1);
    }

    @Test
    void shouldNeverLeaveTheAppWithoutAnAdmin_whenTwoAdminsDemoteEachOtherAtTheSameTime() throws Exception {
        User a = newAdmin("p1b02-race-a");
        User b = newAdmin("p1b02-race-b");
        User aAsRead = asReadAtTheStartOfARequest(a);
        User bAsRead = asReadAtTheStartOfARequest(b);

        // Hold every role update back until both requests have got that far (or half a second has passed), so that
        // without protection both requests act on the same, stale picture of who the admins are.
        CountDownLatch bothAtTheUpdate = new CountDownLatch(2);
        doAnswer(inv -> {
            bothAtTheUpdate.countDown();
            bothAtTheUpdate.await(500, TimeUnit.MILLISECONDS);
            UUID id = inv.getArgument(0);
            User.UserRole role = inv.getArgument(1);
            LocalDateTime now = inv.getArgument(2);
            return new TransactionTemplate(transactionManager).execute(status ->
                    entityManager.createQuery("update User u set u.role = :role, u.updatedAt = :now where u.id = :id")
                            .setParameter("role", role).setParameter("now", now).setParameter("id", id).executeUpdate());
        }).when(users).updateRole(any(), any(), any());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            Future<ResponseEntity<?>> aDemotesB = pool.submit(() -> {
                go.await();
                return adminController.changeRole(b.getUsername(), Map.of("role", "STAFF"), aAsRead);
            });
            Future<ResponseEntity<?>> bDemotesA = pool.submit(() -> {
                go.await();
                return adminController.changeRole(a.getUsername(), Map.of("role", "STAFF"), bAsRead);
            });
            go.countDown();
            List<Integer> statuses = List.of(aDemotesB.get(30, TimeUnit.SECONDS).getStatusCode().value(),
                    bDemotesA.get(30, TimeUnit.SECONDS).getStatusCode().value());

            assertThat(activeAdmins()).as("admins left").isEqualTo(1);
            assertThat(statuses).as("one request succeeds, the other is refused").containsOnlyOnce(200);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void shouldRefuseADeactivatedAdminsRequestThatWasAlreadyRunning_andKeepTheOnlyActiveAdmin() {
        User onlyActiveAdmin = newAdmin("p1b02-only-admin");
        User deactivated = newAdmin("p1b02-deactivated-admin");
        User asReadBeforeTheDeactivation = asReadAtTheStartOfARequest(deactivated);
        jdbc.update("update users set is_active = false where id = ?", deactivated.getId());

        ResponseEntity<?> response = adminController.changeRole(onlyActiveAdmin.getUsername(), Map.of("role", "STAFF"),
                asReadBeforeTheDeactivation);

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        assertThat(activeAdmins()).isEqualTo(1);
    }
}

package com.samjhana.controller;

import com.samjhana.entity.AuditLog;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.LoginAttemptService;
import com.samjhana.service.AccountRoleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Finding P1b-02: how the answer of the role-change service is shown to the admin who asked. */
@ExtendWith(MockitoExtension.class)
class AdminControllerRoleChangeTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock AuditLogRepository auditLogRepository;
    @Mock LoginAttemptService loginAttempts;
    @Mock AccountRoleService accountRoleService;
    @Mock ObjectProvider<com.samjhana.service.DemoDataSeederService> demoDataSeederService;

    AdminController controller;
    final User actor = User.builder().id(UUID.randomUUID()).username("actor").role(User.UserRole.ADMIN).isActive(true).build();
    final User target = User.builder().id(UUID.randomUUID()).username("target").role(User.UserRole.ADMIN).isActive(true).build();

    @BeforeEach
    void setUp() {
        controller = new AdminController(userRepository, passwordEncoder, auditLogRepository, loginAttempts,
                accountRoleService, demoDataSeederService);
        when(userRepository.findByUsername("target")).thenReturn(Optional.of(target));
    }

    @Test
    void shouldAnswer400AndRecordNothing_whenTheChangeWouldLeaveNoAdmin() {
        when(accountRoleService.changeRole(actor.getId(), target.getId(), User.UserRole.STAFF))
                .thenReturn(AccountRoleService.Outcome.WOULD_LEAVE_NO_ADMIN);

        ResponseEntity<?> response = controller.changeRole("target", Map.of("role", "STAFF"), actor);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(String.valueOf(((Map<?, ?>) response.getBody()).get("message"))).contains("at least one active admin");
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void shouldAnswer403AndRecordNothing_whenTheActorIsNoLongerAnAdmin() {
        when(accountRoleService.changeRole(actor.getId(), target.getId(), User.UserRole.STAFF))
                .thenReturn(AccountRoleService.Outcome.ACTOR_IS_NOT_AN_ADMIN);

        ResponseEntity<?> response = controller.changeRole("target", Map.of("role", "STAFF"), actor);

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void shouldRecordWhoChangedWhichRole_whenTheChangeWasMade() {
        when(accountRoleService.changeRole(actor.getId(), target.getId(), User.UserRole.STAFF))
                .thenReturn(AccountRoleService.Outcome.CHANGED);
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));

        ResponseEntity<?> response = controller.changeRole("target", Map.of("role", "STAFF"), actor);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        ArgumentCaptor<AuditLog> row = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(row.capture());
        assertThat(row.getValue().getDescription()).contains("target").contains("ADMIN").contains("STAFF").contains("actor");
    }
}

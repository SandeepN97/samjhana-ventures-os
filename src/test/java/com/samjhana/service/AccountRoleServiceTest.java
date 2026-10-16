package com.samjhana.service;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Finding P1b-02: a role change is decided against the admins as they are right now (read under a lock), so two
 * admins cannot take each other's admin role away at the same moment and leave nobody in charge.
 */
@ExtendWith(MockitoExtension.class)
class AccountRoleServiceTest {

    @Mock UserRepository userRepository;
    AccountRoleService service;

    private final User actor = admin("actor");
    private final User target = admin("target");

    private static User admin(String name) {
        return User.builder().id(UUID.randomUUID()).username(name).role(User.UserRole.ADMIN).isActive(true).build();
    }

    @BeforeEach
    void setUp() {
        service = new AccountRoleService(userRepository);
    }

    @Test
    void shouldChangeTheRole_whenAnotherActiveAdminRemains() {
        when(userRepository.lockActiveAdmins()).thenReturn(List.of(actor, target));

        AccountRoleService.Outcome outcome = service.changeRole(actor.getId(), target.getId(), User.UserRole.STAFF);

        assertThat(outcome).isEqualTo(AccountRoleService.Outcome.CHANGED);
        verify(userRepository).updateRole(eq(target.getId()), eq(User.UserRole.STAFF), any(LocalDateTime.class));
    }

    @Test
    void shouldRefuse_whenTheChangeWouldLeaveNoActiveAdmin() {
        when(userRepository.lockActiveAdmins()).thenReturn(List.of(actor));

        AccountRoleService.Outcome outcome = service.changeRole(actor.getId(), actor.getId(), User.UserRole.STAFF);

        assertThat(outcome).isEqualTo(AccountRoleService.Outcome.WOULD_LEAVE_NO_ADMIN);
        verify(userRepository, never()).updateRole(any(), any(), any());
    }

    @Test
    void shouldRefuse_whenTheActorIsNoLongerAnAdmin() {
        User someoneElse = admin("someone-else");
        // the actor was demoted a moment ago: the locked list of admins no longer contains them
        when(userRepository.lockActiveAdmins()).thenReturn(List.of(target, someoneElse));

        AccountRoleService.Outcome outcome = service.changeRole(actor.getId(), target.getId(), User.UserRole.STAFF);

        assertThat(outcome).isEqualTo(AccountRoleService.Outcome.ACTOR_IS_NOT_AN_ADMIN);
        verify(userRepository, never()).updateRole(any(), any(), any());
    }

    @Test
    void shouldAllowMakingSomeoneAnAdmin_evenWhenTheActorIsTheOnlyAdmin() {
        User staff = User.builder().id(UUID.randomUUID()).username("staff").role(User.UserRole.STAFF).isActive(true).build();
        when(userRepository.lockActiveAdmins()).thenReturn(List.of(actor));

        AccountRoleService.Outcome outcome = service.changeRole(actor.getId(), staff.getId(), User.UserRole.ADMIN);

        assertThat(outcome).isEqualTo(AccountRoleService.Outcome.CHANGED);
        verify(userRepository).updateRole(eq(staff.getId()), eq(User.UserRole.ADMIN), any(LocalDateTime.class));
    }

    @Test
    void shouldAllowChangingAManagersRole_evenWhenTheActorIsTheOnlyAdmin() {
        User manager = User.builder().id(UUID.randomUUID()).username("manager").role(User.UserRole.MANAGER).isActive(true).build();
        when(userRepository.lockActiveAdmins()).thenReturn(List.of(actor));

        AccountRoleService.Outcome outcome = service.changeRole(actor.getId(), manager.getId(), User.UserRole.STAFF);

        assertThat(outcome).isEqualTo(AccountRoleService.Outcome.CHANGED);
    }

    @Test
    void shouldLockTheAdminsBeforeItChangesAnything() {
        when(userRepository.lockActiveAdmins()).thenReturn(List.of(actor, target));

        service.changeRole(actor.getId(), target.getId(), User.UserRole.MANAGER);

        InOrder order = inOrder(userRepository);
        order.verify(userRepository).lockActiveAdmins();
        order.verify(userRepository).updateRole(eq(target.getId()), eq(User.UserRole.MANAGER), any(LocalDateTime.class));
    }

    @Test
    void shouldNotRefuse_whenTheOnlyAdminIsGivenTheAdminRoleAgain() {
        when(userRepository.lockActiveAdmins()).thenReturn(List.of(actor));

        AccountRoleService.Outcome outcome = service.changeRole(actor.getId(), actor.getId(), User.UserRole.ADMIN);

        assertThat(outcome).isEqualTo(AccountRoleService.Outcome.CHANGED);   // nobody is losing the admin role
    }
}

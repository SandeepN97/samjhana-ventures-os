package com.samjhana.service;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Changes a person's role without ever leaving the app with no active admin (finding P1b-02).
 *
 * <p>Every request was authorised with the role it read at its start, so two admins demoting each other at the same
 * moment each looked like an admin acting on another admin, and both succeeded. The active admins are therefore
 * read again here, locked, in the same transaction as the change: the second request waits, sees what the first did,
 * and is refused.
 */
@Service
@RequiredArgsConstructor
public class AccountRoleService {

    public enum Outcome {
        CHANGED,
        /** The person asking is no longer an active admin (they were demoted or deactivated while the request ran). */
        ACTOR_IS_NOT_AN_ADMIN,
        /** The change would take the last active admin's admin role away. */
        WOULD_LEAVE_NO_ADMIN
    }

    private final UserRepository userRepository;

    @Transactional
    public Outcome changeRole(UUID actorId, UUID targetId, User.UserRole newRole) {
        List<User> admins = userRepository.lockActiveAdmins();
        if (admins.stream().noneMatch(admin -> admin.getId().equals(actorId))) {
            return Outcome.ACTOR_IS_NOT_AN_ADMIN;
        }
        boolean targetIsAnActiveAdmin = admins.stream().anyMatch(admin -> admin.getId().equals(targetId));
        boolean anotherAdminRemains = admins.stream().anyMatch(admin -> !admin.getId().equals(targetId));
        if (targetIsAnActiveAdmin && newRole != User.UserRole.ADMIN && !anotherAdminRemains) {
            return Outcome.WOULD_LEAVE_NO_ADMIN;
        }
        userRepository.updateRole(targetId, newRole, LocalDateTime.now());
        return Outcome.CHANGED;
    }
}

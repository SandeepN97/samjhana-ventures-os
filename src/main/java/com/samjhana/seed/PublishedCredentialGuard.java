package com.samjhana.seed;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * SECURITY (P1BX-01). Older versions of this app created demo logins whose passwords are published in this public
 * repository (the old "Reset demo data" ran in every environment), and the dev seeder's logins are in the README.
 * A staging or production database may therefore still hold an account that anyone can sign in to.
 *
 * <p>On every start outside dev and test, once the app is up (so after {@link FirstRunInitializer}), each account
 * listed below that is still active and still accepts a published password is switched off. The log names the
 * account, never the password. The Users page cannot switch an account back on (and an admin cannot reset the
 * password of a switched-off account), so getting one back is a deliberate step in the Supabase SQL editor:
 * see docs/RECOVERY.md.
 *
 * <p>Passwords checked: the username itself, the username followed by "123", and any value listed in
 * {@code samjhana.security.published-passwords} (environment variable {@code SAMJHANA_SECURITY_PUBLISHEDPASSWORDS},
 * comma-separated) for published values that are not derived from the username. No password is written in code.
 */
@Component
@Profile("!dev & !test")
@RequiredArgsConstructor
@Slf4j
public class PublishedCredentialGuard {

    /** Every username that a seeder or an old demo reset has created with a published password. */
    static final List<String> PUBLISHED_USERNAMES =
            List.of("admin", "manager", "staff", "demo", "ram_mgr", "sita_staff", "hari_staff");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${samjhana.security.published-passwords:}")
    private String extraPublishedPasswords;

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        disablePublishedLogins();
    }

    /**
     * Switches off every listed account that is active and still accepts a published password; returns how many.
     * One account that cannot be checked is logged and skipped, so this backstop can never stop the app from starting.
     */
    public int disablePublishedLogins() {
        List<String> extra = extraPublishedPasswords == null ? List.of()
                : Arrays.stream(extraPublishedPasswords.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        int switchedOff = 0;
        int notChecked = 0;
        for (String username : PUBLISHED_USERNAMES) {
            try {
                if (switchOffIfPublished(username, extra)) switchedOff++;
            } catch (RuntimeException e) {
                notChecked++;
                log.error("SECURITY: could not check whether account '{}' accepts a published password: {}", username, e.toString());
            }
        }
        if (switchedOff == 0 && notChecked == 0) {
            log.info("Published-password check: no active account accepts a published password");
        }
        return switchedOff;
    }

    private boolean switchOffIfPublished(String username, List<String> extra) {
        Optional<User> found = userRepository.findByUsername(username);
        if (found.isEmpty() || !Boolean.TRUE.equals(found.get().getIsActive())) return false;
        User user = found.get();
        List<String> candidates = new ArrayList<>(List.of(username, username + "123"));
        candidates.addAll(extra);
        if (candidates.stream().noneMatch(candidate -> passwordEncoder.matches(candidate, user.getPasswordHash()))) {
            return false;
        }
        user.setIsActive(false);
        userRepository.save(user);
        log.error("SECURITY: account '{}' still accepted a password that is published in this repository, so it has "
                + "been switched OFF. The Users page cannot switch an account back on: follow docs/RECOVERY.md "
                + "(Supabase SQL editor) to give it a new password and activate it again.", username);
        return true;
    }
}

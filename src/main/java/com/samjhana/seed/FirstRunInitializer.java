package com.samjhana.seed;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * Runs once on first boot in real (non-dev, non-test) environments. Dev seeds demo users
 * via DataSeeder; tests create their own fixtures and must not get a random admin.
 *
 * If no users exist in the database, creates the initial admin account.
 * Set ADMIN_INITIAL_PASSWORD env var to specify the password, or a secure
 * random password is generated and printed ONCE to the application log (WARN level).
 *
 * The admin MUST change this password immediately after first login.
 */
@Component
@Profile("!dev & !test")
@RequiredArgsConstructor
@Slf4j
public class FirstRunInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${ADMIN_INITIAL_PASSWORD:#{null}}")
    private String adminInitialPassword;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            return;
        }

        String password = adminInitialPassword;
        boolean generated = password == null || password.isBlank();
        if (generated) {
            byte[] bytes = new byte[16];
            new SecureRandom().nextBytes(bytes);
            password = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        }

        userRepository.save(User.builder()
                .username("admin")
                .passwordHash(passwordEncoder.encode(password))
                .fullName("System Admin")
                .fullNameNepali("प्रणाली प्रशासक")
                .role(User.UserRole.ADMIN)
                .locale("en")
                .isActive(true)
                .build());

        log.warn("=================================================================");
        log.warn("FIRST RUN: Initial admin account created.");
        log.warn("  Username : admin");
        if (generated) {
            log.warn("  Password : {}", password);
            log.warn("  (Generated automatically — set ADMIN_INITIAL_PASSWORD env var to choose your own)");
        } else {
            log.warn("  Password : set via ADMIN_INITIAL_PASSWORD");
        }
        log.warn("  CHANGE THIS PASSWORD IMMEDIATELY after first login.");
        log.warn("=================================================================");
    }
}
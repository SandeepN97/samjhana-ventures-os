package com.samjhana.service;

import com.samjhana.entity.AuditLog;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What the demo reset does where it is allowed to run (dev/staging). The bean isn't registered under
 * the test profile, so it is built by hand here with the real repositories.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DemoDataSeederServiceIntegrationTest {

    @Autowired AutowireCapableBeanFactory beanFactory;
    @Autowired UserRepository userRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private DemoDataSeederService seeder;
    private User admin;

    @BeforeEach
    void setUp() {
        seeder = beanFactory.createBean(DemoDataSeederService.class);
        admin = userRepository.save(User.builder().username("owner").passwordHash(passwordEncoder.encode("owner-real-pass"))
                .fullName("Owner").fullNameNepali("Owner").role(User.UserRole.ADMIN).isActive(true).build());
    }

    @Test
    void shouldOnlyBeRegisteredInDevAndStaging() {
        Profile profile = DemoDataSeederService.class.getAnnotation(Profile.class);
        assertThat(profile).isNotNull();
        assertThat(profile.value()).containsExactlyInAnyOrder("dev", "staging");
    }

    @Test
    void shouldKeepTheCallersLoginAndPassword_whenResetting() {
        String hashBefore = admin.getPassword();

        seeder.resetAndSeed(admin);

        User after = userRepository.findByUsername("owner").orElseThrow();
        assertThat(after.getIsActive()).isTrue();
        assertThat(after.getPassword()).isEqualTo(hashBefore);
    }

    @Test
    void shouldKeepTheAuditLog_whenResetting() {
        AuditLog entry = auditLogRepository.save(AuditLog.createEvent(admin, AuditLog.EntityType.TRANSACTION, UUID.randomUUID(), "{}"));

        seeder.resetAndSeed(admin);

        assertThat(auditLogRepository.findById(entry.getId())).isPresent();
    }

    @Test
    void shouldLeaveNoActiveAccountWithAPublishedPassword_whenResetting() {
        userRepository.save(User.builder().username("demo").passwordHash(passwordEncoder.encode("demo"))
                .fullName("Demo").fullNameNepali("Demo").role(User.UserRole.ADMIN).isActive(true).build());

        seeder.resetAndSeed(admin);

        List<User> active = userRepository.findAll().stream().filter(u -> Boolean.TRUE.equals(u.getIsActive())).toList();
        for (User u : active) {
            for (String published : List.of("admin", "demo", "pass123")) {
                assertThat(passwordEncoder.matches(published, u.getPassword()))
                        .as("%s must not log in with '%s'", u.getUsername(), published).isFalse();
            }
        }
        assertThat(userRepository.findByUsername("demo").orElseThrow().getIsActive()).isFalse();
    }

    @Test
    void shouldAttributeDemoEntriesToInactiveAccounts_whenResetting() {
        seeder.resetAndSeed(admin);

        assertThat(transactionRepository.count()).isPositive();
        for (String actor : List.of("demo_manager", "demo_staff_1", "demo_staff_2")) {
            assertThat(userRepository.findByUsername(actor).orElseThrow().getIsActive()).as(actor).isFalse();
        }
    }

    @Test
    void shouldNotCreateDuplicates_whenResetTwice() {
        seeder.resetAndSeed(admin);
        long usersAfterFirst = userRepository.count();

        seeder.resetAndSeed(admin);

        assertThat(userRepository.count()).isEqualTo(usersAfterFirst);
    }
}

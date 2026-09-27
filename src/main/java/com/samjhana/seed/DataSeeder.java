package com.samjhana.seed;

import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import jakarta.transaction.Transactional;
import java.util.List;

@Profile("dev")
@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TransactionRepository transactionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        seedUsers();
        // Business units come from BusinessUnitSeeder and EV vehicles from EvVehicleCatalogSeeder,
        // which run on every profile.
        migratePendingTransactions();
    }

    private void seedUsers() {
        if (userRepository.count() > 0) {
            log.info("Users already exist, skipping user seed.");
            return;
        }

        List<User> users = List.of(
            User.builder()
                .username("admin")
                .passwordHash(passwordEncoder.encode("admin"))
                .fullName("System Admin")
                .fullNameNepali("प्रणाली प्रशासक")
                .role(User.UserRole.ADMIN)
                .locale("en")
                .build(),
            User.builder()
                .username("manager")
                .passwordHash(passwordEncoder.encode("manager123"))
                .fullName("Manager")
                .fullNameNepali("व्यवस्थापक")
                .role(User.UserRole.MANAGER)
                .locale("ne")
                .build(),
            User.builder()
                .username("staff")
                .passwordHash(passwordEncoder.encode("staff123"))
                .fullName("Staff")
                .fullNameNepali("कर्मचारी")
                .role(User.UserRole.STAFF)
                .locale("ne")
                .build()
        );

        userRepository.saveAll(users);
        log.info("Seeded {} default users.", users.size());
    }

    private void migratePendingTransactions() {
        List<Transaction> pending = transactionRepository
                .findByStatusOrderByCreatedAtDesc(Transaction.TransactionStatus.PENDING_REVIEW);
        if (!pending.isEmpty()) {
            pending.forEach(t -> t.setStatus(Transaction.TransactionStatus.APPROVED));
            transactionRepository.saveAll(pending);
            log.info("Migrated {} PENDING_REVIEW transactions to APPROVED.", pending.size());
        }
    }


}

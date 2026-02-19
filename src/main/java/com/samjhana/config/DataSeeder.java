package com.samjhana.config;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.EvVehicle;
import com.samjhana.entity.User;
import com.samjhana.repository.EvVehicleRepository;
import com.samjhana.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;
    private final EvVehicleRepository evVehicleRepository;

    @Override
    @Transactional
    public void run(String... args) {
        seedUsers();
        seedBusinessUnits();
        seedEvVehicles();
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
                .username("dad")
                .passwordHash(passwordEncoder.encode("dad123"))
                .fullName("Nisha's Dad")
                .fullNameNepali("बुवा")
                .role(User.UserRole.DAD)
                .locale("ne")
                .build(),
            User.builder()
                .username("son")
                .passwordHash(passwordEncoder.encode("son123"))
                .fullName("Nisha")
                .fullNameNepali("निशा")
                .role(User.UserRole.SON)
                .locale("en")
                .build()
        );

        userRepository.saveAll(users);
        log.info("Seeded {} default users.", users.size());
    }

    private void seedBusinessUnits() {
        Long count = (Long) entityManager.createQuery("SELECT COUNT(b) FROM BusinessUnit b").getSingleResult();
        if (count > 0) {
            log.info("Business units already exist, skipping seed.");
            return;
        }

        List<BusinessUnit> units = List.of(
            BusinessUnit.builder()
                .code("petrol").name("Shringeshwor Petrol Pump").nameNepali("श्रृंगेश्वर पेट्रोल पम्प")
                .icon("🛢️").calculationStrategy("PetrolStrategy").displayOrder(1).build(),
            BusinessUnit.builder()
                .code("ev").name("EV Charging Station").nameNepali("EV चार्जिंग स्टेशन")
                .icon("⚡").calculationStrategy("EVStrategy").displayOrder(2).build(),
            BusinessUnit.builder()
                .code("furniture").name("Furniture Shop").nameNepali("फर्निचर पसल")
                .icon("🪑").calculationStrategy("FurnitureStrategy").displayOrder(3).build(),
            BusinessUnit.builder()
                .code("rental").name("House Rental").nameNepali("घर भाडा")
                .icon("🏠").calculationStrategy("RentalStrategy").displayOrder(4).build(),
            BusinessUnit.builder()
                .code("loan").name("Bank Loan Management").nameNepali("बैंक ऋण व्यवस्थापन")
                .icon("🏦").calculationStrategy("LoanStrategy").displayOrder(5).build()
        );

        for (BusinessUnit unit : units) {
            entityManager.persist(unit);
        }
        log.info("Seeded {} default business units.", units.size());
    }

    private void seedEvVehicles() {
        if (evVehicleRepository.count() > 0) {
            log.info("EV vehicles already exist, skipping seed.");
            return;
        }

        List<EvVehicle> vehicles = List.of(
            ev("Higer (100KW)", "100", 16, "16"),
            ev("Higer (53KW)", "53.58", 16, "16"),
            ev("Higer (70KW)", "70.47", 16, "10"),
            ev("Keytone", "53.58", 14, "9"),
            ev("Foton", "50.23", 16, "9"),
            ev("Kinglong", "50.23", 16, "9"),
            ev("Hylong", "50.23", 16, "9"),
            ev("KYC V5", "41.86", 11, "11"),
            ev("Shineray", "41.86", 11, "11"),
            ev("DSFK 11", "41.86", 11, "11"),
            ev("Hylong HD4", "41.86", 11, "11"),
            ev("SKY WELL D10", "50.23", 16, "16"),
            ev("Dongfeng (50KW)", "50.23", 14, "14"),
            ev("SRM", "41.86", 11, "11"),
            ev("Dongfeng (53KW)", "53.58", 14, "14"),
            ev("Kama", "42", 14, "14"),
            ev("DFAC EV 32", "53.58", 14, "14"),
            ev("Kinglong (50KW-2)", "50.23", 16, "16"),
            ev("Sokon", "42", 11, "7")
        );

        evVehicleRepository.saveAll(vehicles);
        log.info("Seeded {} default EV vehicles.", vehicles.size());
    }

    private EvVehicle ev(String name, String batteryKw, int seats, String ratePerPercent) {
        return EvVehicle.builder()
                .vehicleName(name)
                .batteryCapacityKw(new BigDecimal(batteryKw))
                .seatingCapacity(seats)
                .ratePerPercent(new BigDecimal(ratePerPercent))
                .isActive(true)
                .build();
    }
}

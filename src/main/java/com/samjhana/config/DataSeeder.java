package com.samjhana.config;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.EcomProduct;
import com.samjhana.entity.EvVehicle;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.EcomProductRepository;
import com.samjhana.repository.EvVehicleRepository;
import com.samjhana.repository.TransactionRepository;
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
    private final TransactionRepository transactionRepository;
    private final EcomProductRepository ecomProductRepository;

    @Override
    @Transactional
    public void run(String... args) {
        seedUsers();
        seedBusinessUnits();
        seedEvVehicles();
        migratePendingTransactions();
        seedEcomProducts();
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

    private void migratePendingTransactions() {
        List<Transaction> pending = transactionRepository
                .findByStatusOrderByCreatedAtDesc(Transaction.TransactionStatus.PENDING_REVIEW);
        if (!pending.isEmpty()) {
            pending.forEach(t -> t.setStatus(Transaction.TransactionStatus.APPROVED));
            transactionRepository.saveAll(pending);
            log.info("Migrated {} PENDING_REVIEW transactions to APPROVED.", pending.size());
        }
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

    private void seedEcomProducts() {
        // Drop stale H2 check constraint so new enum values (BEE_PRODUCTS etc.) can be inserted
        try {
            entityManager.createNativeQuery("ALTER TABLE ECOM_PRODUCTS DROP CONSTRAINT IF EXISTS CONSTRAINT_B").executeUpdate();
        } catch (Exception ignored) {}

        seedCategory(EcomProduct.ProductCategory.FURNITURE, List.of(
            // Living Room
            product("Wooden Sofa Set", "Premium 3-seater wooden sofa set with cushioned armrests and back", "45000", 5, EcomProduct.ProductCategory.FURNITURE),
            product("L-Shaped Corner Sofa", "Large L-shaped corner sofa in durable premium fabric, seats 5–6", "62000", 3, EcomProduct.ProductCategory.FURNITURE),
            product("Coffee Table", "Modern solid-wood coffee table with glass top and lower shelf", "12000", 10, EcomProduct.ProductCategory.FURNITURE),
            product("TV Entertainment Unit", "Wide low-profile TV unit with open shelves and two storage cabinets", "15000", 7, EcomProduct.ProductCategory.FURNITURE),
            product("Center Table Set", "Carved solid-wood center table with matching side tables", "9500", 6, EcomProduct.ProductCategory.FURNITURE),
            product("Single Accent Chair", "Plush single accent chair with solid wood legs and cushioned seat", "7800", 9, EcomProduct.ProductCategory.FURNITURE),
            // Bedroom
            product("King Bed Frame", "Sturdy king-size bed frame with built-in storage drawers beneath", "32000", 4, EcomProduct.ProductCategory.FURNITURE),
            product("Queen Bed Frame", "Elegant queen-size bed with tufted cushioned headboard", "28000", 5, EcomProduct.ProductCategory.FURNITURE),
            product("Wardrobe 3-Door", "Spacious 3-door wardrobe with full-length mirror and hanging rod", "25000", 6, EcomProduct.ProductCategory.FURNITURE),
            product("Almari 2-Door", "Traditional carved 2-door almari — built to last generations", "18000", 8, EcomProduct.ProductCategory.FURNITURE),
            product("Dresser with Mirror", "6-drawer wooden dresser with attached vanity mirror", "14000", 9, EcomProduct.ProductCategory.FURNITURE),
            product("Bedside Nightstand", "Compact 2-drawer nightstand with open lower shelf", "4500", 15, EcomProduct.ProductCategory.FURNITURE),
            // Dining
            product("Dining Table", "6-seater solid wood dining table — rectangle, hand-finished", "18000", 8, EcomProduct.ProductCategory.FURNITURE),
            product("Dining Chair Set (4pcs)", "Set of 4 solid wood dining chairs with padded seat", "9600", 10, EcomProduct.ProductCategory.FURNITURE),
            product("Kitchen Island Counter", "Freestanding kitchen island with butcher-block top and storage", "22000", 4, EcomProduct.ProductCategory.FURNITURE),
            // Office
            product("Office Chair", "Ergonomic adjustable office chair with lumbar support and armrests", "8500", 12, EcomProduct.ProductCategory.FURNITURE),
            product("Study Desk", "Solid wood study desk with 3-drawer side unit and cable management", "11000", 10, EcomProduct.ProductCategory.FURNITURE),
            product("Computer Table", "L-shaped computer workstation with CPU stand and keyboard tray", "14500", 6, EcomProduct.ProductCategory.FURNITURE),
            product("Bookshelf 5-Tier", "Solid wood 5-tier open bookshelf, natural lacquer finish", "7500", 8, EcomProduct.ProductCategory.FURNITURE),
            product("Floating Wall Shelf Set", "Set of 3 solid wood floating shelves with hidden brackets", "3200", 20, EcomProduct.ProductCategory.FURNITURE),
            // Storage
            product("Shoe Rack Cabinet", "4-shelf wooden shoe cabinet with hinged door and ventilation slats", "5500", 20, EcomProduct.ProductCategory.FURNITURE),
            product("Storage Cabinet", "Multi-purpose 4-door storage cabinet with adjustable interior shelves", "9000", 10, EcomProduct.ProductCategory.FURNITURE),
            product("Chest of Drawers", "5-drawer solid wood chest — ideal for bedroom or hallway", "13000", 7, EcomProduct.ProductCategory.FURNITURE)
        ));
        seedCategory(EcomProduct.ProductCategory.FUEL, List.of(
            product("Petrol (5L)", "5 liters of petrol — pre-order for pump pickup", "775", 200, EcomProduct.ProductCategory.FUEL),
            product("Diesel (5L)", "5 liters of diesel — pre-order for pump pickup", "730", 200, EcomProduct.ProductCategory.FUEL),
            product("Petrol (10L)", "10 liters of petrol — pre-order for pump pickup", "1545", 200, EcomProduct.ProductCategory.FUEL),
            product("Diesel (10L)", "10 liters of diesel — pre-order for pump pickup", "1455", 200, EcomProduct.ProductCategory.FUEL),
            product("Petrol (20L)", "20 liters of petrol — pre-order for pump pickup", "3090", 100, EcomProduct.ProductCategory.FUEL),
            product("Diesel (20L)", "20 liters of diesel — pre-order for pump pickup", "2910", 100, EcomProduct.ProductCategory.FUEL)
        ));
        seedCategory(EcomProduct.ProductCategory.BEE_PRODUCTS, List.of(
            product("Pure Wild Honey (500g)", "Raw, unfiltered wild honey sourced from our Maurighar hives", "850", 50, EcomProduct.ProductCategory.BEE_PRODUCTS),
            product("Pure Wild Honey (1kg)", "1kg raw wild honey — best value pack from our bee house", "1600", 30, EcomProduct.ProductCategory.BEE_PRODUCTS),
            product("Beeswax Block (200g)", "Natural beeswax from our hives, ideal for candles & skincare", "400", 40, EcomProduct.ProductCategory.BEE_PRODUCTS),
            product("Royal Jelly (30ml)", "Premium royal jelly for health and immunity", "1200", 20, EcomProduct.ProductCategory.BEE_PRODUCTS),
            product("Bee Pollen (100g)", "Nutrient-rich bee pollen, collected fresh from our hives", "500", 35, EcomProduct.ProductCategory.BEE_PRODUCTS),
            product("Honeycomb Pack", "Fresh natural honeycomb cut straight from the hive", "650", 25, EcomProduct.ProductCategory.BEE_PRODUCTS),
            product("Gift Honey Set", "Curated gift box with 2 honey varieties and beeswax", "2200", 15, EcomProduct.ProductCategory.BEE_PRODUCTS)
        ));
        seedCategory(EcomProduct.ProductCategory.EV_CHARGING, List.of(
            product("EV Fast Charge (1hr)", "High-speed DC fast charging — up to 50kW", "150", 999, EcomProduct.ProductCategory.EV_CHARGING),
            product("EV Standard Charge (4hr)", "AC standard charging session — suitable for all EVs", "350", 999, EcomProduct.ProductCategory.EV_CHARGING),
            product("EV Overnight Charge (8hr)", "Overnight slow charge — ideal for buses & heavy vehicles", "600", 999, EcomProduct.ProductCategory.EV_CHARGING),
            product("EV Monthly Pass", "Unlimited standard charges for 30 days", "5000", 50, EcomProduct.ProductCategory.EV_CHARGING),
            product("EV Top-Up (10%)", "Quick 10% battery top-up service", "80", 999, EcomProduct.ProductCategory.EV_CHARGING)
        ));
        seedCategory(EcomProduct.ProductCategory.HOTEL_BOOKING, List.of(
            product("Standard Room (1 Night)", "Comfortable room with AC, TV & attached bathroom", "1500", 10, EcomProduct.ProductCategory.HOTEL_BOOKING),
            product("Deluxe Room (1 Night)", "Spacious deluxe room with mountain view & premium bedding", "2500", 6, EcomProduct.ProductCategory.HOTEL_BOOKING),
            product("Family Suite (1 Night)", "Large suite with 2 beds, sofa, and private bathroom", "4000", 3, EcomProduct.ProductCategory.HOTEL_BOOKING),
            product("Breakfast Package", "Full Nepali breakfast for 2 people", "350", 999, EcomProduct.ProductCategory.HOTEL_BOOKING),
            product("Lunch / Dinner Thali", "Traditional Nepali thali set meal", "250", 999, EcomProduct.ProductCategory.HOTEL_BOOKING),
            product("Parking (Per Day)", "Secure vehicle parking within hotel premises", "100", 999, EcomProduct.ProductCategory.HOTEL_BOOKING)
        ));
        seedCategory(EcomProduct.ProductCategory.BIKE_REPAIR, List.of(
            product("Basic Service", "Engine check, oil top-up, air filter clean, chain lube", "500", 999, EcomProduct.ProductCategory.BIKE_REPAIR),
            product("Full Service", "Complete bike service including engine tune, brakes & tyres", "1200", 999, EcomProduct.ProductCategory.BIKE_REPAIR),
            product("Oil Change", "Engine oil replacement with quality oil", "200", 999, EcomProduct.ProductCategory.BIKE_REPAIR),
            product("Tyre Replacement (Front)", "Replace front tyre with new tyre of your choice", "800", 30, EcomProduct.ProductCategory.BIKE_REPAIR),
            product("Tyre Replacement (Rear)", "Replace rear tyre with new tyre of your choice", "900", 30, EcomProduct.ProductCategory.BIKE_REPAIR),
            product("Brake Service", "Brake pad replacement and brake adjustment", "400", 50, EcomProduct.ProductCategory.BIKE_REPAIR),
            product("Chain & Sprocket Set", "Replace chain and sprocket set for smooth riding", "600", 20, EcomProduct.ProductCategory.BIKE_REPAIR),
            product("Puncture Repair", "Quick tyre puncture fix while you wait", "150", 999, EcomProduct.ProductCategory.BIKE_REPAIR)
        ));
    }

    private void seedCategory(EcomProduct.ProductCategory category, List<EcomProduct> products) {
        List<String> existingNames = ecomProductRepository
                .findByCategoryAndIsActiveTrueOrderByCreatedAtDesc(category)
                .stream().map(EcomProduct::getName).toList();
        List<EcomProduct> toAdd = products.stream()
                .filter(p -> !existingNames.contains(p.getName()))
                .toList();
        if (toAdd.isEmpty()) {
            log.info("{} products already up to date.", category);
            return;
        }
        ecomProductRepository.saveAll(toAdd);
        log.info("Seeded {} new {} products.", toAdd.size(), category);
    }

    private EcomProduct product(String name, String desc, String price, int stock, EcomProduct.ProductCategory category) {
        return EcomProduct.builder()
                .name(name).description(desc)
                .price(new BigDecimal(price))
                .stockQty(stock).category(category)
                .build();
    }
}

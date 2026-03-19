package com.samjhana.service;

import com.samjhana.entity.*;
import com.samjhana.entity.Transaction.TransactionStatus;
import com.samjhana.entity.Transaction.TransactionType;
import com.samjhana.entity.User.UserRole;
import com.samjhana.entity.FuelPrice.FuelType;
import com.samjhana.entity.DailyReport.VerificationStatus;
import com.samjhana.entity.FurnitureItem.FurnitureCategory;
import com.samjhana.entity.Staff.StaffRole;
import com.samjhana.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DemoDataSeederService {

    private final UserRepository userRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final EvVehicleRepository evVehicleRepository;
    private final FuelPriceRepository fuelPriceRepository;
    private final StaffRepository staffRepository;
    private final RentalPropertyRepository rentalPropertyRepository;
    private final FurnitureItemRepository furnitureItemRepository;
    private final FurnitureCustomerRepository furnitureCustomerRepository;
    private final TransactionRepository transactionRepository;
    private final DailyReportRepository dailyReportRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final EntityManager entityManager;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public void resetAndSeed() {
        log.info("=== Demo data reset started ===");
        clearAll();

        // ── Users ──────────────────────────────────────────────────────────
        User demo    = userRepository.save(user("demo",       "demo",    "Demo Admin",     "डेमो प्रशासक",    UserRole.ADMIN,   "en"));
        User admin   = userRepository.save(user("admin",      "admin",   "System Admin",   "प्रणाली प्रशासक", UserRole.ADMIN,   "en"));
        User manager = userRepository.save(user("ram_mgr",    "pass123", "Ram Sharma",     "राम शर्मा",        UserRole.MANAGER, "ne"));
        User sita    = userRepository.save(user("sita_staff", "pass123", "Sita Tamang",    "सिता तामाङ",       UserRole.STAFF,   "ne"));
        User hari    = userRepository.save(user("hari_staff", "pass123", "Hari Thapa",     "हरि थापा",         UserRole.STAFF,   "ne"));
        entityManager.flush();

        // ── Business Units ─────────────────────────────────────────────────
        BusinessUnit petrol    = businessUnitRepository.save(bu("petrol",    "Shringeshwor Petrol Pump", "श्रृंगेश्वर पेट्रोल पम्प", "🛢️", "PetrolStrategy",   1));
        BusinessUnit ev        = businessUnitRepository.save(bu("ev",        "EV Charging Station",      "EV चार्जिंग स्टेशन",       "⚡",  "EVStrategy",        2));
        BusinessUnit furniture = businessUnitRepository.save(bu("furniture", "Furniture Shop",            "फर्निचर पसल",              "🪑", "FurnitureStrategy", 3));
        BusinessUnit rental    = businessUnitRepository.save(bu("rental",    "House Rental",              "घर भाडा",                  "🏠", "RentalStrategy",    4));
        BusinessUnit loan      = businessUnitRepository.save(bu("loan",      "Bank Loan Management",      "बैंक ऋण व्यवस्थापन",       "🏦", "LoanStrategy",      5));
        entityManager.flush();

        // ── Fuel Prices (2 price changes in history) ───────────────────────
        fuelPriceRepository.save(fp(FuelType.PETROL, "162.00", 45, admin));
        fuelPriceRepository.save(fp(FuelType.DIESEL, "145.00", 45, admin));
        fuelPriceRepository.save(fp(FuelType.PETROL, "169.50", 15, admin));
        fuelPriceRepository.save(fp(FuelType.DIESEL, "152.00", 15, admin));

        // ── Staff ──────────────────────────────────────────────────────────
        staffRepository.saveAll(List.of(
            Staff.builder().fullName("Ram Sharma").fullNameNepali("राम शर्मा").phoneNumber("9801234567")
                .businessUnit(Staff.BusinessUnit.PETROL).staffRole(StaffRole.MANAGER)
                .monthlySalary(bd("35000")).joinDate(LocalDate.now().minusMonths(24)).isActive(true).build(),
            Staff.builder().fullName("Sita Tamang").fullNameNepali("सिता तामाङ").phoneNumber("9812345678")
                .businessUnit(Staff.BusinessUnit.EV).staffRole(StaffRole.CASHIER)
                .monthlySalary(bd("22000")).joinDate(LocalDate.now().minusMonths(12)).isActive(true).build(),
            Staff.builder().fullName("Hari Thapa").fullNameNepali("हरि थापा").phoneNumber("9823456789")
                .businessUnit(Staff.BusinessUnit.FURNITURE).staffRole(StaffRole.SALES_PERSON)
                .monthlySalary(bd("20000")).joinDate(LocalDate.now().minusMonths(6)).isActive(true).build(),
            Staff.builder().fullName("Bishnu Karki").fullNameNepali("बिष्णु कार्की").phoneNumber("9834567890")
                .businessUnit(Staff.BusinessUnit.PETROL).staffRole(StaffRole.PUMP_OPERATOR)
                .monthlySalary(bd("18000")).joinDate(LocalDate.now().minusMonths(18)).isActive(true).build(),
            Staff.builder().fullName("Kamala Rai").fullNameNepali("कमला राई").phoneNumber("9845901234")
                .businessUnit(Staff.BusinessUnit.ALL).staffRole(StaffRole.CLEANER)
                .monthlySalary(bd("14000")).joinDate(LocalDate.now().minusMonths(30)).isActive(true).build()
        ));

        // ── EV Vehicles ────────────────────────────────────────────────────
        evVehicleRepository.saveAll(List.of(
            evv("Higer (100KW)", "100",   16, "16"), evv("Higer (53KW)",  "53.58", 16, "16"),
            evv("Higer (70KW)",  "70.47", 16, "10"), evv("Keytone",       "53.58", 14, "9"),
            evv("Foton",         "50.23", 16, "9"),  evv("Kinglong",      "50.23", 16, "9"),
            evv("Hylong",        "50.23", 16, "9"),  evv("KYC V5",        "41.86", 11, "11"),
            evv("Shineray",      "41.86", 11, "11"), evv("DSFK 11",       "41.86", 11, "11"),
            evv("Hylong HD4",    "41.86", 11, "11"), evv("SKY WELL D10",  "50.23", 16, "16"),
            evv("Dongfeng (50KW)","50.23",14, "14"), evv("SRM",           "41.86", 11, "11"),
            evv("Dongfeng (53KW)","53.58",14, "14"), evv("Kama",          "42",    14, "14"),
            evv("DFAC EV 32",    "53.58", 14, "14"), evv("Kinglong (50KW-2)","50.23",16,"16"),
            evv("Sokon",         "42",    11, "7")
        ));

        // ── Rental Properties ──────────────────────────────────────────────
        RentalProperty shop = rentalPropertyRepository.save(RentalProperty.builder()
            .propertyName("Ground Floor Shop").tenantName("Krishna Stores")
            .monthlyRent(bd("15000")).leaseStartDate(LocalDate.now().minusMonths(18))
            .notes("Commercial lease. Payment due on 1st of each month.")
            .isActive(true).updatedBy(admin).build());
        RentalProperty flat = rentalPropertyRepository.save(RentalProperty.builder()
            .propertyName("First Floor Flat").tenantName("Ram Bahadur Tamang")
            .monthlyRent(bd("12000")).leaseStartDate(LocalDate.now().minusMonths(8))
            .notes("Residential. Includes water bill.")
            .isActive(true).updatedBy(admin).build());
        RentalProperty warehouse = rentalPropertyRepository.save(RentalProperty.builder()
            .propertyName("Warehouse").tenantName("ABC Trading Co.")
            .monthlyRent(bd("25000")).leaseStartDate(LocalDate.now().minusMonths(36))
            .notes("Industrial lease. 3-year contract.")
            .isActive(true).updatedBy(admin).build());

        // ── Furniture Items ────────────────────────────────────────────────
        furnitureItemRepository.saveAll(List.of(
            fi("Sofa Set (3+1+1)",      "सोफा सेट (३+१+१)",     "SOF-001", FurnitureCategory.SOFA,     "38000","48500", 5, 2),
            fi("L-Shape Sofa",          "L-आकार सोफा",           "SOF-002", FurnitureCategory.SOFA,     "52000","68000", 3, 1),
            fi("King Size Bed",         "किंग साइज बेड",         "BED-001", FurnitureCategory.BED,      "28000","38500", 8, 2),
            fi("Double Bed",            "डबल बेड",               "BED-002", FurnitureCategory.BED,      "18000","25000",10, 3),
            fi("Dining Table (6 seat)", "डाइनिङ टेबल (६ सिट)",  "TBL-001", FurnitureCategory.TABLE,    "22000","30000", 4, 2),
            fi("Center Table",          "सेन्टर टेबल",           "TBL-002", FurnitureCategory.TABLE,    "8000", "12500", 6, 2),
            fi("Wardrobe (4 door)",     "अलमारी (४ ढोका)",       "WAR-001", FurnitureCategory.WARDROBE, "32000","42000", 3, 1),
            fi("Office Chair",          "अफिस कुर्सी",           "CHR-001", FurnitureCategory.CHAIR,    "4500", "7000", 20, 5),
            fi("Bookshelf",             "किताब र्‍याक",           "SHF-001", FurnitureCategory.SHELF,    "9000", "14000", 2, 3)
        ));

        // ── Furniture Customers ────────────────────────────────────────────
        FurnitureCustomer ramesh  = furnitureCustomerRepository.save(fc("Ramesh Adhikari", "रमेश अधिकारी", "9845678901", "Damak, Jhapa"));
        FurnitureCustomer sunita  = furnitureCustomerRepository.save(fc("Sunita Thapa",    "सुनिता थापा",   "9856789012", "Biratnagar, Morang"));
        FurnitureCustomer bikash  = furnitureCustomerRepository.save(fc("Bikash Rai",      "बिकाश राई",     "9867890123", "Birtamod, Jhapa"));
        FurnitureCustomer deepa   = furnitureCustomerRepository.save(fc("Deepa Gurung",    "दीपा गुरुङ",    "9878901234", "Urlabari, Morang"));
        FurnitureCustomer krishna = furnitureCustomerRepository.save(fc("Krishna Prasad",  "कृष्ण प्रसाद",  "9812309876", "Itahari, Sunsari"));
        entityManager.flush();

        // ── Loans ──────────────────────────────────────────────────────────
        // Loan 1: NIC Asia — रु 10L, 12% interest, 6 months old, 5 EMI payments made
        Transaction loan1 = transactionRepository.save(txn(loan, manager, TransactionType.EXPENSE, "1000000.00",
            LocalDate.now().minusMonths(6),
            cf("loanType","NEW_LOAN","bankName","NIC Asia Bank","loanAmount","1000000","interestRate","12"),
            TransactionStatus.APPROVED));
        entityManager.flush();
        String loan1Id = loan1.getId().toString();
        for (int m = 5; m >= 1; m--) {
            transactionRepository.save(txn(loan, manager, TransactionType.SALE, "18208.00",
                LocalDate.now().minusMonths(m).withDayOfMonth(5),
                cf("loanType","PAYMENT","loanId",loan1Id,"principalAmount","8208","interestAmount","10000"),
                TransactionStatus.APPROVED));
        }

        // Loan 2: Nepal Bank — रु 5L, 10.5% interest, 3 months old, 2 EMI payments made
        Transaction loan2 = transactionRepository.save(txn(loan, manager, TransactionType.EXPENSE, "500000.00",
            LocalDate.now().minusMonths(3),
            cf("loanType","NEW_LOAN","bankName","Nepal Bank Limited","loanAmount","500000","interestRate","10.5"),
            TransactionStatus.APPROVED));
        entityManager.flush();
        String loan2Id = loan2.getId().toString();
        for (int m = 2; m >= 1; m--) {
            transactionRepository.save(txn(loan, manager, TransactionType.SALE, "11375.00",
                LocalDate.now().minusMonths(m).withDayOfMonth(7),
                cf("loanType","PAYMENT","loanId",loan2Id,"principalAmount","7000","interestAmount","4375"),
                TransactionStatus.APPROVED));
        }
        entityManager.flush();

        // ── Transactions — 30 days ─────────────────────────────────────────
        LocalDate today = LocalDate.now();
        for (int daysAgo = 29; daysAgo >= 0; daysAgo--) {
            LocalDate date = today.minusDays(daysAgo);
            double factor = 1.0 + (Math.sin(daysAgo * 1.3) * 0.15); // ±15% natural variation
            seedDay(date, daysAgo, factor, petrol, ev, furniture, rental,
                    demo, manager, sita, hari,
                    shop, flat, warehouse, ramesh, sunita, bikash, deepa, krishna);
        }
        entityManager.flush();

        // ── Closed Daily Reports — days 1 to 29 ───────────────────────────
        for (int daysAgo = 29; daysAgo >= 1; daysAgo--) {
            seedReport(today.minusDays(daysAgo), daysAgo, manager, admin);
        }

        log.info("=== Demo seed complete. Login: demo/demo (admin/admin, ram_mgr/pass123, sita_staff/pass123) ===");
    }

    // ── Day transaction seeding ────────────────────────────────────────────

    private void seedDay(LocalDate date, int daysAgo, double factor,
                         BusinessUnit petrol, BusinessUnit ev, BusinessUnit furniture,
                         BusinessUnit rental,
                         User demo, User manager, User sita, User hari,
                         RentalProperty shop, RentalProperty flat, RentalProperty warehouse,
                         FurnitureCustomer ramesh, FurnitureCustomer sunita,
                         FurnitureCustomer bikash, FurnitureCustomer deepa, FurnitureCustomer krishna) {

        List<Transaction> txns = new ArrayList<>();
        TransactionStatus approved = TransactionStatus.APPROVED;

        // ── Petrol sales ────────────────────────────────────────────────────
        double pL1 = round1(25 + factor * 5);
        double pL2 = round1(18 + factor * 4);
        double dL1 = round1(45 + factor * 8);
        double dL2 = round1(28 + factor * 5);
        txns.add(txn(petrol, sita, TransactionType.SALE, fmt(pL1 * 169.50), date,
            cf("fuelType","petrol","liters",str(pL1),"ratePerLiter","169.50","purchaseRate","155.00","paymentMethod","CASH"), approved));
        txns.add(txn(petrol, hari, TransactionType.SALE, fmt(dL1 * 152.00), date,
            cf("fuelType","diesel","liters",str(dL1),"ratePerLiter","152.00","purchaseRate","138.00","paymentMethod","BANK"), approved));
        txns.add(txn(petrol, sita, TransactionType.SALE, fmt(pL2 * 169.50), date,
            cf("fuelType","petrol","liters",str(pL2),"ratePerLiter","169.50","purchaseRate","155.00","paymentMethod","CASH"), approved));
        txns.add(txn(petrol, hari, TransactionType.SALE, fmt(dL2 * 152.00), date,
            cf("fuelType","diesel","liters",str(dL2),"ratePerLiter","152.00","purchaseRate","138.00","paymentMethod","BANK"), approved));
        // Evening shift on past days
        if (daysAgo > 0) {
            double eL = round1(32 + factor * 6);
            txns.add(txn(petrol, hari, TransactionType.SALE, fmt(eL * 169.50), date,
                cf("fuelType","petrol","liters",str(eL),"ratePerLiter","169.50","purchaseRate","155.00","paymentMethod","CASH"), approved));
        }
        // Fuel purchase orders every 7 days
        if (daysAgo > 0 && daysAgo % 7 == 0) {
            txns.add(txn(petrol, manager, TransactionType.PURCHASE, "116250.00", date,
                cf("fuelType","petrol","liters","750","ratePerLiter","155.00","paymentMethod","BANK"), approved));
            txns.add(txn(petrol, manager, TransactionType.PURCHASE, "103500.00", date,
                cf("fuelType","diesel","liters","750","ratePerLiter","138.00","paymentMethod","BANK"), approved));
        }

        // ── EV charging ─────────────────────────────────────────────────────
        txns.add(txn(ev, sita, TransactionType.SALE, "640.00", date,
            cf("vehicleName","Higer (100KW)","chargingMode","PERCENTAGE","startPercent","10","endPercent","50",
               "ratePerPercent","16","unitsCharged","40.0","profit","160","neaCost","480","paymentMethod","CASH"), approved));
        txns.add(txn(ev, hari, TransactionType.SALE, "1280.00", date,
            cf("vehicleName","Higer (70KW)","chargingMode","PERCENTAGE","startPercent","20","endPercent","100",
               "ratePerPercent","10","unitsCharged","56.4","profit","704","neaCost","576","paymentMethod","BANK"), approved));
        if (daysAgo % 2 == 0) {
            txns.add(txn(ev, sita, TransactionType.SALE, "810.00", date,
                cf("vehicleName","Foton","chargingMode","PERCENTAGE","startPercent","30","endPercent","60",
                   "ratePerPercent","9","unitsCharged","15.1","profit","378","neaCost","432","paymentMethod","CASH"), approved));
        }

        // ── Rental — on specific days of the month ──────────────────────────
        if (date.getDayOfMonth() == 2) {
            txns.add(txn(rental, manager, TransactionType.SALE, "15000.00", date,
                cf("propertyName",shop.getPropertyName(),"tenantName",shop.getTenantName(),
                   "rentalMonth",monthKey(date),"paymentType","MONTHLY","paymentMethod","CASH"), approved));
        }
        if (date.getDayOfMonth() == 5) {
            txns.add(txn(rental, manager, TransactionType.SALE, "12000.00", date,
                cf("propertyName",flat.getPropertyName(),"tenantName",flat.getTenantName(),
                   "rentalMonth",monthKey(date),"paymentType","MONTHLY","paymentMethod","CASH"), approved));
        }
        if (date.getDayOfMonth() == 10) {
            txns.add(txn(rental, manager, TransactionType.SALE, "25000.00", date,
                cf("propertyName",warehouse.getPropertyName(),"tenantName",warehouse.getTenantName(),
                   "rentalMonth",monthKey(date),"paymentType","MONTHLY","paymentMethod","BANK"), approved));
        }

        // ── Furniture — rotates across 5 customers/items ────────────────────
        switch (daysAgo % 10) {
            case 1 -> txns.add(txn(furniture, hari, TransactionType.SALE, "48500.00", date,
                cf("customerName",ramesh.getName(),"orderType","SALE","itemName","Sofa Set (3+1+1)","quantity","1"), approved));
            case 3 -> txns.add(txn(furniture, hari, TransactionType.SALE, "38500.00", date,
                cf("customerName",sunita.getName(),"orderType","SALE","itemName","King Size Bed","quantity","1"), approved));
            case 5 -> txns.add(txn(furniture, hari, TransactionType.SALE, "30000.00", date,
                cf("customerName",bikash.getName(),"orderType","SALE","itemName","Dining Table (6 seat)","quantity","1"), approved));
            case 7 -> txns.add(txn(furniture, hari, TransactionType.SALE, "42000.00", date,
                cf("customerName",deepa.getName(),"orderType","SALE","itemName","Wardrobe (4 door)","quantity","1"), approved));
            case 9 -> txns.add(txn(furniture, hari, TransactionType.SALE, "68000.00", date,
                cf("customerName",krishna.getName(),"orderType","SALE","itemName","L-Shape Sofa","quantity","1"), approved));
        }

        // ── Today: pending review transactions to demo the close flow ────────
        if (daysAgo == 0) {
            txns.add(txn(petrol, sita, TransactionType.SALE, "5085.00", date,
                cf("fuelType","petrol","liters","30.00","ratePerLiter","169.50","purchaseRate","155.00","paymentMethod","CASH"),
                TransactionStatus.PENDING_REVIEW));
            txns.add(txn(ev, sita, TransactionType.SALE, "810.00", date,
                cf("vehicleName","Foton","chargingMode","PERCENTAGE","startPercent","5","endPercent","61",
                   "ratePerPercent","9","unitsCharged","25.2","profit","150","neaCost","225","paymentMethod","CASH"),
                TransactionStatus.PENDING_REVIEW));
        }

        transactionRepository.saveAll(txns);
    }

    // ── Daily Report seeding ───────────────────────────────────────────────

    private void seedReport(LocalDate date, int daysAgo, User closedBy, User verifiedBy) {
        double factor = 1.0 + (Math.sin(daysAgo * 1.3) * 0.15);
        double pL1 = round1(25 + factor * 5), pL2 = round1(18 + factor * 4);
        double dL1 = round1(45 + factor * 8), dL2 = round1(28 + factor * 5);
        double eL  = round1(32 + factor * 6); // evening shift (past days)

        double petrolLitersTotal = pL1 + pL2 + eL;
        double dieselLitersTotal = dL1 + dL2;
        double petrolSalesVal  = petrolLitersTotal * 169.50;
        double dieselSalesVal  = dieselLitersTotal * 152.00;
        double evSalesVal      = daysAgo % 2 == 0 ? 2730.0 : 1920.0;
        double evUnitsVal      = daysAgo % 2 == 0 ? 111.5 : 96.4;

        BigDecimal petrolSales  = bd(fmt(petrolSalesVal));
        BigDecimal petrolLiters = bd(str(petrolLitersTotal));
        BigDecimal dieselSales  = bd(fmt(dieselSalesVal));
        BigDecimal dieselLiters = bd(str(dieselLitersTotal));
        BigDecimal evSales      = bd(fmt(evSalesVal));
        BigDecimal evUnits      = bd(str(evUnitsVal));

        BigDecimal rentalSales = bd("0");
        if (date.getDayOfMonth() == 2)  rentalSales = rentalSales.add(bd("15000"));
        if (date.getDayOfMonth() == 5)  rentalSales = rentalSales.add(bd("12000"));
        if (date.getDayOfMonth() == 10) rentalSales = rentalSales.add(bd("25000"));

        BigDecimal furnitureSales = switch (daysAgo % 10) {
            case 1 -> bd("48500");
            case 3 -> bd("38500");
            case 5 -> bd("30000");
            case 7 -> bd("42000");
            case 9 -> bd("68000");
            default -> bd("0");
        };

        BigDecimal total = petrolSales.add(dieselSales).add(evSales).add(rentalSales).add(furnitureSales);

        // Cash: petrol cash (all petrol is cash) + ev cash + rental shop+flat + all furniture
        BigDecimal totalCash = petrolSales
            .add(daysAgo % 2 == 0 ? bd("1450") : bd("640"))
            .add(date.getDayOfMonth() == 2  ? bd("15000") : bd("0"))
            .add(date.getDayOfMonth() == 5  ? bd("12000") : bd("0"))
            .add(furnitureSales);
        BigDecimal totalBank = total.subtract(totalCash);

        // Introduce discrepancies on some days to demo SHORT/OVER UI
        BigDecimal cashCounted = totalCash;
        BigDecimal discrepancy = bd("0");
        if (daysAgo % 7 == 2) { cashCounted = totalCash.add(bd("200"));      discrepancy = bd("200");  }  // OVER
        if (daysAgo % 7 == 4) { cashCounted = totalCash.subtract(bd("500")); discrepancy = bd("-500"); }  // SHORT

        boolean verified = daysAgo >= 3;
        dailyReportRepository.save(DailyReport.builder()
            .reportDate(date)
            .petrolSales(petrolSales).petrolLiters(petrolLiters)
            .dieselSales(dieselSales).dieselLiters(dieselLiters)
            .evSales(evSales).evUnits(evUnits)
            .rentalSales(rentalSales).otherSales(furnitureSales)
            .totalSystemSales(total).totalCashSales(totalCash).totalBankSales(totalBank)
            .cashCounted(cashCounted).discrepancy(discrepancy)
            .closedBy(closedBy).closedAt(date.atTime(22, 45))
            .verificationStatus(verified ? VerificationStatus.VERIFIED : VerificationStatus.PENDING)
            .verifiedBy(verified ? verifiedBy : null)
            .verifiedAt(verified ? date.atTime(23, 0) : null)
            .build());
    }

    // ── Clear all data ─────────────────────────────────────────────────────

    /** Drop all H2 CHECK constraints to avoid stale enum-value constraint violations.
     *  With ddl-auto=update, Hibernate never updates old constraints, so a constraint
     *  created before a new enum value was added will block inserts. */
    private void dropAllCheckConstraints() {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME, CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS " +
                "WHERE CONSTRAINT_TYPE = 'CHECK' AND TABLE_SCHEMA = 'PUBLIC'"
            );
            for (Map<String, Object> row : rows) {
                try {
                    jdbcTemplate.execute("ALTER TABLE \"" + row.get("TABLE_NAME") +
                        "\" DROP CONSTRAINT IF EXISTS \"" + row.get("CONSTRAINT_NAME") + "\"");
                    log.debug("Dropped check constraint {} on {}", row.get("CONSTRAINT_NAME"), row.get("TABLE_NAME"));
                } catch (Exception e) {
                    log.warn("Could not drop constraint {} on {}: {}", row.get("CONSTRAINT_NAME"), row.get("TABLE_NAME"), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Could not drop check constraints: {}", e.getMessage());
        }
    }

    private void clearAll() {
        log.info("Clearing all existing data...");
        dropAllCheckConstraints();
        entityManager.createQuery("DELETE FROM Transaction t").executeUpdate();
        entityManager.createQuery("DELETE FROM DailyReport d").executeUpdate();
        entityManager.createQuery("DELETE FROM FuelPrice f").executeUpdate();
        entityManager.createQuery("DELETE FROM EvVehicle e").executeUpdate();
        entityManager.createQuery("DELETE FROM RentalProperty r").executeUpdate();
        entityManager.createQuery("DELETE FROM FurnitureItem f").executeUpdate();
        entityManager.createQuery("DELETE FROM FurnitureCustomer f").executeUpdate();
        entityManager.createQuery("DELETE FROM Staff s").executeUpdate();
        entityManager.createQuery("DELETE FROM SystemSetting s").executeUpdate();
        try { entityManager.createQuery("DELETE FROM AuditLog a").executeUpdate(); }        catch (Exception e) { log.warn("AuditLog clear: {}", e.getMessage()); }
        try { entityManager.createQuery("DELETE FROM FieldTemplate f").executeUpdate(); }   catch (Exception e) { log.warn("FieldTemplate clear skipped"); }
        try { entityManager.createQuery("DELETE FROM ImageAttachment i").executeUpdate(); } catch (Exception e) { log.warn("ImageAttachment clear skipped"); }
        try { entityManager.createQuery("DELETE FROM Resource r").executeUpdate(); }        catch (Exception e) { log.warn("Resource clear skipped"); }
        entityManager.createQuery("DELETE FROM BusinessUnit b").executeUpdate();
        entityManager.createQuery("DELETE FROM User u").executeUpdate();
        entityManager.flush();
        log.info("All data cleared.");
    }

    // ── Builder helpers ────────────────────────────────────────────────────

    private User user(String username, String password, String name, String nameNe, UserRole role, String locale) {
        return User.builder().username(username).passwordHash(passwordEncoder.encode(password))
            .fullName(name).fullNameNepali(nameNe).role(role).locale(locale).isActive(true).build();
    }

    private BusinessUnit bu(String code, String name, String nameNe, String icon, String strategy, int order) {
        return BusinessUnit.builder().code(code).name(name).nameNepali(nameNe)
            .icon(icon).calculationStrategy(strategy).displayOrder(order).isActive(true).build();
    }

    private FuelPrice fp(FuelType type, String price, int daysAgo, User by) {
        return FuelPrice.builder().fuelType(type).pricePerLiter(bd(price))
            .effectiveDate(LocalDate.now().minusDays(daysAgo)).updatedBy(by).build();
    }

    private FurnitureItem fi(String name, String nameNe, String sku, FurnitureCategory cat,
                              String purchase, String selling, int stock, int reorder) {
        return FurnitureItem.builder().name(name).nameNepali(nameNe).sku(sku).category(cat)
            .purchasePrice(bd(purchase)).sellingPrice(bd(selling))
            .stockQty(stock).reorderLevel(reorder).isActive(true).build();
    }

    private FurnitureCustomer fc(String name, String nameNe, String phone, String address) {
        return FurnitureCustomer.builder().name(name).nameNepali(nameNe)
            .phone(phone).address(address).isActive(true).build();
    }

    private EvVehicle evv(String name, String battery, int seats, String rate) {
        return EvVehicle.builder().vehicleName(name).batteryCapacityKw(bd(battery))
            .seatingCapacity(seats).ratePerPercent(bd(rate)).isActive(true).build();
    }

    private Transaction txn(BusinessUnit business, User enteredBy, TransactionType type,
                             String amount, LocalDate date, String customFields, TransactionStatus status) {
        return Transaction.builder().business(business).enteredBy(enteredBy)
            .transactionType(type).amount(bd(amount))
            .transactionDate(date).customFields(customFields).status(status).build();
    }

    private String cf(String... kv) {
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < kv.length; i += 2) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(kv[i]).append("\":\"").append(kv[i + 1]).append("\"");
        }
        return sb.append("}").toString();
    }

    private String monthKey(LocalDate date) {
        // Approximate BS year (AD + 56/57); good enough for demo label
        return String.format("%d-%02d", date.getYear() + 56, date.getMonthValue());
    }

    private double round1(double v) { return Math.round(v * 10.0) / 10.0; }
    private String  fmt(double v)   { return String.format("%.2f", v); }
    private String  str(double v)   { return String.format("%.1f", v); }
    private BigDecimal bd(String v) { return new BigDecimal(v); }
}

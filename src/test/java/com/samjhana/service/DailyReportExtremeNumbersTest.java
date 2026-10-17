package com.samjhana.service;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding G-01: a stored sale whose litres, kWh or meter reading is a text number with an extreme exponent made every
 * later day summary and day close add that number in. Such a figure is now ignored (counted as nothing), so one bad
 * entry cannot stall or poison the day's totals.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DailyReportExtremeNumbersTest {

    private static final LocalDate DAY = LocalDate.of(2026, 3, 3);   // far from today: only these rows are on it

    @Autowired DailyReportService dailyReportService;
    @Autowired TransactionRepository transactionRepository;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private User staff;
    private BusinessUnit petrol;
    private BusinessUnit ev;

    @BeforeEach
    void setUp() {
        staff = userRepository.findByUsername("summary-staff").orElseGet(() -> userRepository.save(
                User.builder().username("summary-staff").passwordHash(passwordEncoder.encode("x"))
                        .fullName("Summary Staff").fullNameNepali("Summary Staff").role(User.UserRole.STAFF).build()));
        petrol = unit("petrol", "Petrol Pump");
        ev = unit("ev", "EV Charging");
    }

    private BusinessUnit unit(String code, String name) {
        return businessUnitRepository.findByCode(code).orElseGet(() -> businessUnitRepository.save(
                BusinessUnit.builder().code(code).name(name).nameNepali(name).calculationStrategy("x").build()));
    }

    private void sale(BusinessUnit business, String customFields) {
        transactionRepository.save(Transaction.builder().business(business).enteredBy(staff)
                .transactionType(Transaction.TransactionType.SALE).transactionDate(DAY).amount(new BigDecimal("1700"))
                .status(Transaction.TransactionStatus.APPROVED).customFields(customFields).build());
    }

    @Test
    void shouldAddUpOrdinaryLitres() {
        sale(petrol, "{\"fuelType\":\"petrol\",\"liters\":10}");
        sale(petrol, "{\"fuelType\":\"petrol\",\"liters\":\"2.5\"}");

        Map<String, Object> summary = dailyReportService.buildSummary(DAY);

        assertThat((BigDecimal) summary.get("petrolLiters")).isEqualByComparingTo("12.5");
    }

    @Test
    void shouldIgnoreALitresFigureWithAnExtremeExponent_whenAddingUpTheDay() {
        sale(petrol, "{\"fuelType\":\"petrol\",\"liters\":10}");
        sale(petrol, "{\"fuelType\":\"petrol\",\"liters\":\"1e100\"}");

        Map<String, Object> summary = dailyReportService.buildSummary(DAY);

        assertThat((BigDecimal) summary.get("petrolLiters")).isEqualByComparingTo("10");
    }

    @Test
    void shouldIgnoreAnEvEnergyFigureWithAnExtremeExponent_whenAddingUpTheDay() {
        sale(ev, "{\"chargingMode\":\"PERCENTAGE\",\"estimatedKwh\":\"40\"}");
        sale(ev, "{\"chargingMode\":\"PERCENTAGE\",\"estimatedKwh\":\"1e100\"}");
        sale(ev, "{\"chargingMode\":\"OCPP_SESSION\",\"energyDeliveredKwh\":\"1e100\"}");

        Map<String, Object> summary = dailyReportService.buildSummary(DAY);

        assertThat((BigDecimal) summary.get("evUnits")).isEqualByComparingTo("40");
    }
}

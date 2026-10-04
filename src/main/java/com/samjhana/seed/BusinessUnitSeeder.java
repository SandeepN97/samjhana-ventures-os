package com.samjhana.seed;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.repository.BusinessUnitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Makes sure the six business units exist: every transaction (a fuel sale, an EV payment, a rent
 * receipt...) is filed under one, and without them saving any of those fails with
 * "Business unit not found".
 *
 * <p>They are reference data, like {@link ChargePointSeeder}'s chargers, so this runs on dev, staging
 * and prod. It only adds a unit whose code is missing and never touches one that exists, so names or
 * icons changed later are kept. Tests build their own fixtures, so the {@code test} profile is excluded.
 */
@Component
@Profile("!test")
@Order(Ordered.HIGHEST_PRECEDENCE)   // before anything that might record a transaction at startup
@RequiredArgsConstructor
@Slf4j
public class BusinessUnitSeeder implements CommandLineRunner {

    static final List<UnitSpec> STANDARD_UNITS = List.of(
        new UnitSpec(BusinessUnit.CODE_PETROL, "Shringeshwor Petrol Pump", "श्रृंगेश्वर पेट्रोल पम्प", "🛢️", "PetrolStrategy", 1),
        new UnitSpec(BusinessUnit.CODE_EV, "EV Charging Station", "EV चार्जिंग स्टेशन", "⚡", "EVStrategy", 2),
        new UnitSpec(BusinessUnit.CODE_FURNITURE, "Furniture Shop", "फर्निचर पसल", "🪑", "FurnitureStrategy", 3),
        new UnitSpec(BusinessUnit.CODE_RENTAL, "House Rental", "घर भाडा", "🏠", "RentalStrategy", 4),
        new UnitSpec(BusinessUnit.CODE_LOAN, "Bank Loan Management", "बैंक ऋण व्यवस्थापन", "🏦", "LoanStrategy", 5),
        new UnitSpec(BusinessUnit.CODE_BEEKEEPING, "Beekeeping Shop", "मौरीपालन पसल", "🍯", "BeekeepingStrategy", 6)
    );

    private final BusinessUnitRepository businessUnitRepository;

    @Override
    @Transactional
    public void run(String... args) {
        int added = 0;
        for (UnitSpec spec : STANDARD_UNITS) {
            if (businessUnitRepository.findByCode(spec.code()).isEmpty()) {
                businessUnitRepository.save(spec.toEntity());
                added++;
            }
        }
        if (added > 0) {
            log.info("Added {} missing business unit(s).", added);
        }
    }

    record UnitSpec(String code, String name, String nameNepali, String icon, String strategy, int order) {
        BusinessUnit toEntity() {
            return BusinessUnit.builder().code(code).name(name).nameNepali(nameNepali)
                    .icon(icon).calculationStrategy(strategy).displayOrder(order).isActive(true).build();
        }
    }
}

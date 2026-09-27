package com.samjhana.seed;

import com.samjhana.entity.EvVehicle;
import com.samjhana.repository.EvVehicleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Fills in the standard EV vehicle catalogue (name, battery, seats, price per 1% of charge)
 * the first time a database starts with no vehicles at all.
 *
 * <p>Unlike {@link DataSeeder} this runs on dev, staging and prod: the catalogue is business
 * reference data, the same way {@link ChargePointSeeder}'s chargers are. It only ever seeds an
 * empty table. Once any vehicle exists, admins own the list from the dashboard, so a renamed,
 * repriced or deactivated vehicle is never overwritten or added back. Tests build their own
 * fixtures, so the {@code test} profile is excluded.
 */
@Component
@Profile("!test")
@RequiredArgsConstructor
@Slf4j
public class EvVehicleCatalogSeeder implements CommandLineRunner {

    static final List<VehicleSpec> STANDARD_CATALOGUE = List.of(
        new VehicleSpec("Higer (100KW)", "100", 16, "16"),
        new VehicleSpec("Higer (53KW)", "53.58", 16, "16"),
        new VehicleSpec("Higer (70KW)", "70.47", 16, "10"),
        new VehicleSpec("Keytone", "53.58", 14, "9"),
        new VehicleSpec("Foton", "50.23", 16, "9"),
        new VehicleSpec("Kinglong", "50.23", 16, "9"),
        new VehicleSpec("Hylong", "50.23", 16, "9"),
        new VehicleSpec("KYC V5", "41.86", 11, "11"),
        new VehicleSpec("Shineray", "41.86", 11, "11"),
        new VehicleSpec("DSFK 11", "41.86", 11, "11"),
        new VehicleSpec("Hylong HD4", "41.86", 11, "11"),
        new VehicleSpec("SKY WELL D10", "50.23", 16, "16"),
        new VehicleSpec("Dongfeng (50KW)", "50.23", 14, "14"),
        new VehicleSpec("SRM", "41.86", 11, "11"),
        new VehicleSpec("Dongfeng (53KW)", "53.58", 14, "14"),
        new VehicleSpec("Kama", "42", 14, "14"),
        new VehicleSpec("DFAC EV 32", "53.58", 14, "14"),
        new VehicleSpec("Kinglong (50KW-2)", "50.23", 16, "16"),
        new VehicleSpec("Sokon", "42", 11, "7")
    );

    private final EvVehicleRepository evVehicleRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (evVehicleRepository.count() > 0) {
            log.info("EV vehicle catalogue already present, leaving it to admins.");
            return;
        }
        evVehicleRepository.saveAll(STANDARD_CATALOGUE.stream().map(VehicleSpec::toEntity).toList());
        log.info("Seeded {} standard EV vehicles.", STANDARD_CATALOGUE.size());
    }

    record VehicleSpec(String name, String batteryKw, int seats, String ratePerPercent) {
        EvVehicle toEntity() {
            return EvVehicle.builder()
                    .vehicleName(name)
                    .batteryCapacityKw(new BigDecimal(batteryKw))
                    .seatingCapacity(seats)
                    .ratePerPercent(new BigDecimal(ratePerPercent))
                    .isActive(true)
                    .build();
        }
    }
}

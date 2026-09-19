package com.samjhana.seed;

import com.samjhana.entity.ChargePoint;
import com.samjhana.repository.ChargePointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Registers the site's three fixed DC fast chargers when the table is empty.
 *
 * <p>Unlike {@link DataSeeder} this runs on every profile: the chargers are real
 * hardware reference data, not demo data, so production needs them too.
 * Charge point IDs follow docs/EV-CHARGING-ARCHITECTURE.md.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChargePointSeeder implements CommandLineRunner {

    private final ChargePointRepository chargePointRepository;

    @Override
    public void run(String... args) {
        if (chargePointRepository.count() > 0) {
            log.info("Charge points already exist, skipping seed.");
            return;
        }

        List<ChargePoint> chargePoints = List.of(
            chargePoint("HD-D180-CC-01", "HD-D180-CC", "80", 1),
            chargePoint("HQC23-80-01", "HQC23-80/1000/260-Y02-CC", "80", 2),
            chargePoint("HD-D140-E-01", "HD-D140-E", "40", 3)
        );

        chargePointRepository.saveAll(chargePoints);
        log.info("Seeded {} charge points.", chargePoints.size());
    }

    private ChargePoint chargePoint(String code, String model, String maxPowerKw, int displayOrder) {
        return ChargePoint.builder()
                .code(code)
                .model(model)
                .maxPowerKw(new BigDecimal(maxPowerKw))
                .displayOrder(displayOrder)
                .isActive(true)
                .build();
    }
}

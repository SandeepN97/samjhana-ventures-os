package com.samjhana.seed;

import com.samjhana.entity.ChargePoint;
import com.samjhana.config.OcppProperties;
import com.samjhana.repository.ChargePointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

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
    private final PasswordEncoder passwordEncoder;
    private final OcppProperties ocppProperties;

    @Override
    @Transactional
    public void run(String... args) {
        List<ChargePointSpec> specs = List.of(
            new ChargePointSpec("HD-D180-CC-01", "HD-D180-CC", "80", 1),
            new ChargePointSpec("HQC23-80-01", "HQC23-80/1000/260-Y02-CC", "80", 2),
            new ChargePointSpec("HD-D140-E-01", "HD-D140-E", "40", 3)
        );

        int created = 0;
        for (ChargePointSpec spec : specs) {
            ChargePoint chargePoint = chargePointRepository.findByCodeAndDeletedAtIsNull(spec.code())
                    .orElseGet(() -> {
                        ChargePoint createdPoint = chargePoint(spec);
                        return createdPoint;
                    });
            boolean isNew = chargePoint.getId() == null;
            chargePoint.setModel(spec.model());
            chargePoint.setMaxPowerKw(new BigDecimal(spec.maxPowerKw()));
            chargePoint.setDisplayOrder(spec.displayOrder());
            // A process restart invalidates all in-memory WebSocket connections.
            chargePoint.setConnectionStatus(ChargePoint.ConnectionStatus.OFFLINE);
            if (chargePoint.getLockBehavior() == null) {
                chargePoint.setLockBehavior(ocppProperties.getDefaultLockBehavior());
            }
            if (chargePoint.getOcppAuthSecretHash() == null || chargePoint.getOcppAuthSecretHash().isBlank()) {
                chargePoint.setOcppAuthSecretHash(passwordEncoder.encode(ocppProperties.secretFor(spec.code())));
            } else {
                replaceTheStoredHashIfItIsThePublishedDefault(chargePoint);
            }
            chargePointRepository.save(chargePoint);
            if (isNew) created++;
        }
        log.info("Charge point registry synchronized ({} created, {} total configured).", created, specs.size());
    }

    /**
     * The secret is hashed into the database once, so a database first booted with the development default
     * keeps accepting that default (published in this repository) after the operator configures a real secret
     * (finding P1B1-01). A stored hash that matches the charger's published default is therefore replaced by the
     * configured secret. A hash set by "rotate secret" never matches the published default, so it is left alone, and
     * nothing changes where the configured secret is itself the development default (a developer's machine).
     */
    private void replaceTheStoredHashIfItIsThePublishedDefault(ChargePoint chargePoint) {
        String code = chargePoint.getCode();
        String published = OcppProperties.publishedDevSecretFor(code);
        if (!passwordEncoder.matches(published, chargePoint.getOcppAuthSecretHash())) return;
        Optional<String> configured = ocppProperties.configuredSecretFor(code);
        if (configured.isEmpty() || configured.get().equals(published)) {
            if (configured.isEmpty()) {
                log.warn("Charge point {} still accepts the published development secret and no secret is configured for it.", code);
            }
            return;
        }
        chargePoint.setOcppAuthSecretHash(passwordEncoder.encode(configured.get()));
        log.warn("Charge point {} was still using the published development secret: replaced it with the configured secret. "
                + "Set that secret on the charger.", code);
    }

    private ChargePoint chargePoint(ChargePointSpec spec) {
        return ChargePoint.builder()
                .code(spec.code())
                .model(spec.model())
                .maxPowerKw(new BigDecimal(spec.maxPowerKw()))
                .displayOrder(spec.displayOrder())
                .isActive(true)
                .connectionStatus(ChargePoint.ConnectionStatus.OFFLINE)
                .lockBehavior(ocppProperties.getDefaultLockBehavior())
                .build();
    }

    private record ChargePointSpec(String code, String model, String maxPowerKw, int displayOrder) {}
}

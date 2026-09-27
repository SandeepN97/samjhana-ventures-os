package com.samjhana.seed;

import com.samjhana.entity.EvVehicle;
import com.samjhana.repository.EvVehicleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

/** Runs the seeder against a real (embedded) database, the way staging and prod start up. */
@DataJpaTest
@Import(EvVehicleCatalogSeeder.class)
class EvVehicleCatalogSeederIntegrationTest {

    @Autowired EvVehicleRepository evVehicleRepository;
    @Autowired EvVehicleCatalogSeeder seeder;

    @Test
    void shouldSeedNineteenActiveVehicles_whenDatabaseStartsEmpty() {
        evVehicleRepository.deleteAll();

        seeder.run();

        assertEquals(19, evVehicleRepository.findByIsActiveTrueOrderByVehicleNameAsc().size());
    }

    @Test
    void shouldNotOverwriteRepricedOrReactivateDeactivatedVehicles_onRestart() {
        evVehicleRepository.deleteAll();
        seeder.run();
        List<EvVehicle> all = evVehicleRepository.findAllByOrderByVehicleNameAsc();
        EvVehicle repriced = all.get(0);
        repriced.setRatePerPercent(new BigDecimal("99"));
        EvVehicle deactivated = all.get(1);
        deactivated.setIsActive(false);
        evVehicleRepository.saveAll(List.of(repriced, deactivated));

        seeder.run(); // simulates the next deploy

        assertEquals(19, evVehicleRepository.count());
        assertEquals(0, new BigDecimal("99").compareTo(
                evVehicleRepository.findById(repriced.getId()).orElseThrow().getRatePerPercent()));
        assertFalse(evVehicleRepository.findById(deactivated.getId()).orElseThrow().getIsActive());
    }
}

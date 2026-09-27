package com.samjhana.seed;

import com.samjhana.entity.EvVehicle;
import com.samjhana.repository.EvVehicleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EvVehicleCatalogSeederTest {

    @Mock EvVehicleRepository evVehicleRepository;
    @InjectMocks EvVehicleCatalogSeeder seeder;

    @Test
    @SuppressWarnings("unchecked")
    void shouldSeedAllStandardVehiclesAsActive_whenTableIsEmpty() {
        when(evVehicleRepository.count()).thenReturn(0L);

        seeder.run();

        ArgumentCaptor<List<EvVehicle>> saved = ArgumentCaptor.forClass(List.class);
        verify(evVehicleRepository).saveAll(saved.capture());
        List<EvVehicle> vehicles = saved.getValue();
        assertEquals(19, vehicles.size());
        assertTrue(vehicles.stream().allMatch(EvVehicle::getIsActive));
        EvVehicle dfac = vehicles.stream().filter(v -> v.getVehicleName().equals("DFAC EV 32")).findFirst().orElseThrow();
        assertEquals(0, new BigDecimal("14").compareTo(dfac.getRatePerPercent()));
        assertEquals(0, new BigDecimal("53.58").compareTo(dfac.getBatteryCapacityKw()));
        assertEquals(14, dfac.getSeatingCapacity());
    }

    @Test
    void shouldLeaveCatalogueToAdmins_whenAnyVehicleAlreadyExists() {
        when(evVehicleRepository.count()).thenReturn(1L);

        seeder.run();

        verify(evVehicleRepository, never()).saveAll(any());
    }

    @Test
    void shouldHaveUniqueNamesAndPositiveRates_inStandardCatalogue() {
        List<EvVehicleCatalogSeeder.VehicleSpec> specs = EvVehicleCatalogSeeder.STANDARD_CATALOGUE;
        assertEquals(specs.size(), specs.stream().map(EvVehicleCatalogSeeder.VehicleSpec::name).distinct().count());
        assertTrue(specs.stream().allMatch(s -> new BigDecimal(s.ratePerPercent()).signum() > 0));
    }

    @Test
    void shouldPropagateFailure_whenSavingTheCatalogueFails() {
        when(evVehicleRepository.count()).thenReturn(0L);
        when(evVehicleRepository.saveAll(any())).thenThrow(new IllegalStateException("database unavailable"));

        assertThrows(IllegalStateException.class, () -> seeder.run());
    }
}

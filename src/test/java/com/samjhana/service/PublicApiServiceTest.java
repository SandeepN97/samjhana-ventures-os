package com.samjhana.service;

import com.samjhana.entity.EvVehicle;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.repository.EvVehicleRepository;
import com.samjhana.repository.FuelPriceRepository;
import com.samjhana.repository.FurnitureItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** This service is the one thing samjhana-web is allowed to call. Every test here also
 * doubles as a check that the public shape never grows a forbidden field (cost price,
 * stock level, profit, WAC, staff data, internal IDs) — see the class-level Javadoc. */
@ExtendWith(MockitoExtension.class)
class PublicApiServiceTest {

    @Mock FuelPriceRepository fuelPriceRepository;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock EvVehicleRepository evVehicleRepository;

    private PublicApiService service;

    @BeforeEach
    void setUp() {
        service = new PublicApiService(fuelPriceRepository, furnitureItemRepository, evVehicleRepository);
    }

    @Test
    void shouldReturnBothFuelPrices_whenBothPresent() {
        FuelPrice petrol = FuelPrice.builder().fuelType(FuelPrice.FuelType.PETROL)
                .pricePerLiter(new BigDecimal("169.50")).effectiveDate(LocalDate.now()).build();
        FuelPrice diesel = FuelPrice.builder().fuelType(FuelPrice.FuelType.DIESEL)
                .pricePerLiter(new BigDecimal("152.00")).effectiveDate(LocalDate.now()).build();
        when(fuelPriceRepository.findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(
                eq(FuelPrice.FuelType.PETROL), any())).thenReturn(Optional.of(petrol));
        when(fuelPriceRepository.findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(
                eq(FuelPrice.FuelType.DIESEL), any())).thenReturn(Optional.of(diesel));

        Map<String, Object> prices = service.getCurrentFuelPrices();

        assertThat(prices).containsOnlyKeys("petrol", "diesel");
        @SuppressWarnings("unchecked")
        Map<String, Object> petrolMap = (Map<String, Object>) prices.get("petrol");
        assertThat(petrolMap).containsOnlyKeys("fuelType", "pricePerLiter", "effectiveDate");
    }

    @Test
    void shouldOmitFuelType_whenNoPriceRecordedYet() {
        when(fuelPriceRepository.findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(any(), any()))
                .thenReturn(Optional.empty());
        assertThat(service.getCurrentFuelPrices()).isEmpty();
    }

    @Test
    void shouldFilterFurnitureByValidCategory() {
        FurnitureItem sofa = FurnitureItem.builder().id(UUID.randomUUID()).name("Sofa")
                .category(FurnitureItem.FurnitureCategory.SOFA).isActive(true).build();
        when(furnitureItemRepository.findByCategoryAndIsActiveTrue(FurnitureItem.FurnitureCategory.SOFA))
                .thenReturn(List.of(sofa));

        List<Map<String, Object>> result = service.getFurnitureCatalogue("sofa");

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).containsOnlyKeys("id", "name", "nameNepali", "category", "sellingPrice", "description");
    }

    @Test
    void shouldReturnAllFurniture_whenCategoryIsAllOrInvalid() {
        when(furnitureItemRepository.findByIsActiveTrueOrderByNameAsc())
                .thenReturn(List.of(FurnitureItem.builder().id(UUID.randomUUID()).name("X")
                        .category(FurnitureItem.FurnitureCategory.OTHER).isActive(true).build()));

        assertThat(service.getFurnitureCatalogue("ALL")).hasSize(1);
        assertThat(service.getFurnitureCatalogue("not-a-real-category")).hasSize(1);
        assertThat(service.getFurnitureCatalogue(null)).hasSize(1);
    }

    @Test
    void shouldReturnFurnitureItem_whenActive() {
        FurnitureItem item = FurnitureItem.builder().id(UUID.randomUUID()).name("Chair")
                .category(FurnitureItem.FurnitureCategory.CHAIR).isActive(true).build();
        when(furnitureItemRepository.findById(item.getId())).thenReturn(Optional.of(item));

        assertThat(service.getFurnitureItem(item.getId())).isPresent();
    }

    @Test
    void shouldOmitFurnitureItem_whenInactiveOrMissing() {
        FurnitureItem inactive = FurnitureItem.builder().id(UUID.randomUUID()).name("Old")
                .category(FurnitureItem.FurnitureCategory.OTHER).isActive(false).build();
        when(furnitureItemRepository.findById(inactive.getId())).thenReturn(Optional.of(inactive));
        assertThat(service.getFurnitureItem(inactive.getId())).isEmpty();

        UUID missingId = UUID.randomUUID();
        when(furnitureItemRepository.findById(missingId)).thenReturn(Optional.empty());
        assertThat(service.getFurnitureItem(missingId)).isEmpty();
    }

    @Test
    void shouldReturnEvRates_withOnlyPublicFields() {
        EvVehicle vehicle = EvVehicle.builder().id(UUID.randomUUID()).vehicleName("Higer")
                .batteryCapacityKw(new BigDecimal("100")).seatingCapacity(16)
                .ratePerPercent(new BigDecimal("10")).isActive(true).build();
        when(evVehicleRepository.findByIsActiveTrueOrderByVehicleNameAsc()).thenReturn(List.of(vehicle));

        List<Map<String, Object>> result = service.getEvRates();

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).containsOnlyKeys("id", "vehicleName", "batteryCapacityKw", "seatingCapacity", "ratePerPercent");
    }
}

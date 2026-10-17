package com.samjhana.service;

import com.samjhana.entity.EvVehicle;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.FurnitureItem;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.repository.BeekeepingProductRepository;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** This service is the one thing samjhana-web is allowed to call. Every test here also
 * doubles as a check that the public shape never grows a forbidden field (cost price,
 * stock level, profit, WAC, staff data, internal IDs) — see the class-level Javadoc. */
@ExtendWith(MockitoExtension.class)
class PublicApiServiceTest {

    @Mock FuelPriceRepository fuelPriceRepository;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock EvVehicleRepository evVehicleRepository;
    @Mock BeekeepingProductRepository beekeepingProductRepository;

    private PublicApiService service;

    @BeforeEach
    void setUp() {
        service = new PublicApiService(fuelPriceRepository, furnitureItemRepository, evVehicleRepository,
                beekeepingProductRepository, new ObjectMapper());
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
        FurnitureItem sofa = FurnitureItem.builder().id(UUID.randomUUID()).name("Sofa").slug("sofa")
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
                .thenReturn(List.of(FurnitureItem.builder().id(UUID.randomUUID()).name("X").slug("x")
                        .category(FurnitureItem.FurnitureCategory.OTHER).isActive(true).build()));

        assertThat(service.getFurnitureCatalogue("ALL")).hasSize(1);
        assertThat(service.getFurnitureCatalogue("not-a-real-category")).hasSize(1);
        assertThat(service.getFurnitureCatalogue(null)).hasSize(1);
    }

    @Test
    void shouldReturnFurnitureItemBySlug_whenActiveAndShown() {
        FurnitureItem item = FurnitureItem.builder().id(UUID.randomUUID()).name("Chair").slug("oak-chair")
                .category(FurnitureItem.FurnitureCategory.CHAIR).isActive(true).build();
        when(furnitureItemRepository.findBySlug("oak-chair")).thenReturn(Optional.of(item));

        Optional<Map<String, Object>> found = service.getFurnitureItem("oak-chair");

        assertThat(found).isPresent();
        assertThat(found.get()).containsEntry("id", "oak-chair");
    }

    @Test
    void shouldOmitFurnitureItem_whenInactiveHiddenOrUnknown() {
        FurnitureItem hidden = FurnitureItem.builder().id(UUID.randomUUID()).name("Hidden").slug("hidden-one")
                .category(FurnitureItem.FurnitureCategory.OTHER).isActive(true).showOnWebsite(false).build();
        FurnitureItem inactive = FurnitureItem.builder().id(UUID.randomUUID()).name("Old").slug("old-one")
                .category(FurnitureItem.FurnitureCategory.OTHER).isActive(false).build();
        when(furnitureItemRepository.findBySlug("hidden-one")).thenReturn(Optional.of(hidden));
        when(furnitureItemRepository.findBySlug("old-one")).thenReturn(Optional.of(inactive));

        assertThat(service.getFurnitureItem("hidden-one")).isEmpty();
        assertThat(service.getFurnitureItem("old-one")).isEmpty();
        assertThat(service.getFurnitureItem("no-such-item")).isEmpty();
        assertThat(service.getFurnitureItem(null)).isEmpty();
    }

    // ---- finding P0-07: the legacy pages show only what the website shows, and never a database id ----

    @Test
    void shouldHideFurnitureMarkedHiddenOnTheWebsite_andFurnitureWithoutAPublicName() {
        FurnitureItem shown = FurnitureItem.builder().id(UUID.randomUUID()).name("Shown").slug("shown")
                .category(FurnitureItem.FurnitureCategory.SOFA).isActive(true).showOnWebsite(true).build();
        FurnitureItem unset = FurnitureItem.builder().id(UUID.randomUUID()).name("Flag not set").slug("flag-not-set")
                .category(FurnitureItem.FurnitureCategory.SOFA).isActive(true).build();
        FurnitureItem hidden = FurnitureItem.builder().id(UUID.randomUUID()).name("Hidden").slug("hidden")
                .category(FurnitureItem.FurnitureCategory.SOFA).isActive(true).showOnWebsite(false).build();
        FurnitureItem noSlug = FurnitureItem.builder().id(UUID.randomUUID()).name("No slug yet")
                .category(FurnitureItem.FurnitureCategory.SOFA).isActive(true).showOnWebsite(true).build();
        when(furnitureItemRepository.findByIsActiveTrueOrderByNameAsc()).thenReturn(List.of(shown, unset, hidden, noSlug));
        when(furnitureItemRepository.findByCategoryAndIsActiveTrue(FurnitureItem.FurnitureCategory.SOFA))
                .thenReturn(List.of(shown, unset, hidden, noSlug));

        assertThat(service.getFurnitureCatalogue(null)).extracting(m -> m.get("name")).containsExactly("Shown", "Flag not set");
        assertThat(service.getFurnitureCatalogue("SOFA")).extracting(m -> m.get("name")).containsExactly("Shown", "Flag not set");
    }

    @Test
    void shouldUseTheSlugAsThePublicId_notTheDatabaseId() {
        UUID databaseId = UUID.randomUUID();
        FurnitureItem item = FurnitureItem.builder().id(databaseId).name("Table").slug("dining-table")
                .category(FurnitureItem.FurnitureCategory.TABLE).isActive(true).build();
        when(furnitureItemRepository.findByIsActiveTrueOrderByNameAsc()).thenReturn(List.of(item));

        Map<String, Object> listed = service.getFurnitureCatalogue(null).get(0);

        assertThat(listed).containsEntry("id", "dining-table");
        assertThat(listed.values().toString()).doesNotContain(databaseId.toString());
    }

    @Test
    void shouldNotFindAFurnitureItemByItsDatabaseId() {
        UUID databaseId = UUID.randomUUID();

        assertThat(service.getFurnitureItem(databaseId.toString())).isEmpty();

        verify(furnitureItemRepository, never()).findById(any());   // the database id is not a way in
    }

    @Test
    void shouldReturnEvRates_withOnlyPublicFields() {
        EvVehicle vehicle = EvVehicle.builder().id(UUID.randomUUID()).vehicleName("Higer")
                .batteryCapacityKw(new BigDecimal("100")).seatingCapacity(16)
                .ratePerPercent(new BigDecimal("10")).isActive(true).build();
        when(evVehicleRepository.findByIsActiveTrueOrderByVehicleNameAsc()).thenReturn(List.of(vehicle));

        List<Map<String, Object>> result = service.getEvRates();

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).containsOnlyKeys("vehicleName", "batteryCapacityKw", "seatingCapacity", "ratePerPercent");
        assertThat(result.get(0).values().toString()).doesNotContain(vehicle.getId().toString());
    }
}

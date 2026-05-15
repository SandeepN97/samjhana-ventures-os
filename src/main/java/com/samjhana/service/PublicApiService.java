package com.samjhana.service;

import com.samjhana.entity.EvVehicle;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.repository.EvVehicleRepository;
import com.samjhana.repository.FuelPriceRepository;
import com.samjhana.repository.FurnitureItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

/**
 * Serves PublicController only. Read-only. Never returns cost prices, stock levels,
 * profit margins, WAC, staff data, or internal transaction IDs.
 */
@Service
@RequiredArgsConstructor
public class PublicApiService {

    private final FuelPriceRepository fuelPriceRepository;
    private final FurnitureItemRepository furnitureItemRepository;
    private final EvVehicleRepository evVehicleRepository;

    public Map<String, Object> getCurrentFuelPrices() {
        LocalDate today = LocalDate.now();
        Map<String, Object> prices = new LinkedHashMap<>();

        fuelPriceRepository
                .findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(FuelPrice.FuelType.PETROL, today)
                .ifPresent(fp -> prices.put("petrol", toPublicFuelPrice(fp)));

        fuelPriceRepository
                .findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(FuelPrice.FuelType.DIESEL, today)
                .ifPresent(fp -> prices.put("diesel", toPublicFuelPrice(fp)));

        return prices;
    }

    public List<Map<String, Object>> getFurnitureCatalogue(String category) {
        List<FurnitureItem> items;
        if (category != null && !category.isBlank() && !category.equalsIgnoreCase("ALL")) {
            try {
                FurnitureItem.FurnitureCategory cat = FurnitureItem.FurnitureCategory.valueOf(category.toUpperCase());
                items = furnitureItemRepository.findByCategoryAndIsActiveTrue(cat);
            } catch (IllegalArgumentException e) {
                items = furnitureItemRepository.findByIsActiveTrueOrderByNameAsc();
            }
        } else {
            items = furnitureItemRepository.findByIsActiveTrueOrderByNameAsc();
        }
        return items.stream().map(this::toPublicItem).toList();
    }

    public Optional<Map<String, Object>> getFurnitureItem(UUID id) {
        return furnitureItemRepository.findById(id)
                .filter(FurnitureItem::getIsActive)
                .map(this::toPublicItem);
    }

    public List<Map<String, Object>> getEvRates() {
        return evVehicleRepository.findByIsActiveTrueOrderByVehicleNameAsc()
                .stream().map(this::toPublicEvRate).toList();
    }

    // ===================== SAFE SERIALISERS — never add cost/stock/internal fields =====================

    private Map<String, Object> toPublicFuelPrice(FuelPrice fp) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("fuelType", fp.getFuelType().name().toLowerCase());
        map.put("pricePerLiter", fp.getPricePerLiter());
        map.put("effectiveDate", fp.getEffectiveDate().toString());
        return map;
    }

    private Map<String, Object> toPublicItem(FurnitureItem item) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", item.getId().toString());
        map.put("name", item.getName());
        map.put("nameNepali", item.getNameNepali());
        map.put("category", item.getCategory().name());
        map.put("sellingPrice", item.getSellingPrice());
        map.put("description", item.getDescription());
        return map;
    }

    private Map<String, Object> toPublicEvRate(EvVehicle v) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", v.getId().toString());
        map.put("vehicleName", v.getVehicleName());
        map.put("batteryCapacityKw", v.getBatteryCapacityKw());
        map.put("seatingCapacity", v.getSeatingCapacity());
        map.put("ratePerPercent", v.getRatePerPercent());
        return map;
    }
}

package com.samjhana.service;

import com.samjhana.dto.FuelPriceRequest;
import com.samjhana.dto.FuelPriceResponse;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.User;
import com.samjhana.repository.FuelPriceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FuelPriceService {

    private final FuelPriceRepository fuelPriceRepository;
    private final NocPriceScraperService nocPriceScraperService;

    public Map<String, FuelPriceResponse> getCurrentPrices() {
        LocalDate today = LocalDate.now();
        Map<String, FuelPriceResponse> prices = new HashMap<>();
        fuelPriceRepository
                .findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(FuelPrice.FuelType.PETROL, today)
                .ifPresent(fp -> prices.put("petrol", FuelPriceResponse.from(fp)));
        fuelPriceRepository
                .findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(FuelPrice.FuelType.DIESEL, today)
                .ifPresent(fp -> prices.put("diesel", FuelPriceResponse.from(fp)));
        return prices;
    }

    public Optional<FuelPriceResponse> getCurrentPriceByType(String fuelType) {
        FuelPrice.FuelType type = FuelPrice.FuelType.valueOf(fuelType.toUpperCase());
        return fuelPriceRepository
                .findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(type, LocalDate.now())
                .map(FuelPriceResponse::from);
    }

    public List<FuelPriceResponse> getAll() {
        return fuelPriceRepository.findAllByOrderByEffectiveDateDescFuelTypeAsc()
                .stream().map(FuelPriceResponse::from).toList();
    }

    @Transactional
    public FuelPriceResponse setPrice(FuelPriceRequest request, User user) {
        FuelPrice.FuelType fuelType = FuelPrice.FuelType.valueOf(request.getFuelType().toUpperCase());
        LocalDate effectiveDate = request.getEffectiveDate() != null ? request.getEffectiveDate() : LocalDate.now();
        FuelPrice saved = saveOrUpdatePrice(fuelType, request.getPricePerLiter(), effectiveDate, user);
        return FuelPriceResponse.from(saved);
    }

    @Transactional
    public Map<String, FuelPriceResponse> setBulkPrices(Map<String, Object> request, User user) {
        LocalDate effectiveDate = request.containsKey("effectiveDate")
                ? LocalDate.parse((String) request.get("effectiveDate"))
                : LocalDate.now();

        Map<String, FuelPriceResponse> results = new HashMap<>();
        if (request.containsKey("petrolPrice")) {
            FuelPrice fp = saveOrUpdatePrice(FuelPrice.FuelType.PETROL,
                    new BigDecimal(request.get("petrolPrice").toString()), effectiveDate, user);
            results.put("petrol", FuelPriceResponse.from(fp));
        }
        if (request.containsKey("dieselPrice")) {
            FuelPrice fp = saveOrUpdatePrice(FuelPrice.FuelType.DIESEL,
                    new BigDecimal(request.get("dieselPrice").toString()), effectiveDate, user);
            results.put("diesel", FuelPriceResponse.from(fp));
        }
        return results;
    }

    @Transactional
    public Map<String, FuelPriceResponse> fetchNocPrices() {
        nocPriceScraperService.fetchAndSavePrices();
        return getCurrentPrices();
    }

    private FuelPrice saveOrUpdatePrice(FuelPrice.FuelType fuelType, BigDecimal price,
                                        LocalDate effectiveDate, User user) {
        Optional<FuelPrice> existing = fuelPriceRepository.findByFuelTypeAndEffectiveDate(fuelType, effectiveDate);
        FuelPrice fuelPrice;
        if (existing.isPresent()) {
            fuelPrice = existing.get();
            fuelPrice.setPricePerLiter(price);
            fuelPrice.setUpdatedBy(user);
        } else {
            fuelPrice = FuelPrice.builder()
                    .fuelType(fuelType).pricePerLiter(price)
                    .effectiveDate(effectiveDate).updatedBy(user)
                    .build();
        }
        return fuelPriceRepository.save(fuelPrice);
    }
}
package com.samjhana.service;

import com.samjhana.dto.FuelPriceRequest;
import com.samjhana.dto.FuelPriceResponse;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.FuelPriceRepository;
import com.samjhana.util.SafeDecimal;
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
    private final AuditLogRepository auditLogRepository;

    /** The lowest and highest price per litre that is believable (finding P0-08); anything else is a slip of the finger. */
    public static final BigDecimal MIN_PRICE_PER_LITRE = new BigDecimal("0.01");
    public static final BigDecimal MAX_PRICE_PER_LITRE = new BigDecimal("10000");

    public static boolean isSensiblePrice(BigDecimal price) {
        return price != null && price.compareTo(MIN_PRICE_PER_LITRE) >= 0 && price.compareTo(MAX_PRICE_PER_LITRE) <= 0;
    }

    private static BigDecimal checkedPrice(BigDecimal price, String label) {
        if (!isSensiblePrice(price)) {
            throw new IllegalArgumentException(label + " must be between " + MIN_PRICE_PER_LITRE.toPlainString()
                    + " and " + MAX_PRICE_PER_LITRE.toPlainString());
        }
        return price;
    }

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
        if (request.getFuelType() == null || request.getFuelType().isBlank()) {
            throw new IllegalArgumentException("Fuel type is required");
        }
        FuelPrice.FuelType fuelType = FuelPrice.FuelType.valueOf(request.getFuelType().toUpperCase());
        BigDecimal price = checkedPrice(request.getPricePerLiter(), "Price per litre");
        LocalDate effectiveDate = request.getEffectiveDate() != null ? request.getEffectiveDate() : LocalDate.now();
        FuelPrice saved = saveOrUpdatePrice(fuelType, price, effectiveDate, user);
        return FuelPriceResponse.from(saved);
    }

    @Transactional
    public Map<String, FuelPriceResponse> setBulkPrices(Map<String, Object> request, User user) {
        LocalDate effectiveDate = request.containsKey("effectiveDate")
                ? LocalDate.parse((String) request.get("effectiveDate"))
                : LocalDate.now();

        // Both prices are checked before either is saved, so a slip in one does not leave the other half-done.
        BigDecimal petrol = request.containsKey("petrolPrice")
                ? checkedPrice(priceFrom(request.get("petrolPrice"), "Petrol price"), "Petrol price") : null;
        BigDecimal diesel = request.containsKey("dieselPrice")
                ? checkedPrice(priceFrom(request.get("dieselPrice"), "Diesel price"), "Diesel price") : null;

        Map<String, FuelPriceResponse> results = new HashMap<>();
        if (petrol != null) {
            results.put("petrol", FuelPriceResponse.from(saveOrUpdatePrice(FuelPrice.FuelType.PETROL, petrol, effectiveDate, user)));
        }
        if (diesel != null) {
            results.put("diesel", FuelPriceResponse.from(saveOrUpdatePrice(FuelPrice.FuelType.DIESEL, diesel, effectiveDate, user)));
        }
        return results;
    }

    /** A price typed into the form; refused when it is missing or not an ordinary number (finding G-01). */
    private static BigDecimal priceFrom(Object value, String label) {
        BigDecimal price = value == null ? null : SafeDecimal.parse(value.toString());
        if (price == null) throw new IllegalArgumentException(label + " must be a number");
        return price;
    }

    /** Saves the price and records who set it and what it was before (finding P1b-08). An unchanged price changes and records nothing. */
    private FuelPrice saveOrUpdatePrice(FuelPrice.FuelType fuelType, BigDecimal price,
                                        LocalDate effectiveDate, User user) {
        Optional<FuelPrice> existing = fuelPriceRepository.findByFuelTypeAndEffectiveDate(fuelType, effectiveDate);
        if (existing.isPresent()) {
            FuelPrice fuelPrice = existing.get();
            BigDecimal old = fuelPrice.getPricePerLiter();
            if (old.compareTo(price) == 0) return fuelPrice;
            fuelPrice.setPricePerLiter(price);
            fuelPrice.setUpdatedBy(user);
            FuelPrice saved = fuelPriceRepository.save(fuelPrice);
            AuditLog entry = AuditLog.updateEvent(user, AuditLog.EntityType.RESOURCE, saved.getId(),
                    priceJson(fuelType, old, effectiveDate), priceJson(fuelType, price, effectiveDate));
            entry.setDescription("Fuel price changed: " + fuelType + " " + old.toPlainString() + " -> "
                    + price.toPlainString() + " for " + effectiveDate);
            auditLogRepository.save(entry);
            return saved;
        }
        FuelPrice saved = fuelPriceRepository.save(FuelPrice.builder()
                .fuelType(fuelType).pricePerLiter(price)
                .effectiveDate(effectiveDate).updatedBy(user)
                .build());
        AuditLog entry = AuditLog.createEvent(user, AuditLog.EntityType.RESOURCE, saved.getId(),
                priceJson(fuelType, price, effectiveDate));
        entry.setDescription("Fuel price set: " + fuelType + " " + price.toPlainString() + " for " + effectiveDate);
        auditLogRepository.save(entry);
        return saved;
    }

    /** Built by hand: an enum name, a plain number and an ISO date never need escaping. */
    private static String priceJson(FuelPrice.FuelType fuelType, BigDecimal price, LocalDate effectiveDate) {
        return "{\"fuelType\":\"" + fuelType + "\",\"pricePerLiter\":\"" + price.toPlainString()
                + "\",\"effectiveDate\":\"" + effectiveDate + "\"}";
    }
}

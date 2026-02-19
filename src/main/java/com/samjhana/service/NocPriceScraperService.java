package com.samjhana.service;

import com.samjhana.entity.FuelPrice;
import com.samjhana.repository.FuelPriceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class NocPriceScraperService {

    private final FuelPriceRepository fuelPriceRepository;

    @Value("${samjhana.fuel-price-scraper.enabled:true}")
    private boolean enabled;

    @Value("${samjhana.fuel-price-scraper.depot:Bhalbari}")
    private String depot;

    @Value("${samjhana.fuel-price-scraper.url:https://noc.org.np}")
    private String nocUrl;

    // Matches "Rs 154.5 /Ltr" or "NRs 154.5/L" or "Rs154.5 /Ltr" etc.
    private static final Pattern PRICE_PATTERN = Pattern.compile("N?Rs\\.?\\s*([\\d.]+)\\s*/\\s*L(?:tr)?");

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (!enabled) {
            log.info("NOC price scraper is disabled");
            return;
        }
        boolean hasAnyPrices = fuelPriceRepository.findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(
                FuelPrice.FuelType.PETROL, LocalDate.now()).isPresent();
        if (!hasAnyPrices) {
            log.info("No fuel prices found in DB — running initial NOC price fetch");
            fetchAndSavePrices();
        } else {
            log.info("Fuel prices already exist — skipping startup fetch. Scheduled fetch runs daily at 6 AM NPT.");
        }
    }

    // NOC price changes take effect at midnight. Fetch at 12:15 AM and again at 6 AM as a fallback.
    @Scheduled(cron = "0 15 0 * * *", zone = "Asia/Kathmandu")
    @Scheduled(cron = "0 0 6 * * *", zone = "Asia/Kathmandu")
    public void scheduledFetch() {
        if (!enabled) {
            return;
        }
        log.info("Running scheduled NOC fuel price fetch");
        fetchAndSavePrices();
    }

    public void fetchAndSavePrices() {
        try {
            Document doc = Jsoup.connect(nocUrl)
                    .timeout(15_000)
                    .userAgent("SamjhanaVenturesOS/1.0")
                    .get();

            BigDecimal petrolPrice = null;
            BigDecimal dieselPrice = null;

            // Strategy 1: Find the depot group text, walk up to the price container,
            // then look for "Petrol" and "Diesel" card labels followed by price text.
            Elements allElements = doc.getAllElements();
            for (Element el : allElements) {
                if (el.ownText().toLowerCase().contains(depot.toLowerCase())) {
                    Element container = findPriceContainer(el);
                    if (container == null) continue;

                    log.debug("Found depot container with text length: {}", container.text().length());

                    petrolPrice = extractPriceFromContainer(container, "Petrol");
                    dieselPrice = extractPriceFromContainer(container, "Diesel");

                    if (petrolPrice != null || dieselPrice != null) break;
                }
            }

            // Strategy 2: If strategy 1 failed, try the inline format
            // "Petrol(MS):NRs 154.5/L" anywhere near our depot text
            if (petrolPrice == null && dieselPrice == null) {
                String fullText = doc.text();
                // Find region around "Bhalbari"
                int depotIdx = fullText.toLowerCase().indexOf(depot.toLowerCase());
                if (depotIdx >= 0) {
                    // Search in a ~2000 char window around the depot mention
                    int start = Math.max(0, depotIdx - 500);
                    int end = Math.min(fullText.length(), depotIdx + 1500);
                    String region = fullText.substring(start, end);

                    petrolPrice = extractInlinePrice(region, "Petrol");
                    dieselPrice = extractInlinePrice(region, "Diesel");
                }
            }

            // Strategy 3: Last resort — just grab the first price group on the page
            if (petrolPrice == null && dieselPrice == null) {
                log.debug("Depot-specific extraction failed, trying first price group on page");
                String fullText = doc.text();
                petrolPrice = extractInlinePrice(fullText, "Petrol");
                dieselPrice = extractInlinePrice(fullText, "Diesel");
            }

            if (petrolPrice == null && dieselPrice == null) {
                log.warn("Could not extract any fuel prices from NOC website for depot: {}", depot);
                return;
            }

            LocalDate today = LocalDate.now();
            int saved = 0;

            if (petrolPrice != null) {
                saved += saveIfChanged(FuelPrice.FuelType.PETROL, petrolPrice, today) ? 1 : 0;
            }
            if (dieselPrice != null) {
                saved += saveIfChanged(FuelPrice.FuelType.DIESEL, dieselPrice, today) ? 1 : 0;
            }

            if (saved > 0) {
                log.info("NOC price update: Petrol={}, Diesel={} for depot {} (saved {} new entries)",
                        petrolPrice, dieselPrice, depot, saved);
            } else {
                log.info("NOC prices unchanged: Petrol={}, Diesel={} for depot {}",
                        petrolPrice, dieselPrice, depot);
            }

        } catch (Exception e) {
            log.error("Failed to fetch NOC fuel prices: {}. Manual entry remains available.", e.getMessage());
        }
    }

    private Element findPriceContainer(Element depotElement) {
        Element container = depotElement.parent();
        if (container == null) return null;

        // Walk up to find a container that has price text
        for (int i = 0; i < 8 && container.parent() != null; i++) {
            String text = container.text();
            if ((text.contains("Rs") || text.contains("NRs")) &&
                (text.contains("/Ltr") || text.contains("/L")) &&
                text.contains("Petrol")) {
                return container;
            }
            container = container.parent();
        }
        return container;
    }

    private BigDecimal extractPriceFromContainer(Element container, String fuelLabel) {
        // Look for h5/h6 card structure: h6 "Petrol" followed by h5 "Rs 154.5 /Ltr"
        Elements headings = container.select("h5, h6");
        boolean foundLabel = false;
        for (Element h : headings) {
            String text = h.text().trim();
            if (text.toLowerCase().contains(fuelLabel.toLowerCase()) && !text.contains("Rs") && !text.contains("NRs")) {
                foundLabel = true;
                continue;
            }
            if (foundLabel) {
                Matcher m = PRICE_PATTERN.matcher(text);
                if (m.find()) {
                    return parseBigDecimal(m.group(1), fuelLabel);
                }
                foundLabel = false;
            }
        }

        // Fallback: look for any element after the label element
        Elements allChildren = container.getAllElements();
        foundLabel = false;
        for (Element child : allChildren) {
            String text = child.ownText().trim();
            if (text.toLowerCase().contains(fuelLabel.toLowerCase()) && !text.contains("Rs") && !text.contains("NRs")) {
                foundLabel = true;
                continue;
            }
            if (foundLabel && !text.isEmpty()) {
                Matcher m = PRICE_PATTERN.matcher(text);
                if (m.find()) {
                    return parseBigDecimal(m.group(1), fuelLabel);
                }
                // Reset if we hit a different fuel label
                if (text.toLowerCase().contains("diesel") || text.toLowerCase().contains("petrol") ||
                    text.toLowerCase().contains("kerosene")) {
                    foundLabel = false;
                }
            }
        }

        return null;
    }

    private BigDecimal extractInlinePrice(String text, String fuelLabel) {
        // Matches "Petrol(MS):NRs 154.5/L" or "Petrol ... Rs 154.5 /Ltr"
        Pattern inlinePattern = Pattern.compile(
                fuelLabel + "(?:\\s*\\([^)]*\\))?\\s*:?\\s*N?Rs\\.?\\s*([\\d.]+)\\s*/\\s*L(?:tr)?",
                Pattern.CASE_INSENSITIVE
        );
        Matcher m = inlinePattern.matcher(text);
        if (m.find()) {
            return parseBigDecimal(m.group(1), fuelLabel);
        }
        return null;
    }

    private BigDecimal parseBigDecimal(String value, String context) {
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException e) {
            log.warn("Could not parse price for {}: {}", context, value);
            return null;
        }
    }

    private boolean saveIfChanged(FuelPrice.FuelType fuelType, BigDecimal newPrice, LocalDate today) {
        Optional<FuelPrice> current = fuelPriceRepository
                .findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(fuelType, today);

        if (current.isPresent() && current.get().getPricePerLiter().compareTo(newPrice) == 0) {
            return false;
        }

        Optional<FuelPrice> todayEntry = fuelPriceRepository.findByFuelTypeAndEffectiveDate(fuelType, today);

        FuelPrice fuelPrice;
        if (todayEntry.isPresent()) {
            fuelPrice = todayEntry.get();
            fuelPrice.setPricePerLiter(newPrice);
            fuelPrice.setUpdatedBy(null);
        } else {
            fuelPrice = FuelPrice.builder()
                    .fuelType(fuelType)
                    .pricePerLiter(newPrice)
                    .effectiveDate(today)
                    .updatedBy(null)
                    .build();
        }

        fuelPriceRepository.save(fuelPrice);
        return true;
    }
}

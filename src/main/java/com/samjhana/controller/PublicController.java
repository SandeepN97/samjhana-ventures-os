package com.samjhana.controller;

import com.samjhana.service.PublicApiService;
import com.samjhana.service.ShopCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Public read-only API consumed by samjhana-web.
 * No authentication required. Never returns profit, WAC, cost prices,
 * stock levels, staff data, or internal transaction IDs.
 */
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicController {

    private final PublicApiService publicApiService;
    private final ShopCatalogService shopCatalogService;

    @GetMapping("/fuel-prices/current")
    public ResponseEntity<?> getCurrentFuelPrices() {
        return ResponseEntity.ok(publicApiService.getCurrentFuelPrices());
    }

    @GetMapping("/furniture/catalogue")
    public ResponseEntity<?> getFurnitureCatalogue(
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(publicApiService.getFurnitureCatalogue(category));
    }

    @GetMapping("/furniture/catalogue/{id}")
    public ResponseEntity<?> getFurnitureItem(@PathVariable String id) {
        return publicApiService.getFurnitureItem(UUID.fromString(id))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/shop/products")
    public ResponseEntity<?> shopProducts(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) java.math.BigDecimal minPrice,
            @RequestParam(required = false) java.math.BigDecimal maxPrice,
            @RequestParam(required = false, defaultValue = "false") boolean inStock,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "24") int size,
            @RequestParam(required = false) String slugs) {
        java.util.List<String> slugList = slugs == null || slugs.isBlank() ? null
                : java.util.Arrays.stream(slugs.split(",")).map(String::trim).filter(x -> !x.isEmpty()).limit(60).toList();
        return ResponseEntity.ok(shopCatalogService.search(type, category,
                q != null && q.length() > 100 ? q.substring(0, 100) : q, minPrice, maxPrice, inStock, sort, page, size, slugList));
    }

    @GetMapping("/shop/products/{slug}")
    public ResponseEntity<?> shopProduct(@PathVariable String slug) {
        return shopCatalogService.detail(slug)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/beekeeping")
    public ResponseEntity<?> getBeekeepingCatalogue() {
        return ResponseEntity.ok(publicApiService.getBeekeepingCatalogue());
    }

    @GetMapping("/beekeeping/{slug}")
    public ResponseEntity<?> getBeekeepingProduct(@PathVariable String slug) {
        return publicApiService.getBeekeepingProduct(slug)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/ev/rates")
    public ResponseEntity<?> getEvRates() {
        return ResponseEntity.ok(publicApiService.getEvRates());
    }
}
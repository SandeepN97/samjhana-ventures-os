package com.samjhana.seed;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BeekeepingProduct.BeekeepingCategory;
import com.samjhana.repository.BeekeepingProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Loads the shop's existing product list ({@code seed/beekeeping-products.json}, the products the public
 * site used to carry in its own code) so the admin starts with them instead of an empty shop.
 *
 * <p>Reference data like {@link BusinessUnitSeeder}: it only adds a product whose SKU is missing and never
 * touches one that exists, so prices and counts staff changed later are kept. Products start with
 * <b>zero stock</b> and no cost price: the real counts are entered in the admin. Tests build their own
 * fixtures, so the {@code test} profile is excluded.
 */
@Component
@Profile("!test")
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@RequiredArgsConstructor
@Slf4j
public class BeekeepingProductSeeder implements CommandLineRunner {

    static final String RESOURCE = "seed/beekeeping-products.json";

    private final BeekeepingProductRepository productRepository;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public void run(String... args) throws IOException {
        List<Map<String, Object>> products;
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            products = objectMapper.readValue(in, new TypeReference<>() {});
        }
        int added = 0;
        for (Map<String, Object> p : products) {
            String sku = (String) p.get("sku");
            if (productRepository.existsBySku(sku) || productRepository.existsBySlug((String) p.get("slug"))) continue;
            productRepository.save(BeekeepingProduct.builder()
                    .sku(sku)
                    .slug((String) p.get("slug"))
                    .name((String) p.get("name"))
                    .nameNepali((String) p.get("nameNepali"))
                    .category(BeekeepingCategory.valueOf((String) p.get("category")))
                    .sellingPrice(p.get("sellingPrice") == null ? null : new BigDecimal(p.get("sellingPrice").toString()))
                    .description((String) p.get("description"))
                    .badge((String) p.get("badge"))
                    .details(p.get("details") == null ? null : objectMapper.writeValueAsString(p.get("details")))
                    .stockQty(0)
                    .showOnWebsite(true)
                    .build());
            added++;
        }
        if (added > 0) {
            log.info("Added {} beekeeping product(s) with zero stock; enter the real counts in the admin.", added);
        }
    }
}

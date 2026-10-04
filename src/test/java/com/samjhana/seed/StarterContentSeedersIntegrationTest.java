package com.samjhana.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BeekeepingProduct.BeekeepingCategory;
import com.samjhana.repository.*;
import com.samjhana.service.MediaService;
import com.samjhana.service.SiteContentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The seeders are off in the test profile, so they are built by hand here and run against the test database:
 * the starter pictures, website text, menu and beekeeping products a fresh install gets.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StarterContentSeedersIntegrationTest {

    @Autowired MediaAssetRepository mediaRepository;
    @Autowired MediaService mediaService;
    @Autowired SiteContentService siteContentService;
    @Autowired SiteContentRepository siteContentRepository;
    @Autowired RestaurantDishRepository dishRepository;
    @Autowired BeekeepingProductRepository productRepository;
    @Autowired ObjectMapper objectMapper;

    private SeedImages seedImages;

    @BeforeEach
    void setUp() {
        seedImages = new SeedImages(mediaRepository, mediaService);
        siteContentRepository.deleteAll();
        dishRepository.deleteAll();
        productRepository.deleteAll();
    }

    private SiteContentSeeder siteSeeder() {
        return new SiteContentSeeder(siteContentService, siteContentRepository, seedImages, objectMapper);
    }

    private BeekeepingProductSeeder productSeeder() {
        return new BeekeepingProductSeeder(productRepository, objectMapper, seedImages, mediaService);
    }

    @SuppressWarnings("unchecked")
    private static void collectPictureIds(Object node, String field, List<String> out) {
        if (node instanceof Map<?, ?> map) map.forEach((k, v) -> collectPictureIds(v, String.valueOf(k), out));
        else if (node instanceof List<?> list) list.forEach(v -> collectPictureIds(v, field, out));
        else if (node instanceof String s && field.toLowerCase().endsWith("image") && !s.isEmpty()) out.add(s);
    }

    @Test
    void shouldSaveEveryWebsiteSection_withRealPicturesInPlaceOfThePlaceholders() throws Exception {
        siteSeeder().run();

        assertThat(siteContentRepository.findAll()).extracting(c -> c.getContentKey())
                .containsExactlyInAnyOrderElementsOf(SiteContentService.KEYS);
        List<String> ids = new ArrayList<>();
        collectPictureIds(siteContentService.getAll(), "", ids);
        assertThat(ids).hasSizeGreaterThanOrEqualTo(12);
        for (String id : ids) {
            assertThat(mediaRepository.findByIdAndDeletedAtIsNull(UUID.fromString(id))).as("picture %s", id).isPresent();
        }
        assertThat(siteContentService.get("hub").toString()).doesNotContain("@visit-scene");
        assertThat(((Map<?, ?>) ((Map<?, ?>) siteContentService.get("hub")).get("visit")).get("image")).isNotEqualTo("");
    }

    @Test
    void shouldOnlyAddWhatIsMissing_andNeverOverwriteWhatStaffEdited() throws Exception {
        siteSeeder().run();
        long pictures = mediaRepository.count();
        siteContentService.put("hours", new LinkedHashMap<>(Map.of("fuelEv", "7am – 8pm")), "admin");

        siteSeeder().run();

        assertThat(mediaRepository.count()).isEqualTo(pictures);                 // no duplicate pictures
        assertThat(siteContentService.get("hours")).containsEntry("fuelEv", "7am – 8pm");
    }

    @Test
    void shouldFillOnlyTheSectionThatWasNeverSaved() throws Exception {
        siteSeeder().run();
        siteContentRepository.deleteById("trust");
        siteSeeder().run();
        assertThat(siteContentRepository.existsById("trust")).isTrue();
    }

    @Test
    void shouldAddTheStarterMenuOnce_andNotBringBackRemovedDishes() {
        RestaurantDishSeeder seeder = new RestaurantDishSeeder(dishRepository);
        seeder.run();
        assertThat(dishRepository.count()).isEqualTo(14);
        assertThat(dishRepository.findAll()).anyMatch(d -> d.getName().equals("Dal Bhat Set") && d.getVeg()
                && d.getMealPeriods().equals("LUNCH,DINNER"));
        assertThat(dishRepository.findAll()).allMatch(d -> d.getPrice() == null && d.getImageId() == null);

        dishRepository.delete(dishRepository.findAll().get(0));
        seeder.run();
        assertThat(dishRepository.count()).isEqualTo(13);
    }

    @Test
    void shouldImportTheTwentySixProductsWithTheirStarterPicturesAndNoStock() throws Exception {
        productSeeder().run();

        List<BeekeepingProduct> products = productRepository.findAll();
        assertThat(products).hasSize(26);
        assertThat(products).allMatch(p -> p.getStockQty() == 0 && p.getShowOnWebsite());
        for (BeekeepingProduct p : products) {
            List<UUID> pictures = mediaService.fromJson(p.getImageIds());
            assertThat(pictures).as("pictures of %s", p.getSlug()).hasSize(1);
            assertThat(mediaRepository.findByIdAndDeletedAtIsNull(pictures.get(0))).isPresent();
        }
        // the two suits share one starter picture instead of storing it twice
        assertThat(productRepository.findBySku("GEAR-001").orElseThrow().getImageIds())
                .isEqualTo(productRepository.findBySku("GEAR-002").orElseThrow().getImageIds());
    }

    @Test
    void shouldGiveAnOlderProductItsPicture_butLeaveOneStaffEmptiedAlone() throws Exception {
        productSeeder().run();
        BeekeepingProduct older = productRepository.findBySku("HIVE-001").orElseThrow();
        older.setImageIds(null);                                   // from before pictures existed
        BeekeepingProduct emptied = productRepository.findBySku("HIVE-002").orElseThrow();
        emptied.setImageIds("[]");                                 // staff removed its pictures on purpose
        productRepository.saveAll(List.of(older, emptied));
        long products = productRepository.count();

        productSeeder().run();

        assertThat(productRepository.count()).isEqualTo(products);
        assertThat(mediaService.fromJson(productRepository.findBySku("HIVE-001").orElseThrow().getImageIds())).hasSize(1);
        assertThat(mediaService.fromJson(productRepository.findBySku("HIVE-002").orElseThrow().getImageIds())).isEmpty();
    }

    @Test
    void shouldKeepAProductStaffEditedAsItIs() throws Exception {
        productSeeder().run();
        BeekeepingProduct honey = productRepository.findBySku("HONEY-001").orElseThrow();
        honey.setSellingPrice(new java.math.BigDecimal("999"));
        honey.setStockQty(7);
        honey.setCategory(BeekeepingCategory.HONEY);
        productRepository.save(honey);

        productSeeder().run();

        BeekeepingProduct after = productRepository.findBySku("HONEY-001").orElseThrow();
        assertThat(after.getSellingPrice()).isEqualByComparingTo("999");
        assertThat(after.getStockQty()).isEqualTo(7);
    }
}

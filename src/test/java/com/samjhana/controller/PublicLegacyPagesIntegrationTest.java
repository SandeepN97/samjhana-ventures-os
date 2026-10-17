package com.samjhana.controller;

import com.samjhana.entity.EvVehicle;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.repository.EvVehicleRepository;
import com.samjhana.repository.FurnitureItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding P0-07: the older public furniture and EV pages ignored the "Hidden on website" switch and handed out the
 * database ids. Through the real (anonymous) routes: hidden items are not listed or found, the public id is the slug,
 * and no response from these pages holds a database id.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PublicLegacyPagesIntegrationTest {

    private static final Pattern A_DATABASE_ID = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

    @Autowired MockMvc mockMvc;
    @Autowired FurnitureItemRepository furniture;
    @Autowired EvVehicleRepository vehicles;

    private FurnitureItem item(String name, String slug, Boolean showOnWebsite, boolean active) {
        return furniture.save(FurnitureItem.builder().name(name).sku("P007-" + name.toUpperCase().replace(' ', '-'))
                .slug(slug).category(FurnitureItem.FurnitureCategory.SOFA).sellingPrice(new BigDecimal("15000"))
                .purchasePrice(new BigDecimal("9000")).showOnWebsite(showOnWebsite).isActive(active).build());
    }

    @Test
    void shouldListOnlyWhatTheWebsiteShows_withTheSlugAsTheId() throws Exception {
        FurnitureItem shown = item("Shown Sofa", "p007-shown-sofa", true, true);
        item("Hidden Sofa", "p007-hidden-sofa", false, true);
        item("Old Sofa", "p007-old-sofa", true, false);

        String body = mockMvc.perform(get("/api/public/furniture/catalogue"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem("p007-shown-sofa")))
                .andExpect(jsonPath("$[*].id", not(hasItem("p007-hidden-sofa"))))
                .andExpect(jsonPath("$[*].id", not(hasItem("p007-old-sofa"))))
                .andExpect(jsonPath("$[*].name", not(hasItem("Hidden Sofa"))))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain(shown.getId().toString());
        assertThat(A_DATABASE_ID.matcher(body).find()).as("no database id anywhere in the list").isFalse();
        assertThat(body).doesNotContain("purchasePrice").doesNotContain("stockQty");
    }

    @Test
    void shouldFindAnItemBySlug_butNotByDatabaseId_andNotWhenHidden() throws Exception {
        FurnitureItem shown = item("Shown Table", "p007-shown-table", true, true);
        FurnitureItem hidden = item("Hidden Table", "p007-hidden-table", false, true);

        mockMvc.perform(get("/api/public/furniture/catalogue/p007-shown-table"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("p007-shown-table"))
                .andExpect(jsonPath("$.name").value("Shown Table"));
        mockMvc.perform(get("/api/public/furniture/catalogue/p007-hidden-table")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/furniture/catalogue/" + shown.getId())).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/furniture/catalogue/" + hidden.getId())).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/furniture/catalogue/no-such-item")).andExpect(status().isNotFound());
    }

    @Test
    void shouldCountAnItemWhoseSwitchWasNeverSetAsShown() throws Exception {
        item("Older Chair", "p007-older-chair", null, true);

        mockMvc.perform(get("/api/public/furniture/catalogue"))
                .andExpect(jsonPath("$[*].id", hasItem("p007-older-chair")));
    }

    @Test
    void shouldNotHandOutTheDatabaseIdOfAnEvRate() throws Exception {
        EvVehicle vehicle = vehicles.save(EvVehicle.builder().vehicleName("P007 Test Bus")
                .batteryCapacityKw(new BigDecimal("100")).seatingCapacity(16).ratePerPercent(new BigDecimal("10")).isActive(true).build());

        String body = mockMvc.perform(get("/api/public/ev/rates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].vehicleName", hasItem("P007 Test Bus")))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain(vehicle.getId().toString());
        assertThat(A_DATABASE_ID.matcher(body).find()).isFalse();
    }
}

package com.samjhana.controller;

import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BeekeepingProduct.BeekeepingCategory;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.User;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Beekeeping through the real security filter chain: who may read cost, who may change prices and
 * stock, that a sale moves the stock (and an oversell moves nothing), and that the public endpoint
 * never leaks cost, counts or database ids.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class BeekeepingControllerIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BeekeepingProductRepository productRepository;
    @Autowired BusinessUnitRepository businessUnitRepository;

    private BeekeepingProduct honey;
    private BeekeepingProduct hive;
    private String staff;
    private String manager;
    private String admin;

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    @BeforeEach
    void setUp() {
        staff = bearer("bee-staff", User.UserRole.STAFF);
        manager = bearer("bee-manager", User.UserRole.MANAGER);
        admin = bearer("bee-admin", User.UserRole.ADMIN);
        if (businessUnitRepository.findByCode("beekeeping").isEmpty()) {
            businessUnitRepository.save(BusinessUnit.builder().code("beekeeping").name("Beekeeping Shop")
                    .nameNepali("मौरीपालन पसल").calculationStrategy("BeekeepingStrategy").build());
        }
        honey = productRepository.save(BeekeepingProduct.builder().name("Wild Honey").sku("BT-HNY-1").slug("bt-hny-1")
                .category(BeekeepingCategory.HONEY).purchasePrice(new BigDecimal("500")).sellingPrice(new BigDecimal("850"))
                .stockQty(10).reorderLevel(2).details("{\"unit\":\"per 500g jar\"}").showOnWebsite(true).build());
        hive = productRepository.save(BeekeepingProduct.builder().name("Hidden Hive").sku("BT-HIVE-1").slug("bt-hive-1")
                .category(BeekeepingCategory.HIVE).sellingPrice(new BigDecimal("4500")).stockQty(0).showOnWebsite(false).build());
    }

    private String saleBody(BeekeepingProduct p, int qty) {
        return "{\"businessCode\":\"beekeeping\",\"transactionType\":\"SALE\",\"amount\":" + (850 * qty)
                + ",\"transactionDate\":\"" + LocalDate.now() + "\",\"customFields\":{\"customerName\":\"Hari\","
                + "\"paymentMethod\":\"CASH\",\"items\":[{\"itemId\":\"" + p.getId() + "\",\"itemName\":\"" + p.getName()
                + "\",\"quantity\":" + qty + ",\"unitPrice\":850}]}}";
    }

    private int stockOf(BeekeepingProduct p) {
        return productRepository.findById(p.getId()).orElseThrow().getStockQty();
    }

    // ---- who can see and change what --------------------------------------------------------------

    @Test
    void shouldRequireLogin_forEveryAdminEndpoint() throws Exception {
        mockMvc.perform(get("/api/beekeeping/items")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/beekeeping/dashboard")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/beekeeping/items").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldHideCostFromStaff_butShowItToManagers() throws Exception {
        mockMvc.perform(get("/api/beekeeping/items").header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.sku=='BT-HNY-1')].sellingPrice").exists())
                .andExpect(jsonPath("$[?(@.sku=='BT-HNY-1')].stockQty").exists())
                .andExpect(jsonPath("$[?(@.sku=='BT-HNY-1')].purchasePrice").doesNotExist());
        mockMvc.perform(get("/api/beekeeping/items/{id}", honey.getId()).header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purchasePrice").value(500));
    }

    @Test
    void shouldLetOnlyAdminsAddEditOrRemoveProducts() throws Exception {
        String body = "{\"name\":\"New Jar\",\"category\":\"HONEY\",\"sellingPrice\":900}";
        for (String who : new String[]{staff, manager}) {
            mockMvc.perform(post("/api/beekeeping/items").header("Authorization", who)
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
            mockMvc.perform(put("/api/beekeeping/items/{id}", honey.getId()).header("Authorization", who)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"sellingPrice\":1}")).andExpect(status().isForbidden());
            mockMvc.perform(delete("/api/beekeeping/items/{id}", honey.getId()).header("Authorization", who))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(post("/api/beekeeping/items").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.item.name").value("New Jar"));
    }

    @Test
    void shouldRejectBadInput_withAMessage() throws Exception {
        mockMvc.perform(post("/api/beekeeping/items").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"X\",\"sellingPrice\":-5}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/beekeeping/items").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"X\",\"sku\":\"BT-HNY-1\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldSoftDeleteAProduct_leavingTheRow() throws Exception {
        mockMvc.perform(delete("/api/beekeeping/items/{id}", honey.getId()).header("Authorization", admin))
                .andExpect(status().isOk());
        assertThat(productRepository.findById(honey.getId())).hasValueSatisfying(p -> assertThat(p.getDeletedAt()).isNotNull());
        mockMvc.perform(get("/api/beekeeping/items/{id}", honey.getId()).header("Authorization", admin))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldLetManagersAdjustStock_butNotStaff_andNeverBelowZero() throws Exception {
        mockMvc.perform(patch("/api/beekeeping/items/{id}/stock", honey.getId()).header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content("{\"adjustment\":1}")).andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/beekeeping/items/{id}/stock", honey.getId()).header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"adjustment\":5}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.item.stockQty").value(15));
        mockMvc.perform(patch("/api/beekeeping/items/{id}/stock", honey.getId()).header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"adjustment\":-99}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
        assertThat(stockOf(honey)).isEqualTo(15);
    }

    // ---- sales move stock -------------------------------------------------------------------------

    @Test
    void shouldLowerStock_whenASaleIsRecorded() throws Exception {
        mockMvc.perform(post("/api/transactions").header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content(saleBody(honey, 3)))
                .andExpect(status().isOk());
        assertThat(stockOf(honey)).isEqualTo(7);
    }

    @Test
    void shouldRefuseAnOversell_andChangeNothing() throws Exception {
        mockMvc.perform(post("/api/transactions").header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content(saleBody(honey, 11)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
        assertThat(stockOf(honey)).isEqualTo(10);
        mockMvc.perform(get("/api/beekeeping/orders").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void shouldWorkOutProfitOnTheServer_andHideItFromStaff() throws Exception {
        // client-sent profit is ignored; staff never see cost fields
        String body = saleBody(honey, 2).replace("\"paymentMethod\":\"CASH\"", "\"paymentMethod\":\"CASH\",\"profit\":999999");
        mockMvc.perform(post("/api/transactions").header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customFields", not(containsString("profit"))))
                .andExpect(jsonPath("$.customFields", not(containsString("costPrice"))));
        mockMvc.perform(get("/api/transactions?businessCode=beekeeping").header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].customFields", containsString("\"profit\" : 700")))
                .andExpect(jsonPath("$[0].customFields", not(containsString("999999"))));
    }

    @Test
    void shouldListSalesInOrderHistory_andCountThemOnTheDashboard() throws Exception {
        mockMvc.perform(post("/api/transactions").header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content(saleBody(honey, 1))).andExpect(status().isOk());
        mockMvc.perform(get("/api/beekeeping/orders").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].customerName").value("Hari"));
        mockMvc.perform(get("/api/beekeeping/dashboard").header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.todaySalesCount").value(1))
                .andExpect(jsonPath("$.todayRevenue").value(850));
    }

    // ---- the guarded update itself ----------------------------------------------------------------

    @Test
    void shouldNeverTakeStockBelowZero_inTheGuardedUpdate() {
        assertThat(productRepository.removeStock(honey.getId(), 11)).isZero();
        assertThat(stockOf(honey)).isEqualTo(10);
        assertThat(productRepository.removeStock(honey.getId(), 10)).isEqualTo(1);
        assertThat(stockOf(honey)).isZero();
        assertThat(productRepository.removeStock(honey.getId(), 1)).isZero();
    }

    // ---- public endpoint --------------------------------------------------------------------------

    @Test
    void shouldServeOnlyShownProductsPublicly_withoutCostCountOrDatabaseId() throws Exception {
        mockMvc.perform(get("/api/public/beekeeping"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='bt-hny-1')].name").value("Wild Honey"))
                .andExpect(jsonPath("$[?(@.id=='bt-hny-1')].stockStatus").value("IN_STOCK"))
                .andExpect(jsonPath("$[?(@.id=='bt-hny-1')].details.unit").value("per 500g jar"))
                .andExpect(jsonPath("$[?(@.id=='bt-hive-1')]").isEmpty())
                .andExpect(content().string(not(containsString("purchasePrice"))))
                .andExpect(content().string(not(containsString("stockQty"))))
                .andExpect(content().string(not(containsString("reorderLevel"))))
                .andExpect(content().string(not(containsString(honey.getId().toString()))));
    }

    @Test
    void shouldShowFewLeftAndOutOfStockStatuses_publicly() throws Exception {
        honey.setStockQty(2);
        productRepository.save(honey);
        mockMvc.perform(get("/api/public/beekeeping/{slug}", "bt-hny-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stockStatus").value("LOW_STOCK"));
        honey.setStockQty(0);
        productRepository.save(honey);
        mockMvc.perform(get("/api/public/beekeeping/{slug}", "bt-hny-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stockStatus").value("OUT_OF_STOCK"));
    }

    @Test
    void shouldReturn404_forAHiddenOrUnknownPublicProduct_andRefuseWrites() throws Exception {
        mockMvc.perform(get("/api/public/beekeeping/{slug}", "bt-hive-1")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/beekeeping/{slug}", "nope")).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/public/beekeeping").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isGreaterThanOrEqualTo(400));
    }
}

package com.samjhana.controller;

import com.jayway.jsonpath.JsonPath;
import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BeekeepingProduct.BeekeepingCategory;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.FurnitureItem.FurnitureCategory;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.*;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** The public shop (catalogue, orders, tracking) and the staff side of online orders, through the real filter chain. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ShopStoreIntegrationTest {

    private static final AtomicInteger PHONES = new AtomicInteger(1000);

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired FurnitureItemRepository furnitureRepository;
    @Autowired BeekeepingProductRepository beekeepingRepository;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired TransactionRepository transactionRepository;

    private FurnitureItem sofa, hiddenChair;
    private BeekeepingProduct honey, hive, hiddenJar;
    private String staff, manager;

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    @BeforeEach
    void setUp() {
        staff = bearer("shop-staff", User.UserRole.STAFF);
        manager = bearer("shop-manager", User.UserRole.MANAGER);
        for (String code : List.of("furniture", "beekeeping")) {
            if (businessUnitRepository.findByCode(code).isEmpty()) {
                businessUnitRepository.save(BusinessUnit.builder().code(code).name(code).nameNepali(code).build());
            }
        }
        sofa = furnitureRepository.save(FurnitureItem.builder().name("Teak Sofa").sku("T-SOFA-1").slug("t-sofa-1")
                .category(FurnitureCategory.SOFA).purchasePrice(new BigDecimal("30000")).sellingPrice(new BigDecimal("45000"))
                .stockQty(3).reorderLevel(1).description("Three seater in solid teak").build());
        hiddenChair = furnitureRepository.save(FurnitureItem.builder().name("Hidden Chair").sku("T-CHR-1").slug("t-chr-1")
                .category(FurnitureCategory.CHAIR).sellingPrice(new BigDecimal("2000")).stockQty(5).showOnWebsite(false).build());
        honey = beekeepingRepository.save(BeekeepingProduct.builder().name("Wild Honey").sku("T-HNY-1").slug("t-hny-1")
                .category(BeekeepingCategory.HONEY).purchasePrice(new BigDecimal("500")).sellingPrice(new BigDecimal("850"))
                .stockQty(10).reorderLevel(2).description("Raw unfiltered").details("{\"unit\":\"per 500g jar\"}").showOnWebsite(true).build());
        hive = beekeepingRepository.save(BeekeepingProduct.builder().name("Empty Hive").sku("T-HIVE-1").slug("t-hive-1")
                .category(BeekeepingCategory.HIVE).sellingPrice(new BigDecimal("4500")).stockQty(0).showOnWebsite(true).build());
        hiddenJar = beekeepingRepository.save(BeekeepingProduct.builder().name("Hidden Jar").sku("T-JAR-1").slug("t-jar-1")
                .category(BeekeepingCategory.HONEY).sellingPrice(new BigDecimal("100")).stockQty(5).showOnWebsite(false).build());
    }

    private String phone() {
        return "98" + PHONES.incrementAndGet() + "5678";
    }

    private String orderJson(String phone, String fulfilment, String... slugQty) {
        StringBuilder items = new StringBuilder();
        for (int i = 0; i < slugQty.length; i += 2) {
            if (i > 0) items.append(',');
            items.append("{\"slug\":\"").append(slugQty[i]).append("\",\"quantity\":").append(slugQty[i + 1]).append('}');
        }
        String address = "DELIVERY".equals(fulfilment) ? ",\"addressLine\":\"Ward 3, Tamghas\",\"city\":\"Gulmi\"" : "";
        return "{\"customerName\":\"Hari Thapa\",\"customerPhone\":\"" + phone + "\",\"fulfilment\":\"" + fulfilment + "\""
                + address + ",\"items\":[" + items + "]}";
    }

    private ResultActions place(String json) throws Exception {
        return mockMvc.perform(post("/api/public/shop/orders").contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private String placeOk(String json) throws Exception {
        return JsonPath.read(place(json).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.orderNumber");
    }

    private String adminId(String orderNumber) throws Exception {
        MvcResult r = mockMvc.perform(get("/api/shop-orders?search=" + orderNumber).header("Authorization", staff)).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(), "$[0].id");
    }

    private int stock(UUID id, boolean furniture) {
        return furniture ? furnitureRepository.findById(id).orElseThrow().getStockQty()
                : beekeepingRepository.findById(id).orElseThrow().getStockQty();
    }

    // ==================================== catalogue ====================================

    @Test
    void shouldListOnlyProductsSwitchedOnForTheWebsite_withAStatusInsteadOfTheCount() throws Exception {
        mockMvc.perform(get("/api/public/shop/products?size=60"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.id=='t-sofa-1')].stockStatus").value(hasItem("IN_STOCK")))
                .andExpect(jsonPath("$.items[?(@.id=='t-hny-1')].stockStatus").value(hasItem("IN_STOCK")))
                .andExpect(jsonPath("$.items[?(@.id=='t-hive-1')].stockStatus").value(hasItem("OUT_OF_STOCK")))
                .andExpect(jsonPath("$.items[?(@.id=='t-chr-1')]").isEmpty())
                .andExpect(jsonPath("$.items[?(@.id=='t-jar-1')]").isEmpty());
    }

    @Test
    void shouldNeverExposeCostSkuCountsOrDatabaseIds() throws Exception {
        String body = mockMvc.perform(get("/api/public/shop/products?size=60")).andReturn().getResponse().getContentAsString();
        String detail = mockMvc.perform(get("/api/public/shop/products/t-hny-1")).andReturn().getResponse().getContentAsString();
        for (String text : List.of(body, detail)) {
            assertThat(text).doesNotContain("purchasePrice").doesNotContain("stockQty").doesNotContain("reorderLevel")
                    .doesNotContain("\"sku\"").doesNotContain("T-HNY-1").doesNotContain("500.00")
                    .doesNotContain(sofa.getId().toString()).doesNotContain(honey.getId().toString());
        }
    }

    @Test
    void shouldFilterByTypeCategoryTextPriceAndAvailability() throws Exception {
        mockMvc.perform(get("/api/public/shop/products?type=FURNITURE&size=60"))
                .andExpect(jsonPath("$.items[?(@.id=='t-sofa-1')]").isNotEmpty())
                .andExpect(jsonPath("$.items[?(@.id=='t-hny-1')]").isEmpty());
        mockMvc.perform(get("/api/public/shop/products?type=BEEKEEPING&category=HIVE&size=60"))
                .andExpect(jsonPath("$.items[?(@.id=='t-hive-1')]").isNotEmpty())
                .andExpect(jsonPath("$.items[?(@.id=='t-hny-1')]").isEmpty());
        mockMvc.perform(get("/api/public/shop/products?q=teak"))      // matches the description, not just the name
                .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].id").value("t-sofa-1"));
        mockMvc.perform(get("/api/public/shop/products?minPrice=800&maxPrice=1000&size=60"))
                .andExpect(jsonPath("$.items[?(@.id=='t-hny-1')]").isNotEmpty())
                .andExpect(jsonPath("$.items[?(@.id=='t-sofa-1')]").isEmpty());
        mockMvc.perform(get("/api/public/shop/products?inStock=true&size=60"))
                .andExpect(jsonPath("$.items[?(@.id=='t-hive-1')]").isEmpty())
                .andExpect(jsonPath("$.items[?(@.id=='t-hny-1')]").isNotEmpty());
    }

    @Test
    void shouldSortAndPage() throws Exception {
        MvcResult asc = mockMvc.perform(get("/api/public/shop/products?sort=price_asc&type=BEEKEEPING&size=60")).andReturn();
        List<Number> ascPrices = JsonPath.read(asc.getResponse().getContentAsString(), "$.items[*].price");
        assertThat(ascPrices).isSortedAccordingTo((a, b) -> Double.compare(a.doubleValue(), b.doubleValue()));
        MvcResult desc = mockMvc.perform(get("/api/public/shop/products?sort=price_desc&size=60")).andReturn();
        List<Number> descPrices = JsonPath.read(desc.getResponse().getContentAsString(), "$.items[*].price");
        assertThat(descPrices).isSortedAccordingTo((a, b) -> Double.compare(b.doubleValue(), a.doubleValue()));

        mockMvc.perform(get("/api/public/shop/products?size=1&page=2"))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.totalPages").value(greaterThan(1)));
        mockMvc.perform(get("/api/public/shop/products?size=9999")).andExpect(jsonPath("$.size").value(60));
        mockMvc.perform(get("/api/public/shop/products?page=999&size=1")).andExpect(status().isOk());
    }

    @Test
    void shouldCountDepartmentsAndCategoriesAsFacets() throws Exception {
        mockMvc.perform(get("/api/public/shop/products"))
                .andExpect(jsonPath("$.facets.types[?(@.value=='FURNITURE')].count").value(hasItem(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.facets.categories[?(@.value=='HIVE')].label").value(hasItem("Hives")))
                .andExpect(jsonPath("$.facets.price.min").exists());
    }

    @Test
    void shouldShowAProductWithRelatedOnes_andAnswer404ForHiddenOrUnknown() throws Exception {
        mockMvc.perform(get("/api/public/shop/products/t-hny-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Wild Honey"))
                .andExpect(jsonPath("$.details.unit").value("per 500g jar"))
                .andExpect(jsonPath("$.related[?(@.id=='t-hny-1')]").isEmpty())
                .andExpect(jsonPath("$.related[?(@.id=='t-hive-1')]").isNotEmpty());
        mockMvc.perform(get("/api/public/shop/products/t-jar-1")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/shop/products/nope")).andExpect(status().isNotFound());
    }

    // ==================================== placing orders ====================================

    @Test
    void shouldPlaceADeliveryOrder_pricedFromTheDatabase_andHoldTheStock() throws Exception {
        String json = orderJson(phone(), "DELIVERY", "t-hny-1", "2").replace("\"items\"", "\"unitPrice\":1,\"total\":1,\"items\"");
        place(json).andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderNumber").value(matchesPattern("SV-\\d{6}-[A-Z2-9]{4}")))
                .andExpect(jsonPath("$.status").value("NEW"))
                .andExpect(jsonPath("$.paymentMethod").value("CASH_ON_DELIVERY"))
                .andExpect(jsonPath("$.subtotal").value(1700))
                .andExpect(jsonPath("$.deliveryFee").value(150))
                .andExpect(jsonPath("$.total").value(1850))
                .andExpect(jsonPath("$.items[0].unitPrice").value(850));
        assertThat(stock(honey.getId(), false)).isEqualTo(8);
    }

    @Test
    void shouldGiveFreeDeliveryOverTheLimit_andNoFeeForPickup() throws Exception {
        place(orderJson(phone(), "DELIVERY", "t-sofa-1", "1")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.deliveryFee").value(0)).andExpect(jsonPath("$.total").value(45000));
        place(orderJson(phone(), "PICKUP", "t-hny-1", "1")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.deliveryFee").value(0)).andExpect(jsonPath("$.paymentMethod").value("PAY_AT_SHOP"))
                .andExpect(jsonPath("$.total").value(850));
    }

    @Test
    void shouldMergeTheSameProductOnTwoLines() throws Exception {
        place(orderJson(phone(), "PICKUP", "t-hny-1", "1", "t-hny-1", "2")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].quantity").value(3));
        assertThat(stock(honey.getId(), false)).isEqualTo(7);
    }

    @Test
    void shouldRefuseABadOrder_withAMessage() throws Exception {
        String p = phone();
        String good = orderJson(p, "DELIVERY", "t-hny-1", "1");
        for (String bad : List.of(
                good.replace("Hari Thapa", " "),
                good.replace(p, "12"),
                good.replace(",\"addressLine\":\"Ward 3, Tamghas\"", ""),
                orderJson(p, "DELIVERY"),
                orderJson(p, "DELIVERY", "t-hny-1", "0"),
                orderJson(p, "DELIVERY", "t-hny-1", "51"),
                orderJson(p, "DELIVERY", "no-such-product", "1"),
                orderJson(p, "DELIVERY", "t-jar-1", "1"),                       // hidden from the website
                good.replace("\"items\"", "\"website\":\"http://spam\",\"items\""),   // honeypot field
                good.replace("DELIVERY", "TELEPORT"),
                good.replace("\"items\"", "\"customerEmail\":\"nope\",\"items\""),
                "{}")) {
            place(bad).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").exists());
        }
        assertThat(stock(honey.getId(), false)).isEqualTo(10);
    }

    @Test
    void shouldRefuseAnOversell_andHoldNothingForAnyLine() throws Exception {
        place(orderJson(phone(), "PICKUP", "t-hny-1", "1", "t-hive-1", "1"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"))
                .andExpect(jsonPath("$.message").value(containsString("Empty Hive")));
        // (that no stock stays held for the lines before the refused one is proved in ShopOrderAtomicityIntegrationTest,
        //  which needs real per-request transactions; this class runs inside one test transaction.)
        place(orderJson(phone(), "PICKUP", "t-sofa-1", "4")).andExpect(status().isConflict());
        assertThat(stock(sofa.getId(), true)).isEqualTo(3);
    }

    @Test
    void shouldStopTheSixthOrderFromOnePhoneInAnHour() throws Exception {
        String p = phone();
        for (int i = 0; i < 5; i++) place(orderJson(p, "PICKUP", "t-hny-1", "1")).andExpect(status().isCreated());
        place(orderJson(p, "PICKUP", "t-hny-1", "1")).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
        assertThat(stock(honey.getId(), false)).isEqualTo(5);
    }

    // ==================================== tracking ====================================

    @Test
    void shouldLetACustomerTrackAnOrder_withTheNumberAndPhone_inAnyPhoneFormat() throws Exception {
        String p = phone();
        String number = placeOk(orderJson(p, "DELIVERY", "t-hny-1", "1"));
        String pretty = "+977 " + p.substring(0, 2) + "-" + p.substring(2, 6) + " " + p.substring(6);

        mockMvc.perform(get("/api/public/shop/orders/" + number).param("phone", pretty))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NEW"))
                .andExpect(jsonPath("$.items[0].name").value("Wild Honey"))
                .andExpect(jsonPath("$.customerPhone").value(not(containsString(p))))
                .andExpect(content().string(not(containsString("internalNotes"))));
        mockMvc.perform(get("/api/public/shop/orders/" + number.toLowerCase()).param("phone", p)).andExpect(status().isOk());
    }

    @Test
    void shouldAnswerTheSame404_forAWrongPhoneAndAWrongNumber() throws Exception {
        String number = placeOk(orderJson(phone(), "PICKUP", "t-hny-1", "1"));
        mockMvc.perform(get("/api/public/shop/orders/" + number).param("phone", "9800000001")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/shop/orders/" + number)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/shop/orders/SV-000000-ZZZZ").param("phone", "9800000001")).andExpect(status().isNotFound());
    }

    @Test
    void shouldStopGuessingAtOneOrderNumber() throws Exception {
        String number = placeOk(orderJson(phone(), "PICKUP", "t-hny-1", "1"));
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(get("/api/public/shop/orders/" + number).param("phone", "980000000" + (i % 10))).andExpect(status().isNotFound());
        }
        mockMvc.perform(get("/api/public/shop/orders/" + number).param("phone", "9800000009")).andExpect(status().isTooManyRequests());
    }

    // ==================================== staff side ====================================

    @Test
    void shouldRequireLoginForTheStaffOrderEndpoints() throws Exception {
        mockMvc.perform(get("/api/shop-orders")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/shop-orders/summary")).andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/shop-orders/" + UUID.randomUUID() + "/status").contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CONFIRMED\"}")).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldShowStaffTheFullOrder_andCountOrdersByStatus() throws Exception {
        String p = phone();
        String number = placeOk(orderJson(p, "DELIVERY", "t-hny-1", "1").replace("\"items\"", "\"customerEmail\":\"h@x.com\",\"notes\":\"Call first\",\"items\""));
        mockMvc.perform(get("/api/shop-orders?status=NEW&search=" + p).header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].orderNumber").value(number))
                .andExpect(jsonPath("$[0].customerPhone").value(p))
                .andExpect(jsonPath("$[0].customerEmail").value("h@x.com"))
                .andExpect(jsonPath("$[0].addressLine").value("Ward 3, Tamghas"))
                .andExpect(jsonPath("$[0].customerNotes").value("Call first"))
                .andExpect(jsonPath("$[0].items[0].productType").value("BEEKEEPING"));
        mockMvc.perform(get("/api/shop-orders/summary").header("Authorization", staff))
                .andExpect(jsonPath("$.NEW").value(greaterThanOrEqualTo(1))).andExpect(jsonPath("$.COMPLETED").exists());
        mockMvc.perform(get("/api/shop-orders?status=BOGUS").header("Authorization", staff)).andExpect(status().isBadRequest());
    }

    @Test
    void shouldMoveAnOrderThroughTheSteps_andRecordTheSaleOnceItIsCompleted() throws Exception {
        String number = placeOk(orderJson(phone(), "DELIVERY", "t-hny-1", "2", "t-sofa-1", "1"));
        String id = adminId(number);
        for (String step : List.of("CONFIRMED", "READY")) {
            mockMvc.perform(patch("/api/shop-orders/" + id + "/status").header("Authorization", staff)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + step + "\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.order.status").value(step));
        }
        assertThat(transactionRepository.findAll().stream().filter(t -> number.equals(t.getReferenceNumber()))).isEmpty();

        mockMvc.perform(patch("/api/shop-orders/" + id + "/status").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.order.status").value("COMPLETED"));

        List<Transaction> sales = transactionRepository.findAll().stream().filter(t -> number.equals(t.getReferenceNumber())).toList();
        assertThat(sales).hasSize(2);                                            // one per business, so each lands in its own books
        assertThat(sales).extracting(t -> t.getBusiness().getCode()).containsExactlyInAnyOrder("beekeeping", "furniture");
        assertThat(sales).allMatch(t -> t.getTransactionType() == Transaction.TransactionType.SALE);
        assertThat(sales.stream().map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo("46700");                                  // 1700 + 45000, free delivery over the limit
        // stock was taken when the customer ordered; completing does not take it again
        assertThat(stock(honey.getId(), false)).isEqualTo(8);
        assertThat(stock(sofa.getId(), true)).isEqualTo(2);
    }

    @Test
    void shouldBookTheDeliveryFeeOnce_whenSeveralBusinessesAreInOneOrder() throws Exception {
        String number = placeOk(orderJson(phone(), "DELIVERY", "t-hny-1", "1"));
        String id = adminId(number);
        for (String step : List.of("CONFIRMED", "COMPLETED")) {
            mockMvc.perform(patch("/api/shop-orders/" + id + "/status").header("Authorization", manager)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + step + "\"}")).andExpect(status().isOk());
        }
        List<Transaction> sales = transactionRepository.findAll().stream().filter(t -> number.equals(t.getReferenceNumber())).toList();
        assertThat(sales).hasSize(1);
        assertThat(sales.get(0).getAmount()).isEqualByComparingTo("1000");       // 850 + 150 delivery
    }

    @Test
    void shouldRefuseSkippingStepsOrChangingAFinishedOrder() throws Exception {
        String id = adminId(placeOk(orderJson(phone(), "PICKUP", "t-hny-1", "1")));
        mockMvc.perform(patch("/api/shop-orders/" + id + "/status").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(containsString("can't be changed")));
        mockMvc.perform(patch("/api/shop-orders/" + id + "/status").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"WHATEVER\"}")).andExpect(status().isBadRequest());
        for (String step : List.of("CONFIRMED", "COMPLETED")) {
            mockMvc.perform(patch("/api/shop-orders/" + id + "/status").header("Authorization", manager)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + step + "\"}")).andExpect(status().isOk());
        }
        mockMvc.perform(patch("/api/shop-orders/" + id + "/status").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\"}")).andExpect(status().isBadRequest());
        mockMvc.perform(patch("/api/shop-orders/" + id + "/status").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CANCELLED\"}")).andExpect(status().isBadRequest());
    }

    @Test
    void shouldLetOnlyManagersCancel_andGiveTheStockBack() throws Exception {
        String id = adminId(placeOk(orderJson(phone(), "PICKUP", "t-hny-1", "3")));
        assertThat(stock(honey.getId(), false)).isEqualTo(7);

        mockMvc.perform(patch("/api/shop-orders/" + id + "/status").header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CANCELLED\"}")).andExpect(status().isForbidden());
        assertThat(stock(honey.getId(), false)).isEqualTo(7);

        mockMvc.perform(patch("/api/shop-orders/" + id + "/status").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CANCELLED\",\"reason\":\"Customer changed mind\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.order.cancelReason").value("Customer changed mind"));
        assertThat(stock(honey.getId(), false)).isEqualTo(10);
    }

    @Test
    void shouldKeepInternalNotesPrivate() throws Exception {
        String p = phone();
        String number = placeOk(orderJson(p, "PICKUP", "t-hny-1", "1"));
        String id = adminId(number);
        mockMvc.perform(patch("/api/shop-orders/" + id + "/notes").header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content("{\"notes\":\"Regular customer\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.order.internalNotes").value("Regular customer"));
        mockMvc.perform(get("/api/public/shop/orders/" + number).param("phone", p))
                .andExpect(content().string(not(containsString("Regular customer"))));
    }

    @Test
    void shouldNotLetAnyoneClaimStockWasAlreadyHeld_onAnOrdinarySale() throws Exception {
        String body = "{\"businessCode\":\"beekeeping\",\"transactionType\":\"SALE\",\"amount\":850,\"customFields\":{"
                + "\"onlineOrderNumber\":\"SV-FAKE\",\"items\":[{\"itemId\":\"" + honey.getId() + "\",\"itemName\":\"Wild Honey\","
                + "\"quantity\":1,\"unitPrice\":850}]}}";
        mockMvc.perform(post("/api/transactions").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(containsString("reserved")));
        assertThat(stock(honey.getId(), false)).isEqualTo(10);
    }
}

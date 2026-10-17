package com.samjhana.controller;

import com.jayway.jsonpath.JsonPath;
import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.User;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.FurnitureItemRepository;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding P1B1-02: the checks the server makes on a sale and the sale each admin-app screen sends must agree. Every
 * test here posts the JSON that one screen builds (copied from the screen's own code), as the kind of person who uses
 * that screen, and expects the sale to be accepted. Rent payments and furniture orders used to be refused with
 * "Validation failed", so those two business units could not be booked through the app.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ScreenPayloadContractIntegrationTest {

    private static final String TODAY = LocalDate.now(ZoneId.of("Asia/Kathmandu")).toString();

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnits;
    @Autowired FurnitureItemRepository furniture;
    @Autowired BeekeepingProductRepository honey;

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
    void fixtures() {
        for (String code : List.of("petrol", "ev", "furniture", "beekeeping", "rental", "loan")) {
            if (businessUnits.findByCode(code).isEmpty()) {
                businessUnits.save(BusinessUnit.builder().code(code).name(code).nameNepali(code).build());
            }
        }
        staff = bearer("contract-staff", User.UserRole.STAFF);
        manager = bearer("contract-manager", User.UserRole.MANAGER);
        admin = bearer("contract-admin", User.UserRole.ADMIN);
    }

    private ResultActions send(String bearer, String json) throws Exception {
        return mockMvc.perform(post("/api/transactions").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    // ------------------------------------------------------------------ the screens that were refused

    /** RentalEntryPage.jsx: the rent payment form. */
    @Test
    void shouldAcceptARentPayment_asTheRentScreenSendsIt() throws Exception {
        String json = """
                {"businessCode":"rental","transactionType":"SALE","transactionDate":"%s","amount":12000,"notes":null,
                 "customFields":{"propertyId":"%s","propertyName":"Shop 2, Tamghas Bazaar","tenantName":"Hari Bahadur",
                   "monthlyRent":12000,"amountReceived":12000,"balance":0,"rentalMonth":"%s","paymentMethod":"CASH",
                   "paymentType":"FULL","recordedBy":"contract-staff"}}""".formatted(TODAY, UUID.randomUUID(), TODAY);

        send(staff, json).andExpect(status().isOk()).andExpect(jsonPath("$.id").exists());
    }

    @Test
    void shouldAcceptARentPayment_forAPropertyWithNoTenantNameOnRecord() throws Exception {
        String json = """
                {"businessCode":"rental","transactionType":"SALE","transactionDate":"%s","amount":5000,"notes":null,
                 "customFields":{"propertyId":"%s","propertyName":"Room 4","tenantName":null,"monthlyRent":5000,
                   "amountReceived":5000,"balance":0,"rentalMonth":"%s","paymentMethod":"CASH","paymentType":"FULL",
                   "recordedBy":"contract-staff"}}""".formatted(TODAY, UUID.randomUUID(), TODAY);

        send(staff, json).andExpect(status().isOk());
    }

    @Test
    void shouldStillRefuseARentPayment_thatNamesNoPropertyAtAll() throws Exception {
        String json = """
                {"businessCode":"rental","transactionType":"SALE","transactionDate":"%s","amount":5000,"notes":null,
                 "customFields":{"tenantName":"Hari","monthlyRent":5000,"amountReceived":5000,"paymentMethod":"CASH"}}"""
                .formatted(TODAY);

        send(staff, json).andExpect(status().isBadRequest());
    }

    @Test
    void shouldStillRefuseARentPayment_withNoMonthlyRent() throws Exception {
        String json = """
                {"businessCode":"rental","transactionType":"SALE","transactionDate":"%s","amount":5000,"notes":null,
                 "customFields":{"propertyId":"%s","propertyName":"Room 4","tenantName":"Hari","amountReceived":5000}}"""
                .formatted(TODAY, UUID.randomUUID());

        send(staff, json).andExpect(status().isBadRequest());
    }

    @Test
    void shouldStillAcceptARentPayment_inTheOlderRoomAndTenantShape() throws Exception {
        String json = """
                {"businessCode":"rental","transactionType":"SALE","transactionDate":"%s","amount":12000,"notes":null,
                 "customFields":{"roomNo":"A-101","tenantName":"Hari Bahadur","monthlyRent":12000}}""".formatted(TODAY);

        send(staff, json).andExpect(status().isOk());
    }

    /** FurnitureOrderPage.jsx: the order form with one line per item. */
    @Test
    void shouldAcceptAFurnitureOrder_asTheOrderScreenSendsIt() throws Exception {
        FurnitureItem sofa = furniture.save(FurnitureItem.builder().name("Teak Sofa").sku("CT-SOFA-" + UUID.randomUUID())
                .category(FurnitureItem.FurnitureCategory.SOFA).sellingPrice(new BigDecimal("45000")).stockQty(5).build());
        String json = """
                {"businessCode":"furniture","transactionType":"SALE","transactionDate":"%s","amount":90000,"notes":"",
                 "customFields":{"customerId":null,"customerName":"Hari Thapa",
                   "items":[{"itemId":"%s","itemName":"Teak Sofa","quantity":2,"unitPrice":45000,"total":90000}],
                   "paymentMethod":"CASH","deliveryDate":null,"deliveryAddress":null,"deliveryStatus":"PENDING"}}"""
                .formatted(TODAY, sofa.getId());

        send(staff, json).andExpect(status().isOk()).andExpect(jsonPath("$.id").exists());

        org.assertj.core.api.Assertions.assertThat(furniture.findById(sofa.getId()).orElseThrow().getStockQty()).isEqualTo(3);
    }

    @Test
    void shouldStillRefuseAFurnitureOrder_withNoLinesAndNoItemName() throws Exception {
        String json = """
                {"businessCode":"furniture","transactionType":"SALE","transactionDate":"%s","amount":1000,"notes":"",
                 "customFields":{"customerName":"Hari Thapa","items":[],"paymentMethod":"CASH"}}""".formatted(TODAY);

        send(staff, json).andExpect(status().isBadRequest());
    }

    @Test
    void shouldStillRefuseAFurnitureOrder_whoseLineHasNeitherAnItemNorAName() throws Exception {
        String json = """
                {"businessCode":"furniture","transactionType":"SALE","transactionDate":"%s","amount":1000,"notes":"",
                 "customFields":{"customerName":"Hari Thapa","items":[{"quantity":1,"unitPrice":1000}],"paymentMethod":"CASH"}}"""
                .formatted(TODAY);

        send(staff, json).andExpect(status().isBadRequest());
    }

    @Test
    void shouldStillRefuseAFurnitureOrder_whoseLineHasANegativePrice() throws Exception {
        String json = """
                {"businessCode":"furniture","transactionType":"SALE","transactionDate":"%s","amount":1000,"notes":"",
                 "customFields":{"customerName":"Hari Thapa","items":[{"itemName":"Chair","quantity":1,"unitPrice":-5}],"paymentMethod":"CASH"}}"""
                .formatted(TODAY);

        send(staff, json).andExpect(status().isBadRequest());
    }

    @Test
    void shouldStillAcceptAFurnitureSale_inTheSingleItemShape() throws Exception {
        String json = """
                {"businessCode":"furniture","transactionType":"SALE","transactionDate":"%s","amount":4500,"notes":"",
                 "customFields":{"itemName":"Sofa Set","quantity":3,"sellingPrice":1500}}""".formatted(TODAY);

        send(staff, json).andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ the screens that already worked: kept that way

    /** PetrolEntryPage.jsx: a pump sale. */
    @Test
    void shouldAcceptAPetrolSale_asThePumpScreenSendsIt() throws Exception {
        String json = """
                {"businessCode":"petrol","transactionType":"SALE","transactionDate":"%s","amount":1600,"notes":"",
                 "customFields":{"fuelType":"petrol","liters":10,"ratePerLiter":160,"paymentMethod":"CASH"}}""".formatted(TODAY);

        send(staff, json).andExpect(status().isOk());
    }

    /** FuelOrderPage.jsx: an order of fuel from the supplier. */
    @Test
    void shouldAcceptAFuelOrder_asTheFuelOrderScreenSendsIt() throws Exception {
        String json = """
                {"businessCode":"petrol","transactionType":"PURCHASE","transactionDate":"%s","amount":750000,
                 "notes":"Nepal Oil Corporation","customFields":{"fuelType":"petrol","liters":5000,"ratePerLiter":150,
                   "supplierName":"Nepal Oil Corporation","orderType":"FUEL_ORDER"}}""".formatted(TODAY);

        send(manager, json).andExpect(status().isOk());
    }

    /** EVManualEntryPage.jsx: a charge entered by hand, by percentage. */
    @Test
    void shouldAcceptAnEvEntry_asTheManualEntryScreenSendsIt() throws Exception {
        String json = """
                {"businessCode":"ev","transactionType":"SALE","transactionDate":"%s","amount":700,"notes":"",
                 "customFields":{"chargingMode":"PERCENTAGE","chargePointId":"%s","chargePointCode":"HD-D180-CC-01",
                   "chargerModel":"HD-D180-CC","vehicleId":"%s","vehicleName":"DFAC EV 32","batteryCapacityKw":53.58,
                   "startPercent":20,"endPercent":70,"ratePerPercent":14,"percentCharged":50,"estimatedKwh":26.79,
                   "paymentMethod":"CASH"}}""".formatted(TODAY, UUID.randomUUID(), UUID.randomUUID());

        send(staff, json).andExpect(status().isOk());
    }

    /** BeekeepingSalePage.jsx: a honey and hive sale with one line per product. */
    @Test
    void shouldAcceptAHoneySale_asTheBeekeepingScreenSendsIt() throws Exception {
        String unique = UUID.randomUUID().toString();
        BeekeepingProduct jar = honey.save(BeekeepingProduct.builder().name("Wild Honey").sku("CT-HNY-" + unique)
                .slug("ct-hny-" + unique).category(BeekeepingProduct.BeekeepingCategory.HONEY)
                .sellingPrice(new BigDecimal("850")).stockQty(10).showOnWebsite(true).build());
        String json = """
                {"businessCode":"beekeeping","transactionType":"SALE","transactionDate":"%s","amount":1700,"notes":"",
                 "customFields":{"customerName":"Walk-in customer","customerPhone":null,
                   "items":[{"itemId":"%s","itemName":"Wild Honey","quantity":2,"unitPrice":850,"total":1700}],
                   "paymentMethod":"CASH"}}""".formatted(TODAY, jar.getId());

        send(staff, json).andExpect(status().isOk());

        org.assertj.core.api.Assertions.assertThat(honey.findById(jar.getId()).orElseThrow().getStockQty()).isEqualTo(8);
    }

    /** LoanEntryPage.jsx: a new loan from the bank, then a payment to the bank for it. */
    @Test
    void shouldAcceptANewLoanAndAPaymentForIt_asTheLoanScreenSendsThem() throws Exception {
        String newLoan = """
                {"businessCode":"loan","transactionType":"EXPENSE","transactionDate":"%s","amount":500000,"notes":"",
                 "customFields":{"loanType":"NEW_LOAN","bankName":"Nabil Bank","loanAmount":500000,"interestRate":12.5}}"""
                .formatted(TODAY);
        String loanId = JsonPath.read(send(admin, newLoan).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.id");

        String payment = """
                {"businessCode":"loan","transactionType":"SALE","transactionDate":"%s","amount":10500,"notes":"",
                 "customFields":{"loanType":"PAYMENT","loanId":"%s","principalAmount":10000,"interestAmount":500,
                   "bankReference":"BR-2026-1016"}}""".formatted(TODAY, loanId);
        send(admin, payment).andExpect(status().isOk());
    }
}

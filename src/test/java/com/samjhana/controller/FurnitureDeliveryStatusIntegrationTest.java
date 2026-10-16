package com.samjhana.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import jakarta.persistence.EntityManager;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Finding P0-09: the delivery-status route took the id of any transaction from any signed-in user and wrote any text
 * into its extra details, leaving no record. Through the real route: only furniture orders change, only to one of the
 * three steps, and the change is recorded with who made it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FurnitureDeliveryStatusIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired BusinessUnitRepository businessUnitRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired EntityManager entityManager;
    @Autowired ObjectMapper objectMapper;

    private User staff;
    private String bearer;
    private BusinessUnit furniture;
    private BusinessUnit petrol;

    @BeforeEach
    void setUp() {
        staff = userRepository.findByUsername("delivery-staff").orElseGet(() -> userRepository.save(
                User.builder().username("delivery-staff").passwordHash(passwordEncoder.encode("x"))
                        .fullName("delivery-staff").fullNameNepali("delivery-staff").role(User.UserRole.STAFF).build()));
        bearer = "Bearer " + jwtUtil.generateToken(staff);
        furniture = businessUnitRepository.findByCode("furniture").orElseGet(() -> businessUnitRepository.save(
                BusinessUnit.builder().code("furniture").name("Furniture").nameNepali("फर्निचर").calculationStrategy("FurnitureStrategy").build()));
        petrol = businessUnitRepository.findByCode("petrol").orElseGet(() -> businessUnitRepository.save(
                BusinessUnit.builder().code("petrol").name("Petrol Pump").nameNepali("पेट्रोल पम्प").calculationStrategy("PetrolStrategy").build()));
    }

    private Transaction sale(BusinessUnit unit, String customFields) {
        return transactionRepository.save(Transaction.builder().business(unit).enteredBy(staff)
                .transactionType(Transaction.TransactionType.SALE).transactionDate(LocalDate.now()).amount(new BigDecimal("1700"))
                .status(Transaction.TransactionStatus.APPROVED).customFields(customFields).build());
    }

    private String change(UUID id, String body) throws Exception {
        return mockMvc.perform(patch("/api/furniture/orders/{id}/delivery-status", id).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString();
    }

    private List<AuditLog> auditRows(UUID id) {
        return auditLogRepository.findAll().stream().filter(a -> id.equals(a.getEntityId())).toList();
    }

    @Test
    void shouldChangeTheDeliveryStatusOfAFurnitureOrder_andRecordWhoDidIt() throws Exception {
        Transaction order = sale(furniture, "{\"customerName\":\"Ram\",\"deliveryStatus\":\"PENDING\"}");

        mockMvc.perform(patch("/api/furniture/orders/{id}/delivery-status", order.getId()).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"deliveryStatus\":\"DELIVERED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.deliveryStatus").value("DELIVERED"));

        entityManager.flush();
        entityManager.clear();
        JsonNode stored = objectMapper.readTree(transactionRepository.findById(order.getId()).orElseThrow().getCustomFields());
        assertThat(stored.get("deliveryStatus").asText()).isEqualTo("DELIVERED");
        assertThat(stored.get("customerName").asText()).isEqualTo("Ram");
        List<AuditLog> rows = auditRows(order.getId());
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getUser().getUsername()).isEqualTo("delivery-staff");
        assertThat(rows.get(0).getDescription()).isEqualTo("Delivery status changed from PENDING to DELIVERED");
    }

    @Test
    void shouldRefuseToChangeAPetrolSale_andLeaveItAsItWas() throws Exception {
        Transaction petrolSale = sale(petrol, "{\"fuelType\":\"petrol\",\"liters\":10}");

        mockMvc.perform(patch("/api/furniture/orders/{id}/delivery-status", petrolSale.getId()).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"deliveryStatus\":\"DELIVERED\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Order not found")));

        entityManager.flush();
        entityManager.clear();
        assertThat(transactionRepository.findById(petrolSale.getId()).orElseThrow().getCustomFields())
                .isEqualTo("{\"fuelType\":\"petrol\",\"liters\":10}");
        assertThat(auditRows(petrolSale.getId())).isEmpty();
    }

    @Test
    void shouldRefuseAStatusThatIsNotOneOfTheThree_andLeaveTheOrderAsItWas() throws Exception {
        Transaction order = sale(furniture, "{\"deliveryStatus\":\"PENDING\"}");

        mockMvc.perform(patch("/api/furniture/orders/{id}/delivery-status", order.getId()).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"deliveryStatus\":\"SHIPPED\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("PENDING, IN_PROGRESS or DELIVERED")));

        entityManager.flush();
        entityManager.clear();
        assertThat(transactionRepository.findById(order.getId()).orElseThrow().getCustomFields()).isEqualTo("{\"deliveryStatus\":\"PENDING\"}");
        assertThat(auditRows(order.getId())).isEmpty();
    }

    @Test
    void shouldRefuseAnUnknownOrder() throws Exception {
        mockMvc.perform(patch("/api/furniture/orders/{id}/delivery-status", UUID.randomUUID()).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"deliveryStatus\":\"DELIVERED\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldAnswer401_withoutALogin() throws Exception {
        mockMvc.perform(patch("/api/furniture/orders/{id}/delivery-status", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"deliveryStatus\":\"DELIVERED\"}"))
                .andExpect(status().isUnauthorized());
    }
}

package com.samjhana.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.FurnitureCustomer;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.FurnitureItem.FurnitureCategory;
import com.samjhana.entity.Transaction;
import com.samjhana.repository.FurnitureCustomerRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FurnitureServiceTest {

    @Mock FurnitureCustomerRepository customerRepository;
    @Mock FurnitureItemRepository itemRepository;
    @Mock TransactionRepository transactionRepository;

    private FurnitureService service;

    @BeforeEach
    void setUp() {
        service = new FurnitureService(customerRepository, itemRepository, transactionRepository, new ObjectMapper());
    }

    private FurnitureItem item(String name, String sellingPrice, int stockQty, int reorderLevel) {
        return FurnitureItem.builder()
                .id(UUID.randomUUID()).name(name).sku("SKU-" + name)
                .category(FurnitureCategory.SOFA)
                .sellingPrice(sellingPrice != null ? new BigDecimal(sellingPrice) : null)
                .stockQty(stockQty).reorderLevel(reorderLevel).isActive(true)
                .build();
    }

    private Transaction saleTransaction(LocalDate date, String amount, String customFieldsJson) {
        return Transaction.builder()
                .id(UUID.randomUUID())
                .transactionType(Transaction.TransactionType.SALE)
                .transactionDate(date)
                .amount(new BigDecimal(amount))
                .status(Transaction.TransactionStatus.APPROVED)
                .customFields(customFieldsJson)
                .build();
    }

    // ===================== DASHBOARD =====================

    @Test
    void shouldBuildDashboard_summarisingStockValueLowStockAndTodaySales() {
        FurnitureItem plentiful = item("Sofa", "50000", 10, 2);
        FurnitureItem low = item("Chair", "3000", 1, 2);
        when(itemRepository.findByIsActiveTrueOrderByNameAsc()).thenReturn(List.of(plentiful, low));

        Transaction todaySale = saleTransaction(LocalDate.now(), "50000", null);
        Transaction oldSale = saleTransaction(LocalDate.now().minusDays(5), "3000", "{\"deliveryStatus\":\"DELIVERED\"}");
        Transaction pendingDelivery = saleTransaction(LocalDate.now().minusDays(1), "1000", "{\"deliveryStatus\":\"PENDING\"}");
        when(transactionRepository.findByBusinessCodeOrderByTransactionDateDesc("furniture"))
                .thenReturn(List.of(todaySale, oldSale, pendingDelivery));

        Map<String, Object> dashboard = service.getDashboard(true);

        assertThat(dashboard.get("totalItems")).isEqualTo(2);
        assertThat((BigDecimal) dashboard.get("totalStockValue")).isEqualByComparingTo(new BigDecimal("503000"));
        assertThat(dashboard.get("lowStockCount")).isEqualTo(1);
        assertThat(dashboard.get("todaySalesCount")).isEqualTo(1);
        assertThat((BigDecimal) dashboard.get("todayRevenue")).isEqualByComparingTo(new BigDecimal("50000"));
        assertThat(dashboard.get("pendingDeliveries")).isEqualTo(1L);
    }

    // ===================== CUSTOMERS =====================

    @Test
    void shouldFilterCustomersByNameOrPhone_whenSearchProvided() {
        FurnitureCustomer match = FurnitureCustomer.builder().id(UUID.randomUUID()).name("Ram Sharma").phone("9800000000").isActive(true).build();
        FurnitureCustomer noMatch = FurnitureCustomer.builder().id(UUID.randomUUID()).name("Sita Rai").phone("9811111111").isActive(true).build();
        when(customerRepository.findByIsActiveTrueOrderByNameAsc()).thenReturn(List.of(match, noMatch));
        when(transactionRepository.findByBusinessCodeOrderByTransactionDateDesc("furniture")).thenReturn(List.of());

        List<Map<String, Object>> results = service.listCustomers("Ram");

        assertThat(results).hasSize(1);
        assertThat(results.get(0).get("name")).isEqualTo("Ram Sharma");
    }

    @Test
    void shouldAggregatePurchaseHistory_perCustomer() {
        FurnitureCustomer customer = FurnitureCustomer.builder().id(UUID.randomUUID()).name("Ram").isActive(true).build();
        when(customerRepository.findByIsActiveTrueOrderByNameAsc()).thenReturn(List.of(customer));
        String cf = "{\"customerId\":\"" + customer.getId() + "\"}";
        when(transactionRepository.findByBusinessCodeOrderByTransactionDateDesc("furniture"))
                .thenReturn(List.of(saleTransaction(LocalDate.now(), "5000", cf), saleTransaction(LocalDate.now(), "3000", cf)));

        Map<String, Object> result = service.listCustomers(null).get(0);

        assertThat(result.get("totalPurchases")).isEqualTo(2);
        assertThat((BigDecimal) result.get("totalAmount")).isEqualByComparingTo(new BigDecimal("8000"));
    }

    @Test
    void shouldCreateCustomer_whenNameProvided() {
        when(customerRepository.save(any())).thenAnswer(inv -> {
            FurnitureCustomer c = inv.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });
        Map<String, Object> result = service.createCustomer(Map.of("name", "  New Customer  "));
        assertThat(result.get("name")).isEqualTo("New Customer");
    }

    @Test
    void shouldRejectCustomerCreation_whenNameBlank() {
        assertThatThrownBy(() -> service.createCustomer(Map.of("name", "  ")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldUpdateOnlyProvidedCustomerFields() {
        UUID id = UUID.randomUUID();
        FurnitureCustomer existing = FurnitureCustomer.builder().id(id).name("Old Name").phone("111").isActive(true).build();
        when(customerRepository.findById(id)).thenReturn(java.util.Optional.of(existing));
        when(customerRepository.save(any())).then(returnsFirstArg());

        Map<String, Object> result = service.updateCustomer(id, Map.of("phone", "999"));

        assertThat(result.get("name")).isEqualTo("Old Name");
        assertThat(result.get("phone")).isEqualTo("999");
    }

    @Test
    void shouldThrow_whenUpdatingUnknownCustomer() {
        UUID id = UUID.randomUUID();
        when(customerRepository.findById(id)).thenReturn(java.util.Optional.empty());
        assertThatThrownBy(() -> service.updateCustomer(id, Map.of())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldSoftDeleteCustomer() {
        UUID id = UUID.randomUUID();
        FurnitureCustomer existing = FurnitureCustomer.builder().id(id).name("X").isActive(true).build();
        when(customerRepository.findById(id)).thenReturn(java.util.Optional.of(existing));
        when(customerRepository.save(any())).then(returnsFirstArg());

        service.deleteCustomer(id);

        assertThat(existing.getIsActive()).isFalse();
    }

    // ===================== INVENTORY =====================

    @Test
    void shouldFilterItemsByValidCategory() {
        FurnitureItem sofa = item("Sofa", "1000", 5, 1);
        when(itemRepository.findByCategoryAndIsActiveTrue(FurnitureCategory.SOFA)).thenReturn(List.of(sofa));

        assertThat(service.listItems("sofa", null, true)).hasSize(1);
    }

    @Test
    void shouldFallBackToAllItems_whenCategoryInvalid() {
        when(itemRepository.findByIsActiveTrueOrderByNameAsc()).thenReturn(List.of(item("X", "1", 1, 1)));
        assertThat(service.listItems("not-a-real-category", null, true)).hasSize(1);
    }

    @Test
    void shouldFilterItemsBySearch_matchingNameOrSku() {
        when(itemRepository.findByIsActiveTrueOrderByNameAsc()).thenReturn(List.of(item("Sofa", "1", 1, 1)));
        assertThat(service.listItems(null, "sofa", true)).hasSize(1);
        assertThat(service.listItems(null, "nonexistent", true)).isEmpty();
    }

    @Test
    void shouldGetItem_whenActive() {
        FurnitureItem active = item("Sofa", "1", 1, 1);
        when(itemRepository.findById(active.getId())).thenReturn(java.util.Optional.of(active));
        assertThat(service.getItem(active.getId(), true).get("name")).isEqualTo("Sofa");
    }

    @Test
    void shouldThrow_whenItemNotFoundOrInactive() {
        UUID id = UUID.randomUUID();
        when(itemRepository.findById(id)).thenReturn(java.util.Optional.empty());
        assertThatThrownBy(() -> service.getItem(id, true)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldCreateItem_generatingSkuAndDefaultingCategory_whenNotProvided() {
        when(itemRepository.save(any())).thenAnswer(inv -> {
            FurnitureItem i = inv.getArgument(0);
            i.setId(UUID.randomUUID());
            return i;
        });
        Map<String, Object> result = service.createItem(Map.of("name", "New Item"));
        assertThat(result.get("sku")).asString().startsWith("FRN-");
        assertThat(result.get("category")).isEqualTo("OTHER");
    }

    @Test
    void shouldCreateItem_parsingNumericStringPrices() {
        when(itemRepository.save(any())).thenAnswer(inv -> {
            FurnitureItem i = inv.getArgument(0);
            i.setId(UUID.randomUUID());
            return i;
        });
        Map<String, Object> result = service.createItem(Map.of(
                "name", "Item", "sku", "CUSTOM-1", "category", "bed", "purchasePrice", "1000", "sellingPrice", 1500));
        assertThat(result.get("purchasePrice")).isEqualTo(new BigDecimal("1000"));
        assertThat(result.get("category")).isEqualTo("BED");
    }

    @Test
    void shouldRejectItemCreation_whenNameMissing() {
        assertThatThrownBy(() -> service.createItem(Map.of())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldUpdateOnlyProvidedItemFields_andIgnoreInvalidCategory() {
        FurnitureItem existing = item("Old", "100", 5, 1);
        when(itemRepository.findById(existing.getId())).thenReturn(java.util.Optional.of(existing));
        when(itemRepository.save(any())).then(returnsFirstArg());

        Map<String, Object> result = service.updateItem(existing.getId(), Map.of("category", "not-real"));

        assertThat(result.get("category")).isEqualTo("SOFA"); // unchanged, invalid category silently ignored
    }

    @Test
    void shouldDeleteItem_softly() {
        FurnitureItem existing = item("X", "1", 1, 1);
        when(itemRepository.findById(existing.getId())).thenReturn(java.util.Optional.of(existing));
        when(itemRepository.save(any())).then(returnsFirstArg());
        service.deleteItem(existing.getId());
        assertThat(existing.getIsActive()).isFalse();
    }

    @Test
    void shouldAdjustStock_clampingAtZero() {
        FurnitureItem existing = item("X", "1", 5, 1);
        when(itemRepository.findById(existing.getId())).thenReturn(java.util.Optional.of(existing));
        when(itemRepository.save(any())).then(returnsFirstArg());

        assertThat(service.adjustStock(existing.getId(), -100).get("stockQty")).isEqualTo(0);
    }

    // ===================== ORDERS =====================

    @Test
    void shouldFilterOrdersByDeliveryStatusAndCustomerSearch() {
        Transaction pending = saleTransaction(LocalDate.now(), "100", "{\"deliveryStatus\":\"PENDING\",\"customerName\":\"Ram\"}");
        Transaction delivered = saleTransaction(LocalDate.now(), "200", "{\"deliveryStatus\":\"DELIVERED\",\"customerName\":\"Sita\"}");
        when(transactionRepository.findByBusinessCodeOrderByTransactionDateDesc("furniture"))
                .thenReturn(List.of(pending, delivered));

        assertThat(service.listOrders("PENDING", null)).hasSize(1);
        assertThat(service.listOrders(null, "ram")).hasSize(1);
        assertThat(service.listOrders("ALL", null)).hasSize(2);
    }

    @Test
    void shouldUpdateDeliveryStatus() {
        Transaction transaction = saleTransaction(LocalDate.now(), "100", null);
        when(transactionRepository.findById(transaction.getId())).thenReturn(java.util.Optional.of(transaction));
        when(transactionRepository.save(any())).then(returnsFirstArg());

        Map<String, Object> result = service.updateDeliveryStatus(transaction.getId(), "SHIPPED");

        assertThat(result.get("deliveryStatus")).isEqualTo("SHIPPED");
    }

    @Test
    void shouldRejectDeliveryStatusUpdate_whenStatusNull() {
        Transaction transaction = saleTransaction(LocalDate.now(), "100", null);
        when(transactionRepository.findById(transaction.getId())).thenReturn(java.util.Optional.of(transaction));
        assertThatThrownBy(() -> service.updateDeliveryStatus(transaction.getId(), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldThrow_whenUpdatingDeliveryStatusForUnknownOrder() {
        UUID id = UUID.randomUUID();
        when(transactionRepository.findById(id)).thenReturn(java.util.Optional.empty());
        assertThatThrownBy(() -> service.updateDeliveryStatus(id, "SHIPPED")).isInstanceOf(IllegalArgumentException.class);
    }
}

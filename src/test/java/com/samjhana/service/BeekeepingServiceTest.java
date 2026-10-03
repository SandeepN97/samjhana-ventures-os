package com.samjhana.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BeekeepingProduct.BeekeepingCategory;
import com.samjhana.entity.User;
import com.samjhana.exception.InsufficientStockException;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BeekeepingServiceTest {

    @Mock BeekeepingProductRepository productRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock MediaService mediaService;
    @Mock SlugService slugService;

    private BeekeepingService service;
    private final User admin = User.builder().username("admin").passwordHash("x").fullName("Admin").role(User.UserRole.ADMIN).build();

    @BeforeEach
    void setUp() {
        service = new BeekeepingService(productRepository, transactionRepository, auditLogRepository, new ObjectMapper(),
                mediaService, slugService);
    }

    private BeekeepingProduct product(String name, String selling, String purchase, int stock, int reorder) {
        return BeekeepingProduct.builder().id(UUID.randomUUID()).name(name).sku("SKU-" + name).slug("sku-" + name)
                .category(BeekeepingCategory.HONEY)
                .sellingPrice(selling == null ? null : new BigDecimal(selling))
                .purchasePrice(purchase == null ? null : new BigDecimal(purchase))
                .stockQty(stock).reorderLevel(reorder).showOnWebsite(true).build();
    }

    private void found(BeekeepingProduct p) {
        lenient().when(productRepository.findByIdAndDeletedAtIsNull(p.getId())).thenReturn(Optional.of(p));
    }

    // ---- stock status -----------------------------------------------------------------------------

    @Test
    void shouldReportOutOfStock_whenTheCountIsZero() {
        assertThat(BeekeepingService.stockStatus(0, 2)).isEqualTo(BeekeepingService.StockStatus.OUT_OF_STOCK);
    }

    @Test
    void shouldReportLowStock_whenAtOrBelowTheReorderLevel() {
        assertThat(BeekeepingService.stockStatus(2, 2)).isEqualTo(BeekeepingService.StockStatus.LOW_STOCK);
        assertThat(BeekeepingService.stockStatus(1, 2)).isEqualTo(BeekeepingService.StockStatus.LOW_STOCK);
    }

    @Test
    void shouldReportInStock_whenAboveTheReorderLevel() {
        assertThat(BeekeepingService.stockStatus(3, 2)).isEqualTo(BeekeepingService.StockStatus.IN_STOCK);
    }

    // ---- dashboard --------------------------------------------------------------------------------

    @Test
    void shouldCountLowStockAndValueStock_inTheDashboard() {
        BeekeepingProduct honey = product("Honey", "850", "500", 10, 2);
        BeekeepingProduct hive = product("Hive", "4500", null, 1, 2);
        when(productRepository.findByDeletedAtIsNullOrderByNameAsc()).thenReturn(List.of(honey, hive));
        when(transactionRepository.findByBusinessCodeOrderByTransactionDateDesc("beekeeping")).thenReturn(List.of());

        Map<String, Object> dashboard = service.getDashboard(false);

        assertThat(dashboard.get("totalItems")).isEqualTo(2);
        assertThat(dashboard.get("lowStockCount")).isEqualTo(1);
        assertThat((BigDecimal) dashboard.get("totalStockValue")).isEqualByComparingTo("13000");
        assertThat(dashboard.get("todaySalesCount")).isEqualTo(0);
    }

    // ---- products ---------------------------------------------------------------------------------

    @Test
    void shouldHideTheCostPrice_whenTheViewerMayNotSeeIt() {
        BeekeepingProduct honey = product("Honey", "850", "500", 10, 2);
        assertThat(service.productToMap(honey, false)).doesNotContainKey("purchasePrice");
        assertThat(service.productToMap(honey, true)).containsEntry("purchasePrice", new BigDecimal("500"));
    }

    @Test
    void shouldCreateAProductWithASlug_andLogIt() {
        when(productRepository.existsBySku("HNY-9")).thenReturn(false);
        when(slugService.uniqueSlug("HNY-9")).thenReturn("hny-9");
        when(productRepository.save(any(BeekeepingProduct.class))).thenAnswer(inv -> {
            BeekeepingProduct p = inv.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });

        Map<String, Object> created = service.createItem(Map.of("name", " Wild Honey ", "sku", "HNY-9",
                "category", "honey", "sellingPrice", 850, "stockQty", 12), admin);

        assertThat(created).containsEntry("name", "Wild Honey").containsEntry("stockQty", 12).containsEntry("category", "HONEY");
        ArgumentCaptor<BeekeepingProduct> saved = ArgumentCaptor.forClass(BeekeepingProduct.class);
        verify(productRepository).save(saved.capture());
        assertThat(saved.getValue().getSlug()).isEqualTo("hny-9");
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    void shouldRejectAProductWithoutAName() {
        assertThatThrownBy(() -> service.createItem(Map.of("name", "  "), admin))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("name");
        verify(productRepository, never()).save(any());
    }

    @Test
    void shouldRejectNegativePricesAndStock() {
        assertThatThrownBy(() -> service.createItem(Map.of("name", "A", "sellingPrice", -1), admin))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("negative");
        assertThatThrownBy(() -> service.createItem(Map.of("name", "A", "stockQty", -3), admin))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("negative");
    }

    @Test
    void shouldRejectADuplicateSkuAndAnUnknownCategory() {
        when(productRepository.existsBySku("DUP")).thenReturn(true);
        assertThatThrownBy(() -> service.createItem(Map.of("name", "A", "sku", "DUP"), admin))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("SKU");
        assertThatThrownBy(() -> service.createItem(Map.of("name", "A", "category", "BOATS"), admin))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("category");
    }

    @Test
    void shouldUpdateOnlyTheFieldsSent_andLogTheChange() {
        BeekeepingProduct honey = product("Honey", "850", "500", 10, 2);
        found(honey);
        when(productRepository.save(honey)).thenReturn(honey);

        service.updateItem(honey.getId(), Map.of("sellingPrice", 900), admin);

        assertThat(honey.getSellingPrice()).isEqualByComparingTo("900");
        assertThat(honey.getStockQty()).isEqualTo(10);
        ArgumentCaptor<AuditLog> log = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(log.capture());
        assertThat(log.getValue().getOldValues()).contains("850");
        assertThat(log.getValue().getNewValues()).contains("900");
    }

    @Test
    void shouldSoftDeleteAProduct_keepingItsRowAndHidingItFromTheWebsite() {
        BeekeepingProduct honey = product("Honey", "850", "500", 10, 2);
        found(honey);

        service.deleteItem(honey.getId(), admin);

        assertThat(honey.getDeletedAt()).isNotNull();
        assertThat(honey.getShowOnWebsite()).isFalse();
        verify(productRepository, never()).delete(any());
        verify(productRepository, never()).deleteById(any());
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    void shouldFail_whenTheProductDoesNotExist() {
        assertThatThrownBy(() -> service.getItem(UUID.randomUUID(), true))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not found");
    }

    // ---- manual stock adjustment ------------------------------------------------------------------

    @Test
    void shouldAddStockWithAGuardedUpdate_andLogIt() {
        BeekeepingProduct honey = product("Honey", "850", "500", 10, 2);
        found(honey);
        when(productRepository.addStock(honey.getId(), 5)).thenReturn(1);

        service.adjustStock(honey.getId(), 5, admin);

        verify(productRepository).addStock(honey.getId(), 5);
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    void shouldRefuseToTakeMoreThanTheShopHas_whenAdjustingStockDown() {
        BeekeepingProduct honey = product("Honey", "850", "500", 3, 2);
        found(honey);
        when(productRepository.removeStock(honey.getId(), 5)).thenReturn(0);

        assertThatThrownBy(() -> service.adjustStock(honey.getId(), -5, admin))
                .isInstanceOf(InsufficientStockException.class);
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void shouldDoNothing_whenTheAdjustmentIsZero() {
        BeekeepingProduct honey = product("Honey", "850", "500", 3, 2);
        found(honey);
        service.adjustStock(honey.getId(), 0, admin);
        verify(productRepository, never()).addStock(any(), anyInt());
        verify(productRepository, never()).removeStock(any(), anyInt());
    }

    // ---- sales ------------------------------------------------------------------------------------

    private Map<String, Object> sale(BeekeepingProduct p, Object qty) {
        return Map.of("items", List.of(Map.of("itemId", p.getId().toString(), "quantity", qty, "unitPrice", 850)));
    }

    @Test
    void shouldTakeStockOff_whenASaleIsRecorded() {
        BeekeepingProduct honey = product("Honey", "850", "500", 10, 2);
        found(honey);
        when(productRepository.removeStock(honey.getId(), 3)).thenReturn(1);

        service.applyStock(sale(honey, 3), "SALE");

        verify(productRepository).removeStock(honey.getId(), 3);
    }

    @Test
    void shouldRefuseTheSale_whenTheShopCannotCoverIt() {
        BeekeepingProduct honey = product("Honey", "850", "500", 1, 2);
        found(honey);
        when(productRepository.removeStock(honey.getId(), 3)).thenReturn(0);

        assertThatThrownBy(() -> service.applyStock(sale(honey, 3), "SALE"))
                .isInstanceOf(InsufficientStockException.class).hasMessageContaining("Honey");
    }

    @Test
    void shouldAddStockBack_whenAPurchaseIsRecorded() {
        BeekeepingProduct honey = product("Honey", "850", "500", 1, 2);
        found(honey);
        when(productRepository.addStock(honey.getId(), 20)).thenReturn(1);

        service.applyStock(sale(honey, 20), "PURCHASE");

        verify(productRepository).addStock(honey.getId(), 20);
    }

    @Test
    void shouldLeaveStockAlone_forOtherTransactionTypes() {
        BeekeepingProduct honey = product("Honey", "850", "500", 5, 2);
        service.applyStock(sale(honey, 2), "EXPENSE");
        verifyNoInteractions(productRepository);
    }

    @Test
    void shouldRejectAnUnknownProductOrBadQuantity_onASaleLine() {
        BeekeepingProduct honey = product("Honey", "850", "500", 5, 2);
        found(honey);
        assertThatThrownBy(() -> service.applyStock(Map.of("items", List.of(Map.of("itemId", "nope", "quantity", 1))), "SALE"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.applyStock(Map.of("items", List.of(Map.of("itemId", UUID.randomUUID().toString(), "quantity", 1))), "SALE"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not found");
        assertThatThrownBy(() -> service.applyStock(sale(honey, 0), "SALE"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Quantity");
    }

    // ---- cost -------------------------------------------------------------------------------------

    @Test
    void shouldWorkOutTheCostOfASale_fromTheProductCostPrices() {
        BeekeepingProduct honey = product("Honey", "850", "500", 10, 2);
        found(honey);
        assertThat(service.costOfLines(sale(honey, 3))).hasValueSatisfying(c -> assertThat(c).isEqualByComparingTo("1500"));
    }

    @Test
    void shouldReturnNoCost_whenAnyProductHasNoCostPriceYet() {
        BeekeepingProduct honey = product("Honey", "850", null, 10, 2);
        found(honey);
        assertThat(service.costOfLines(sale(honey, 3))).isEmpty();
    }
}

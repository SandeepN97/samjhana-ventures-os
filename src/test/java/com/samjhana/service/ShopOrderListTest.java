package com.samjhana.service;

import com.samjhana.entity.ShopOrder;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.ShopOrderRepository;
import com.samjhana.security.RequestThrottle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Finding K-03: the staff list of online orders asks the database for the newest 300 only (of one status, when
 * given), lets the database do the searching, and takes the characters LIKE treats as wildcards as plain text.
 */
@ExtendWith(MockitoExtension.class)
class ShopOrderListTest {

    @Mock ShopOrderRepository orderRepository;
    @Mock ShopCatalogService catalogService;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock BeekeepingProductRepository beekeepingProductRepository;
    @Mock SiteContentService siteContentService;
    @Mock TransactionService transactionService;
    @Mock AuditLogRepository auditLogRepository;
    @Mock RequestThrottle throttle;
    @InjectMocks ShopOrderService service;

    private static ShopOrder order(String number) {
        ShopOrder o = new ShopOrder();
        o.setId(UUID.randomUUID());
        o.setOrderNumber(number);
        o.setCustomerName("Hari Thapa");
        o.setCustomerPhone("9801234567");
        o.setFulfilment(ShopOrder.Fulfilment.PICKUP);
        o.setPaymentMethod(ShopOrder.PaymentMethod.PAY_AT_SHOP);
        o.setSubtotal(new BigDecimal("100"));
        o.setTotal(new BigDecimal("100"));
        return o;
    }

    @Test
    void shouldAskForOnlyTheNewest300_whenListingEverything() {
        when(orderRepository.findAllByOrderByCreatedAtDesc(any(Pageable.class))).thenReturn(List.of(order("SV-1")));

        List<Map<String, Object>> shown = service.list("ALL", null);

        assertThat(shown).hasSize(1);
        assertThat(shown.get(0)).containsEntry("orderNumber", "SV-1");
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(orderRepository).findAllByOrderByCreatedAtDesc(page.capture());
        assertThat(page.getValue().getPageSize()).isEqualTo(300).isEqualTo(ShopOrderService.LIST_LIMIT);
        assertThat(page.getValue().getPageNumber()).isZero();
    }

    @Test
    void shouldAskForOneStatus_whenAStatusIsGiven_inAnyCase() {
        when(orderRepository.findByStatusOrderByCreatedAtDesc(eq(ShopOrder.Status.COMPLETED), any(Pageable.class)))
                .thenReturn(List.of(order("SV-2")));

        assertThat(service.list("completed", null)).hasSize(1);

        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(orderRepository).findByStatusOrderByCreatedAtDesc(eq(ShopOrder.Status.COMPLETED), page.capture());
        assertThat(page.getValue().getPageSize()).isEqualTo(300);
    }

    @Test
    void shouldTreatBlankAndAllAsNoStatus_andBlankSearchAsNoSearch() {
        when(orderRepository.findAllByOrderByCreatedAtDesc(any(Pageable.class))).thenReturn(List.of());

        assertThat(service.list(null, null)).isEmpty();
        assertThat(service.list("  ", "   ")).isEmpty();
        assertThat(service.list("all", "")).isEmpty();

        verify(orderRepository, never()).search(any(), any());
        verify(orderRepository, never()).searchByStatus(any(), any(), any());
    }

    @Test
    void shouldRefuseAnUnknownStatus_withoutTouchingTheDatabase() {
        assertThatThrownBy(() -> service.list("BOGUS", null))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Unknown status: BOGUS");
        verifyNoInteractions(orderRepository);
    }

    @Test
    void shouldLetTheDatabaseSearch_withALowerCaseEscapedPattern() {
        when(orderRepository.search(eq("%ha!_ri!%%"), any(Pageable.class))).thenReturn(List.of(order("SV-3")));

        assertThat(service.list("ALL", "  Ha_ri% ")).hasSize(1);

        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(orderRepository).search(eq("%ha!_ri!%%"), page.capture());
        assertThat(page.getValue().getPageSize()).isEqualTo(300);
        verify(orderRepository, never()).findAllByOrderByCreatedAtDesc(any());
    }

    @Test
    void shouldKeepTheStatus_whenSearchingWithOne() {
        when(orderRepository.searchByStatus(eq(ShopOrder.Status.NEW), eq("%zed%"), any(Pageable.class))).thenReturn(List.of());

        assertThat(service.list("NEW", "ZED")).isEmpty();

        verify(orderRepository).searchByStatus(eq(ShopOrder.Status.NEW), eq("%zed%"), any(Pageable.class));
        verify(orderRepository, never()).search(any(), any());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "hari|%hari%",
            "100%|%100!%%",
            "a_b|%a!_b%",
            "wow!|%wow!!%",
            "!%_|%!!!%!_%",
            "sv-261003-ab2c|%sv-261003-ab2c%",
    })
    void shouldBuildALikePattern_thatTakesWildcardsAsPlainText(String text, String expected) {
        assertThat(ShopOrderService.likePattern(text)).isEqualTo(expected);
    }
}

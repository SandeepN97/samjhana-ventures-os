package com.samjhana.service;

import com.samjhana.exception.TooManyRequestsException;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.ShopOrderRepository;
import com.samjhana.security.RequestThrottle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Finding P0-16 at the two public callers of {@link RequestThrottle}: what a stranger types must not be able to
 * create throttle entries. The throttle is a mock that refuses everything, so each test sees exactly which keys
 * the service asks about, and in what order.
 */
@ExtendWith(MockitoExtension.class)
class ShopOrderServiceThrottleTest {

    @Mock ShopOrderRepository orderRepository;
    @Mock ShopCatalogService catalogService;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock BeekeepingProductRepository beekeepingProductRepository;
    @Mock SiteContentService siteContentService;
    @Mock TransactionService transactionService;
    @Mock AuditLogRepository auditLogRepository;
    @Mock RequestThrottle throttle;
    @InjectMocks ShopOrderService service;

    @Test
    void shouldAnswerNotFoundWithoutTouchingTheThrottle_whenTheOrderNumberCouldNeverBeOurs() {
        String[] notOurs = {null, "", "   ", "SV-12", "SV-26100X-ABCD", "SV-261003-ABC", "SV-261003-ABCDE",
                "SV-261003-AB C", "../../etc/passwd", "X".repeat(4000)};
        for (String number : notOurs) {
            assertThat(service.track(number, "9801234567")).as("number %s", number == null ? "null" : number.length() + " chars").isEmpty();
        }
        verifyNoInteractions(throttle, orderRepository);
    }

    @Test
    void shouldAskAboutNoPerNumberKey_whenTheGlobalTrackingAllowanceIsUsedUp() {
        assertThatThrownBy(() -> service.track("SV-261003-AB2C", "9801234567")).isInstanceOf(TooManyRequestsException.class);
        verify(throttle).tryAcquire(eq("track:all"), anyInt(), any(Duration.class));
        verify(throttle, never()).tryAcquire(startsWith("track:SV-"), anyInt(), any(Duration.class));
    }

    @Test
    void shouldAskAboutNoPerPhoneKey_whenTheGlobalOrderAllowanceIsUsedUp() {
        ShopOrderService.PlaceOrderRequest request = new ShopOrderService.PlaceOrderRequest("Hari Thapa", "9801234567",
                null, "PICKUP", null, null, null, null, List.of(new ShopOrderService.Item("t-hny-1", 1)), null);
        assertThatThrownBy(() -> service.place(request)).isInstanceOf(TooManyRequestsException.class);
        verify(throttle).tryAcquire(eq("order:all"), anyInt(), any(Duration.class));
        verify(throttle, never()).tryAcquire(startsWith("order:phone:"), anyInt(), any(Duration.class));
    }
}

package com.samjhana.service;

import com.samjhana.exception.TooManyRequestsException;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.ShopOrderRepository;
import com.samjhana.security.RequestThrottle;
import com.samjhana.service.ShopOrderService.Item;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Findings P0-01 and P0-12: the cart is checked completely, entry by entry, before anything else happens. A
 * quantity that is out of range is refused before quantities are added up (so the sum can never wrap round to a
 * negative number), and a cart that is empty or broken never uses up any of the order allowance.
 */
@ExtendWith(MockitoExtension.class)
class ShopOrderCartValidationTest {

    @Mock ShopOrderRepository orderRepository;
    @Mock ShopCatalogService catalogService;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock BeekeepingProductRepository beekeepingProductRepository;
    @Mock SiteContentService siteContentService;
    @Mock TransactionService transactionService;
    @Mock AuditLogRepository auditLogRepository;
    @Mock RequestThrottle throttle;
    @InjectMocks ShopOrderService service;

    private static Item item(String slug, Integer quantity) {
        return new Item(slug, quantity);
    }

    private ShopOrderService.PlaceOrderRequest orderOf(List<Item> items) {
        return new ShopOrderService.PlaceOrderRequest("Hari Thapa", "9801234567", null, "PICKUP",
                null, null, null, null, items, null);
    }

    private static List<Item> rows(int count, int distinctSlugs) {
        List<Item> rows = new ArrayList<>();
        for (int i = 0; i < count; i++) rows.add(item("product-" + (i % distinctSlugs), 1));
        return rows;
    }

    static Stream<org.junit.jupiter.params.provider.Arguments> brokenCarts() {
        return Stream.of(
                arguments(null, "no items at all"),
                arguments(List.<Item>of(), "an empty cart"),
                arguments(Arrays.asList((Item) null), "an empty entry"),
                arguments(List.of(item("  ", 1)), "a blank product"),
                arguments(List.of(item("t-hny-1", null)), "no quantity"),
                arguments(List.of(item("t-hny-1", 0)), "quantity zero"),
                arguments(List.of(item("t-hny-1", -1)), "a negative quantity"),
                arguments(List.of(item("t-hny-1", 51)), "one more than allowed for one product"),
                arguments(List.of(item("t-hny-1", Integer.MAX_VALUE)), "the largest possible quantity"),
                arguments(List.of(item("t-hny-1", 50), item("t-hny-1", 1)), "the same product adding up past the limit"),
                arguments(rows(31, 31), "more different products than allowed"),
                arguments(rows(101, 3), "more cart entries than anyone needs, though few products")
        );
    }

    @ParameterizedTest(name = "{1}")
    @MethodSource("brokenCarts")
    void shouldRefuseTheCart_andTouchNothingElse_whenTheCartIsBroken(List<Item> items, String why) {
        assertThatThrownBy(() -> service.place(orderOf(items))).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(throttle, catalogService, furnitureItemRepository, beekeepingProductRepository, orderRepository);
    }

    @Test
    void shouldRefuseTwoLinesOfOneProduct_whenTheirQuantitiesWouldAddUpPastTheLargestNumber() {
        // the throttle says yes, so a cart that is not refused by its own checks would get further
        lenient().when(throttle.tryAcquire(any(), anyInt(), any(Duration.class))).thenReturn(true);
        assertThatThrownBy(() -> service.place(orderOf(List.of(
                item("t-hny-1", Integer.MAX_VALUE), item("t-hny-1", Integer.MAX_VALUE)))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("more than 50");
    }

    @Test
    void shouldLetACartThroughToTheThrottle_whenTheSameProductAddsUpToExactlyTheLimit() {
        // the throttle mock refuses everything, which shows the cart itself was accepted
        assertThatThrownBy(() -> service.place(orderOf(List.of(item("t-hny-1", 25), item("t-hny-1", 25)))))
                .isInstanceOf(TooManyRequestsException.class);
    }
}

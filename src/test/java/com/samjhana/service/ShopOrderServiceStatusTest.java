package com.samjhana.service;

import com.samjhana.entity.AuditLog;
import com.samjhana.entity.ShopOrder;
import com.samjhana.entity.ShopOrder.Status;
import com.samjhana.entity.ShopOrderLine;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.ShopOrderRepository;
import com.samjhana.security.RequestThrottle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Finding P1a-05: the status of an online order is changed with one guarded statement that only works while the order
 * is still in the status the request saw, and the work that goes with the change (the sale, the held stock) is done
 * only by the request that made the change.
 */
@ExtendWith(MockitoExtension.class)
class ShopOrderServiceStatusTest {

    @Mock ShopOrderRepository orderRepository;
    @Mock ShopCatalogService catalogService;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock BeekeepingProductRepository beekeepingProductRepository;
    @Mock SiteContentService siteContentService;
    @Mock TransactionService transactionService;
    @Mock AuditLogRepository auditLogRepository;
    @Mock RequestThrottle throttle;
    @InjectMocks ShopOrderService service;

    private final UUID id = UUID.randomUUID();
    private final UUID sofa = UUID.randomUUID();
    private final User staff = User.builder().id(UUID.randomUUID()).username("staff").passwordHash("x").fullName("Staff")
            .role(User.UserRole.STAFF).build();
    private final User manager = User.builder().id(UUID.randomUUID()).username("manager").passwordHash("x").fullName("Manager")
            .role(User.UserRole.MANAGER).build();

    private ShopOrder order(Status status) {
        ShopOrder order = new ShopOrder();
        order.setId(id);
        order.setOrderNumber("SV-261016-AB2C");
        order.setStatus(status);
        order.setCustomerName("Hari Thapa");
        order.setCustomerPhone("9801234567");
        order.setFulfilment(ShopOrder.Fulfilment.PICKUP);
        order.setPaymentMethod(ShopOrder.PaymentMethod.PAY_AT_SHOP);
        order.setSubtotal(new BigDecimal("90000"));
        order.setTotal(new BigDecimal("90000"));
        ShopOrderLine line = new ShopOrderLine();
        line.setProductType(ShopCatalogService.FURNITURE);
        line.setProductId(sofa);
        line.setProductSlug("teak-sofa");
        line.setProductName("Teak Sofa");
        line.setQuantity(2);
        line.setUnitPrice(new BigDecimal("45000"));
        line.setLineTotal(new BigDecimal("90000"));
        order.addLine(line);
        return order;
    }

    private void thisRequestMovesTheOrder(Status before, Status after) {
        when(orderRepository.findById(id)).thenReturn(Optional.of(order(before)), Optional.of(order(after)));
        when(orderRepository.moveStatus(eq(id), eq(before), eq(after), anyString(), any(), any(), any())).thenReturn(1);
    }

    // ------------------------------------------------------------------ another request got there first

    @Test
    void shouldDoNothingElse_whenAnotherRequestAlreadyCompletedTheOrder() {
        when(orderRepository.findById(id)).thenReturn(Optional.of(order(Status.CONFIRMED)), Optional.of(order(Status.COMPLETED)));
        when(orderRepository.moveStatus(eq(id), eq(Status.CONFIRMED), eq(Status.COMPLETED), anyString(), isNull(), any(), any()))
                .thenReturn(0);

        assertThatThrownBy(() -> service.updateStatus(id, "COMPLETED", null, staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("An order that is completed can't be changed to completed");

        verifyNoInteractions(transactionService, furnitureItemRepository, beekeepingProductRepository, auditLogRepository);
    }

    @Test
    void shouldNotGiveTheStockBack_whenAnotherRequestAlreadyCancelledTheOrder() {
        when(orderRepository.findById(id)).thenReturn(Optional.of(order(Status.READY)), Optional.of(order(Status.CANCELLED)));
        when(orderRepository.moveStatus(eq(id), eq(Status.READY), eq(Status.CANCELLED), anyString(), any(), isNull(), any()))
                .thenReturn(0);

        assertThatThrownBy(() -> service.updateStatus(id, "CANCELLED", "again", manager))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("An order that is cancelled can't be changed to cancelled");

        verifyNoInteractions(furnitureItemRepository, beekeepingProductRepository, auditLogRepository);
    }

    @Test
    void shouldAskForAReload_whenTheOrderMovedOnToAStatusFromWhichTheChangeIsStillAllowed() {
        when(orderRepository.findById(id)).thenReturn(Optional.of(order(Status.CONFIRMED)), Optional.of(order(Status.READY)));
        when(orderRepository.moveStatus(eq(id), eq(Status.CONFIRMED), eq(Status.COMPLETED), anyString(), isNull(), any(), any()))
                .thenReturn(0);

        assertThatThrownBy(() -> service.updateStatus(id, "COMPLETED", null, staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("just changed by someone else");

        verifyNoInteractions(transactionService, auditLogRepository);
    }

    // ------------------------------------------------------------------ the request that moves the order

    @Test
    void shouldMoveTheOrderBeforeBookingTheSale() {
        thisRequestMovesTheOrder(Status.CONFIRMED, Status.COMPLETED);

        service.updateStatus(id, "COMPLETED", null, staff);

        InOrder inOrder = inOrder(orderRepository, transactionService, auditLogRepository);
        inOrder.verify(orderRepository).moveStatus(eq(id), eq(Status.CONFIRMED), eq(Status.COMPLETED), eq("staff"), isNull(), any(), any());
        inOrder.verify(transactionService).createForOnlineOrder(any(), eq(staff), eq("SV-261016-AB2C"));
        inOrder.verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    void shouldMoveTheOrderBeforeGivingTheStockBack_andGiveBackEachLine() {
        thisRequestMovesTheOrder(Status.READY, Status.CANCELLED);

        service.updateStatus(id, "CANCELLED", "Customer changed their mind", manager);

        InOrder inOrder = inOrder(orderRepository, furnitureItemRepository);
        inOrder.verify(orderRepository).moveStatus(eq(id), eq(Status.READY), eq(Status.CANCELLED), eq("manager"),
                eq("Customer changed their mind"), isNull(), any());
        inOrder.verify(furnitureItemRepository).addStock(sofa, 2);
        verify(transactionService, never()).createForOnlineOrder(any(), any(), anyString());
    }

    @Test
    void shouldGiveACompletionTimeAndNoReason_whenTheOrderIsCompleted() {
        thisRequestMovesTheOrder(Status.READY, Status.COMPLETED);
        LocalDateTime start = LocalDateTime.now();

        service.updateStatus(id, "COMPLETED", "ignored", staff);

        ArgumentCaptor<LocalDateTime> completedAt = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(orderRepository).moveStatus(eq(id), eq(Status.READY), eq(Status.COMPLETED), eq("staff"), isNull(),
                completedAt.capture(), any());
        assertThat(completedAt.getValue()).isAfterOrEqualTo(start).isBeforeOrEqualTo(LocalDateTime.now());
    }

    @Test
    void shouldGiveNoCompletionTimeAndNoReason_whenTheOrderIsOnlyConfirmed() {
        thisRequestMovesTheOrder(Status.NEW, Status.CONFIRMED);

        service.updateStatus(id, "confirmed", "whatever", staff);

        verify(orderRepository).moveStatus(eq(id), eq(Status.NEW), eq(Status.CONFIRMED), eq("staff"), isNull(), isNull(), any());
        verifyNoInteractions(furnitureItemRepository, transactionService);
    }

    @Test
    void shouldAnswerWithTheOrderAsItIsAfterTheMove() {
        thisRequestMovesTheOrder(Status.NEW, Status.CONFIRMED);

        Map<String, Object> answer = service.updateStatus(id, "CONFIRMED", null, staff);

        assertThat(answer.get("status")).isEqualTo("CONFIRMED");
    }

    @Test
    void shouldRecordTheChangeInTheAuditLog() {
        thisRequestMovesTheOrder(Status.NEW, Status.CONFIRMED);

        service.updateStatus(id, "CONFIRMED", null, staff);

        ArgumentCaptor<AuditLog> entry = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(entry.capture());
        assertThat(entry.getValue().getDescription()).isEqualTo("Online order SV-261016-AB2C: NEW to CONFIRMED");
    }

    // ------------------------------------------------------------------ refused before anything is touched

    @Test
    void shouldRefuseAMoveThatIsNotAllowed_withoutTouchingTheOrder() {
        when(orderRepository.findById(id)).thenReturn(Optional.of(order(Status.COMPLETED)));

        assertThatThrownBy(() -> service.updateStatus(id, "CANCELLED", "x", manager))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("An order that is completed can't be changed to cancelled");

        verify(orderRepository, never()).moveStatus(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void shouldRefuseAStaffMemberCancelling_withoutTouchingTheOrder() {
        when(orderRepository.findById(id)).thenReturn(Optional.of(order(Status.CONFIRMED)));

        assertThatThrownBy(() -> service.updateStatus(id, "CANCELLED", "x", staff)).isInstanceOf(AccessDeniedException.class);

        verify(orderRepository, never()).moveStatus(any(), any(), any(), any(), any(), any(), any());
        verifyNoInteractions(furnitureItemRepository);
    }

    @Test
    void shouldRefuseAStatusThatDoesNotExist() {
        when(orderRepository.findById(id)).thenReturn(Optional.of(order(Status.NEW)));

        assertThatThrownBy(() -> service.updateStatus(id, "SHIPPED", null, staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unknown status: SHIPPED");

        verify(orderRepository, never()).moveStatus(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void shouldRefuseAReasonThatIsTooLong_withoutTouchingTheOrder() {
        when(orderRepository.findById(id)).thenReturn(Optional.of(order(Status.CONFIRMED)));

        assertThatThrownBy(() -> service.updateStatus(id, "CANCELLED", "x".repeat(301), manager))
                .isInstanceOf(IllegalArgumentException.class);

        verify(orderRepository, never()).moveStatus(any(), any(), any(), any(), any(), any(), any());
    }

    // ------------------------------------------------------------------ notes

    @Test
    void shouldWriteOnlyTheNotes() {
        when(orderRepository.findById(id)).thenReturn(Optional.of(order(Status.CONFIRMED)));

        service.updateNotes(id, "  Call before delivery  ");

        verify(orderRepository).saveNotes(eq(id), eq("Call before delivery"), any(LocalDateTime.class));
        verify(orderRepository, never()).save(any());
    }

    @Test
    void shouldWriteNothing_whenTheOrderDoesNotExist() {
        when(orderRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateNotes(id, "x")).isInstanceOf(IllegalArgumentException.class).hasMessage("Order not found");

        verify(orderRepository, never()).saveNotes(any(), any(), any());
    }
}

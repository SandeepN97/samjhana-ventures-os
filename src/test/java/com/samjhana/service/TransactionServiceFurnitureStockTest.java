package com.samjhana.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.DailyReportRepository;
import com.samjhana.repository.FuelPriceRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.SystemSettingRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.strategy.BusinessCalculationStrategy.ValidationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Findings P0-11 and P1a-13: what a furniture sale or purchase does to the stock. Each line is one guarded statement on
 * the stock column (never a read, change in memory and write back of the whole row), a sale takes stock off and a
 * purchase puts it on, and a line that does not name a real quantity is refused rather than guessed.
 */
@ExtendWith(MockitoExtension.class)
class TransactionServiceFurnitureStockTest {

    @Mock TransactionRepository transactionRepository;
    @Mock BusinessUnitRepository businessUnitRepository;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock CalculationEngine calculationEngine;
    @Mock DailyReportRepository dailyReportRepository;
    @Mock SystemSettingRepository systemSettingRepository;
    @Mock BeekeepingService beekeepingService;
    @Mock LoanReceiptService loanReceiptService;
    @Mock FuelPriceRepository fuelPriceRepository;

    private TransactionService service;
    private final User staff = User.builder().username("staff").passwordHash("x").fullName("Staff").role(User.UserRole.STAFF).build();
    private final BusinessUnit furniture = BusinessUnit.builder().code("furniture").name("Furniture").build();
    private final UUID sofa = UUID.randomUUID();
    private final UUID chair = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new TransactionService(transactionRepository, businessUnitRepository, furnitureItemRepository,
                auditLogRepository, calculationEngine, new ObjectMapper(), dailyReportRepository, systemSettingRepository,
                beekeepingService, loanReceiptService, fuelPriceRepository);
        lenient().when(businessUnitRepository.findByCode("furniture")).thenReturn(Optional.of(furniture));
        lenient().when(calculationEngine.validate(anyString(), anyMap())).thenReturn(ValidationResult.valid());
        lenient().when(transactionRepository.save(any(Transaction.class))).then(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
        lenient().when(dailyReportRepository.findByReportDate(any())).thenReturn(Optional.empty());
    }

    private static Map<String, Object> line(Object itemId, Object quantity) {
        Map<String, Object> line = new LinkedHashMap<>();
        if (itemId != null) line.put("itemId", itemId.toString());
        if (quantity != null) line.put("quantity", quantity);
        return line;
    }

    @SafeVarargs
    private TransactionRequest request(String type, Map<String, Object>... lines) {
        TransactionRequest request = new TransactionRequest();
        request.setBusinessCode("furniture");
        request.setTransactionType(type);
        request.setAmount(new BigDecimal("1000"));
        Map<String, Object> fields = new HashMap<>();
        fields.put("itemName", "Sofa");
        fields.put("quantity", 1);
        fields.put("items", List.of(lines));
        request.setCustomFields(fields);
        return request;
    }

    // ------------------------------------------------------------------ what a line does

    @Test
    void shouldTakeEachLinesQuantityOffTheStock_forASale() {
        service.create(request("SALE", line(sofa, 3), line(chair, 1)), staff);

        verify(furnitureItemRepository).removeStockUpTo(sofa, 3);
        verify(furnitureItemRepository).removeStockUpTo(chair, 1);
        verify(furnitureItemRepository, never()).addStock(any(), anyInt());
    }

    @Test
    void shouldPutEachLinesQuantityOnTheStock_forAPurchase() {
        service.create(request("PURCHASE", line(sofa, 4)), staff);

        verify(furnitureItemRepository).addStock(sofa, 4);
        verify(furnitureItemRepository, never()).removeStockUpTo(any(), anyInt());
    }

    @Test
    void shouldNeverReadAnItemBackAndSaveTheWholeRow() {
        service.create(request("SALE", line(sofa, 2)), staff);

        verify(furnitureItemRepository, never()).findById(any());
        verify(furnitureItemRepository, never()).save(any());
    }

    @Test
    void shouldTakeOneOffTheStock_whenALineHasNoQuantity() {
        service.create(request("SALE", line(sofa, null)), staff);

        verify(furnitureItemRepository).removeStockUpTo(sofa, 1);
    }

    @Test
    void shouldSkipALineWithoutAnItemId_andALineWhoseItemIdIsNotAnId() {
        service.create(request("SALE", line(null, 2), line("not-an-id", 2), line("", 2)), staff);

        verifyNoInteractions(furnitureItemRepository);
    }

    @Test
    void shouldAcceptAWholeQuantityWrittenAsADecimal() {
        service.create(request("SALE", line(sofa, 2.0)), staff);

        verify(furnitureItemRepository).removeStockUpTo(sofa, 2);
    }

    // ------------------------------------------------------------------ a line that is not a real quantity

    @Test
    void shouldRefuseTheWholeSale_whenALineHasANegativeQuantity_evenIfTheEngineLetItThrough() {
        assertThatThrownBy(() -> service.create(request("SALE", line(sofa, -5)), staff))
                .isInstanceOf(IllegalArgumentException.class);

        verify(furnitureItemRepository, never()).removeStockUpTo(any(), anyInt());
        verify(furnitureItemRepository, never()).addStock(any(), anyInt());
    }

    @Test
    void shouldRefuseAQuantityThatIsNotANumber() {
        assertThatThrownBy(() -> service.create(request("SALE", line(sofa, "lots")), staff))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRefuseAQuantityAboveTheLimit() {
        assertThatThrownBy(() -> service.create(request("PURCHASE", line(sofa, 10_001)), staff))
                .isInstanceOf(IllegalArgumentException.class);

        verify(furnitureItemRepository, never()).addStock(any(), anyInt());
    }

    @Test
    void shouldAcceptTheLargestAllowedQuantity() {
        service.create(request("PURCHASE", line(sofa, 10_000)), staff);

        verify(furnitureItemRepository).addStock(sofa, 10_000);
    }

    // ------------------------------------------------------------------ stock that was already taken

    @Test
    void shouldLeaveTheStockAlone_whenTheOnlineOrderAlreadyTookIt() {
        service.createForOnlineOrder(request("SALE", line(sofa, 2)), staff, "SV-1234");

        verifyNoInteractions(furnitureItemRepository);
    }

    @Test
    void shouldLeaveTheStockAlone_forASaleWithoutLines() {
        TransactionRequest request = request("SALE");
        request.getCustomFields().remove("items");

        service.create(request, staff);

        verifyNoInteractions(furnitureItemRepository);
        assertThat(request.getCustomFields()).doesNotContainKey("items");
    }
}

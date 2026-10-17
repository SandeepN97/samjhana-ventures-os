package com.samjhana.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.SystemSetting;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.DailyReportRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.SystemSettingRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.strategy.BusinessCalculationStrategy.ValidationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;

/**
 * Findings G-01 / D-01: the server works out an EV sale's electricity cost from the energy figure on the entry. A
 * figure written as text with an extreme exponent is not a usable number, so no cost is worked out from it.
 */
@ExtendWith(MockitoExtension.class)
class TransactionServiceNumbersTest {

    @Mock TransactionRepository transactionRepository;
    @Mock BusinessUnitRepository businessUnitRepository;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock CalculationEngine calculationEngine;
    @Mock DailyReportRepository dailyReportRepository;
    @Mock SystemSettingRepository systemSettingRepository;
    @Mock BeekeepingService beekeepingService;
    @Mock LoanReceiptService loanReceiptService;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks TransactionService service;

    private final LocalDate today = LocalDate.now(ZoneId.of("Asia/Kathmandu"));
    private final User staff = User.builder().username("staff").passwordHash("x").fullName("Staff").role(User.UserRole.STAFF).build();

    @BeforeEach
    void setUp() {
        lenient().when(businessUnitRepository.findByCode("ev")).thenReturn(Optional.of(BusinessUnit.builder().code("ev").name("EV").build()));
        lenient().when(calculationEngine.validate(anyString(), anyMap())).thenReturn(ValidationResult.valid());
        lenient().when(transactionRepository.save(any(Transaction.class))).then(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
        lenient().when(dailyReportRepository.findByReportDate(any())).thenReturn(Optional.empty());
        lenient().when(systemSettingRepository.findById("nea_rate"))
                .thenReturn(Optional.of(SystemSetting.builder().settingKey("nea_rate").settingValue("12").build()));
    }

    private Map<String, Object> savedFieldsOfAnEvSale(Object estimatedKwh) throws Exception {
        TransactionRequest request = new TransactionRequest();
        request.setBusinessCode("ev");
        request.setTransactionType("SALE");
        request.setAmount(new BigDecimal("1000"));
        request.setTransactionDate(today);
        request.setCustomFields(Map.of("estimatedKwh", estimatedKwh));
        service.create(request, staff);
        ArgumentCaptor<Transaction> saved = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(saved.capture());
        return objectMapper.readValue(saved.getValue().getCustomFields(), new TypeReference<>() {});
    }

    @Test
    void shouldWorkOutTheElectricityCost_fromAnOrdinaryEnergyFigureWrittenAsText() throws Exception {
        Map<String, Object> fields = savedFieldsOfAnEvSale("50");

        assertThat(new BigDecimal(fields.get("neaCost").toString())).isEqualByComparingTo("600");
    }

    @Test
    void shouldWorkOutNoCost_fromAnEnergyFigureWithAnExtremeExponent() throws Exception {
        Map<String, Object> fields = savedFieldsOfAnEvSale("1e100");

        assertThat(fields).doesNotContainKeys("neaCost", "profit", "profitMargin");
    }
}

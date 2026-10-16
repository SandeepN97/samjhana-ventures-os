package com.samjhana.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.DailyReportRepository;
import com.samjhana.repository.FuelPriceRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.SystemSettingRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.strategy.impl.EVStrategy;
import com.samjhana.strategy.impl.PetrolStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Finding P0-02: the server used to store whatever amount the client sent. For petrol and EV sales it now works the
 * amount out itself (quantity x rate, from the real strategies) and compares. Staff entries that do not agree are
 * refused; a manager's or admin's entry is kept, marked, and written to the audit log.
 */
@ExtendWith(MockitoExtension.class)
class TransactionServiceSaleAmountTest {

    @Mock TransactionRepository transactionRepository;
    @Mock BusinessUnitRepository businessUnitRepository;
    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock DailyReportRepository dailyReportRepository;
    @Mock SystemSettingRepository systemSettingRepository;
    @Mock BeekeepingService beekeepingService;
    @Mock LoanReceiptService loanReceiptService;
    @Mock FuelPriceRepository fuelPriceRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final LocalDate today = LocalDate.now(ZoneId.of("Asia/Kathmandu"));
    private final User staff = User.builder().username("staff").passwordHash("x").fullName("Staff").role(User.UserRole.STAFF).build();
    private final User manager = User.builder().username("mgr").passwordHash("x").fullName("Manager").role(User.UserRole.MANAGER).build();
    private final BusinessUnit petrol = BusinessUnit.builder().code("petrol").name("Petrol").build();
    private final BusinessUnit ev = BusinessUnit.builder().code("ev").name("EV").build();
    private TransactionService service;

    @BeforeEach
    void setUp() {
        CalculationEngine engine = new CalculationEngine(List.of(new PetrolStrategy(), new EVStrategy()));
        engine.init();
        service = new TransactionService(transactionRepository, businessUnitRepository, furnitureItemRepository,
                auditLogRepository, engine, objectMapper, dailyReportRepository, systemSettingRepository,
                beekeepingService, loanReceiptService, fuelPriceRepository);
        lenient().when(businessUnitRepository.findByCode("petrol")).thenReturn(Optional.of(petrol));
        lenient().when(businessUnitRepository.findByCode("ev")).thenReturn(Optional.of(ev));
        lenient().when(transactionRepository.save(any(Transaction.class))).then(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
        lenient().when(dailyReportRepository.findByReportDate(any())).thenReturn(Optional.empty());
        // No fuel price is set unless a test sets one for a given day.
        lenient().when(fuelPriceRepository.findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(any(), any()))
                .thenReturn(Optional.empty());
    }

    // ---- helpers ------------------------------------------------------------------------------------

    /** The petrol price in force when the lookup is made for {@code day}. */
    private void petrolPriceFor(LocalDate day, String pricePerLiter) {
        when(fuelPriceRepository.findFirstByFuelTypeAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(
                FuelPrice.FuelType.PETROL, day)).thenReturn(Optional.of(FuelPrice.builder()
                .fuelType(FuelPrice.FuelType.PETROL).pricePerLiter(new BigDecimal(pricePerLiter)).effectiveDate(day).build()));
    }

    private TransactionRequest request(String business, String type, String amount, Map<String, Object> fields) {
        TransactionRequest r = new TransactionRequest();
        r.setBusinessCode(business);
        r.setTransactionType(type);
        r.setAmount(new BigDecimal(amount));
        r.setTransactionDate(today);
        r.setCustomFields(fields);
        return r;
    }

    private Map<String, Object> petrolFields(String liters, String ratePerLiter) {
        return Map.of("fuelType", "petrol", "liters", new BigDecimal(liters), "ratePerLiter", new BigDecimal(ratePerLiter));
    }

    private Transaction savedTransaction() {
        ArgumentCaptor<Transaction> saved = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(saved.capture());
        return saved.getValue();
    }

    private Map<String, Object> savedFields() throws Exception {
        return objectMapper.readValue(savedTransaction().getCustomFields(), new TypeReference<>() {});
    }

    // ---- petrol: staff ------------------------------------------------------------------------------

    @Test
    void shouldAllowAStaffFuelSale_aRupeeOffTheWorkedAmount_butNotAPaisaMore() {
        petrolPriceFor(today, "170");   // 10 litres x 170 = 1700: a rupee either way is rounding, more than that is not

        service.create(request("petrol", "SALE", "1701.00", petrolFields("10", "170")), staff);
        service.create(request("petrol", "SALE", "1699.00", petrolFields("10", "170")), staff);

        assertThatThrownBy(() -> service.create(request("petrol", "SALE", "1701.01", petrolFields("10", "170")), staff))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("does not add up");
        assertThatThrownBy(() -> service.create(request("petrol", "SALE", "1698.99", petrolFields("10", "170")), staff))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("does not add up");
    }

    @Test
    void shouldRefuseAStaffFuelSale_whenTheAmountIsNotLitresTimesRate() {
        petrolPriceFor(today, "170");

        assertThatThrownBy(() -> service.create(request("petrol", "SALE", "1000", petrolFields("10", "170")), staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not add up")
                .hasMessageContaining("1700");

        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void shouldAcceptAStaffFuelSale_whenTheAmountIsLitresTimesRate() throws Exception {
        petrolPriceFor(today, "170");

        service.create(request("petrol", "SALE", "1700", petrolFields("10", "170")), staff);

        assertThat(savedTransaction().getAmount()).isEqualByComparingTo("1700");
        assertThat(savedFields()).doesNotContainKeys("amountOverride", "expectedAmount");
    }

    @Test
    void shouldAcceptAStaffFuelSale_whenTheAmountIsWithinOneRupeeOfTheMaths() {
        petrolPriceFor(today, "170.25");   // 10.5 L x 170.25 = 1787.625, which the strategy rounds to 1787.63

        service.create(request("petrol", "SALE", "1788", petrolFields("10.5", "170.25")), staff);

        assertThat(savedTransaction().getAmount()).isEqualByComparingTo("1788");
    }

    @Test
    void shouldRefuseAStaffFuelSale_whenTheAmountIsMoreThanOneRupeeFromTheMaths() {
        petrolPriceFor(today, "170.25");

        assertThatThrownBy(() -> service.create(request("petrol", "SALE", "1789", petrolFields("10.5", "170.25")), staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not add up");

        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void shouldRefuseAStaffFuelSale_whenTheRateIsNotThePriceInForce() {
        petrolPriceFor(today, "176.50");

        // 10 L x 150 = 1500 is internally consistent, but 150 is not the pump price.
        assertThatThrownBy(() -> service.create(request("petrol", "SALE", "1500", petrolFields("10", "150")), staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not add up")
                .hasMessageContaining("fuel price");

        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void shouldAcceptAStaffFuelSale_whenTheRateIsYesterdaysPrice() {
        petrolPriceFor(today, "180");
        petrolPriceFor(today.minusDays(1), "176.50");   // an entry made around midnight or just after a price change

        service.create(request("petrol", "SALE", "1765", petrolFields("10", "176.50")), staff);

        assertThat(savedTransaction().getAmount()).isEqualByComparingTo("1765");
    }

    @Test
    void shouldAcceptAStaffFuelSale_whenNoFuelPriceHasBeenSetYet() {
        service.create(request("petrol", "SALE", "1700", petrolFields("10", "170")), staff);

        assertThat(savedTransaction().getAmount()).isEqualByComparingTo("1700");
    }

    @Test
    void shouldRefuseAStaffFuelSale_whenThereAreNoDetailsToCheck() {
        assertThatThrownBy(() -> service.create(request("petrol", "SALE", "1700", null), staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not add up");

        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void shouldNotCheckAPetrolPurchase() {
        service.create(request("petrol", "PURCHASE", "1", petrolFields("10", "170")), staff);

        assertThat(savedTransaction().getAmount()).isEqualByComparingTo("1");
    }

    // ---- petrol: manager ----------------------------------------------------------------------------

    @Test
    void shouldKeepAManagersAmount_andRecordTheOverride_whenItDiffersFromTheMaths() throws Exception {
        petrolPriceFor(today, "170");

        service.create(request("petrol", "SALE", "1500", petrolFields("10", "170")), manager);

        assertThat(savedTransaction().getAmount()).isEqualByComparingTo("1500");
        Map<String, Object> fields = savedFields();
        assertThat(new BigDecimal(fields.get("expectedAmount").toString())).isEqualByComparingTo("1700");
        assertThat(fields.get("amountOverride")).isEqualTo(true);
        ArgumentCaptor<AuditLog> audits = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository, times(2)).save(audits.capture());
        assertThat(audits.getAllValues().get(1).getDescription())
                .startsWith("AMOUNT OVERRIDE by mgr")
                .contains("1500")
                .contains("1700");
    }

    @Test
    void shouldNotMarkAnOverride_whenAManagersAmountAgrees() throws Exception {
        petrolPriceFor(today, "170");

        service.create(request("petrol", "SALE", "1700", petrolFields("10", "170")), manager);

        assertThat(savedFields()).doesNotContainKeys("amountOverride", "expectedAmount");
        verify(auditLogRepository, times(1)).save(any(AuditLog.class));
    }

    @Test
    void shouldKeepAManagersSaleWithNoDetails_andMarkItAsAnOverride() throws Exception {
        service.create(request("petrol", "SALE", "1700", null), manager);

        assertThat(savedTransaction().getAmount()).isEqualByComparingTo("1700");
        assertThat(savedFields().get("amountOverride")).isEqualTo(true);
        verify(auditLogRepository, times(2)).save(any(AuditLog.class));
    }

    // ---- EV -----------------------------------------------------------------------------------------

    @Test
    void shouldRefuseAStaffEvSale_whenTheAmountIsNotPercentTimesRate() {
        Map<String, Object> fields = Map.of("chargingMode", "PERCENTAGE", "startPercent", 20, "endPercent", 80, "ratePerPercent", 10);

        assertThatThrownBy(() -> service.create(request("ev", "SALE", "300", fields), staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not add up")
                .hasMessageContaining("600");

        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void shouldRefuseAStaffEvSale_whenTheAmountIsNotMeterUnitsTimesRate() {
        Map<String, Object> fields = Map.of("openingMeter", 100, "closingMeter", 150, "unitRate", 20);

        assertThatThrownBy(() -> service.create(request("ev", "SALE", "500", fields), staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not add up");

        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void shouldRefuseAStaffEvSession_whenTheAmountIsNotWhatWasPaid() {
        Map<String, Object> fields = Map.of("chargingMode", "OCPP_SESSION", "chargeSessionId", "s-1",
                "energyDeliveredKwh", 12, "amountPaid", 400);

        assertThatThrownBy(() -> service.create(request("ev", "SALE", "100", fields), staff))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not add up");

        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    static Stream<Arguments> evSalesWhoseAmountAgrees() {
        return Stream.of(
                Arguments.of("percentage mode", "600",
                        Map.of("chargingMode", "PERCENTAGE", "startPercent", 20, "endPercent", 80, "ratePerPercent", 10)),
                Arguments.of("meter mode", "1000", Map.of("openingMeter", 100, "closingMeter", 150, "unitRate", 20)),
                Arguments.of("charge session", "400", Map.of("chargingMode", "OCPP_SESSION", "chargeSessionId", "s-1",
                        "energyDeliveredKwh", 12, "amountPaid", 400)));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("evSalesWhoseAmountAgrees")
    void shouldAcceptAStaffEvSale_whenTheAmountAgrees(String mode, String amount, Map<String, Object> fields) {
        service.create(request("ev", "SALE", amount, fields), staff);

        assertThat(savedTransaction().getAmount()).isEqualByComparingTo(amount);
    }
}

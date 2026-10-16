package com.samjhana.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.DailyReport;
import com.samjhana.entity.SystemSetting;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.exception.DayAlreadyClosedException;
import com.samjhana.exception.TransactionNotFoundException;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Who sees which transactions, and the checks on new entries (amount, date, closed days, cost). */
@ExtendWith(MockitoExtension.class)
class TransactionServiceSecurityTest {

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

    private final ObjectMapper objectMapper = new ObjectMapper();
    private TransactionService service;
    private final LocalDate today = LocalDate.now(ZoneId.of("Asia/Kathmandu"));

    private final User staff = User.builder().username("staff").passwordHash("x").fullName("Staff").role(User.UserRole.STAFF).build();
    private final User manager = User.builder().username("mgr").passwordHash("x").fullName("Manager").role(User.UserRole.MANAGER).build();
    private final BusinessUnit petrol = BusinessUnit.builder().code("petrol").name("Petrol").build();
    private final BusinessUnit ev = BusinessUnit.builder().code("ev").name("EV").build();
    private final BusinessUnit loan = BusinessUnit.builder().code("loan").name("Loan").build();

    @BeforeEach
    void setUp() {
        service = new TransactionService(transactionRepository, businessUnitRepository, furnitureItemRepository,
                auditLogRepository, calculationEngine, objectMapper, dailyReportRepository, systemSettingRepository,
                beekeepingService, loanReceiptService, fuelPriceRepository);
        lenient().when(businessUnitRepository.findByCode("petrol")).thenReturn(Optional.of(petrol));
        lenient().when(businessUnitRepository.findByCode("ev")).thenReturn(Optional.of(ev));
        lenient().when(calculationEngine.validate(anyString(), anyMap())).thenReturn(ValidationResult.valid());
        lenient().when(transactionRepository.save(any(Transaction.class))).then(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
        lenient().when(dailyReportRepository.findByReportDate(any())).thenReturn(Optional.empty());
    }

    private Transaction txn(BusinessUnit bu, Transaction.TransactionType type, String customFields) {
        return Transaction.builder().id(UUID.randomUUID()).business(bu).enteredBy(manager)
                .transactionType(type).transactionDate(today).amount(new BigDecimal("1000"))
                .status(Transaction.TransactionStatus.APPROVED).customFields(customFields).build();
    }

    private TransactionRequest request(String business, String type, String amount, LocalDate date, Map<String, Object> fields) {
        TransactionRequest r = new TransactionRequest();
        r.setBusinessCode(business);
        r.setTransactionType(type);
        r.setAmount(amount == null ? null : new BigDecimal(amount));
        r.setTransactionDate(date);
        r.setCustomFields(fields);
        return r;
    }

    private Map<String, Object> savedFields() throws Exception {
        ArgumentCaptor<Transaction> saved = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(saved.capture());
        return objectMapper.readValue(saved.getValue().getCustomFields(), Map.class);
    }

    // ---- reading ------------------------------------------------------------------------------------

    @Test
    void shouldHideLoanTransactionsFromStaff_whenListing() {
        when(transactionRepository.findAllWithDetails()).thenReturn(List.of(
                txn(petrol, Transaction.TransactionType.SALE, "{}"), txn(loan, Transaction.TransactionType.EXPENSE, "{}")));

        assertThat(service.list(null, staff)).extracting(TransactionResponse::getBusinessCode).containsExactly("petrol");
        assertThat(service.list(null, manager)).hasSize(2);
    }

    @Test
    void shouldAnswerNotFound_whenStaffOpensALoanTransaction() {
        Transaction loanTxn = txn(loan, Transaction.TransactionType.EXPENSE, "{}");
        when(transactionRepository.findById(loanTxn.getId())).thenReturn(Optional.of(loanTxn));

        assertThatThrownBy(() -> service.get(loanTxn.getId(), staff)).isInstanceOf(TransactionNotFoundException.class);
    }

    @Test
    void shouldStripCostAndProfitFromStaffView_butKeepThemForManagers() throws Exception {
        Transaction sale = txn(petrol, Transaction.TransactionType.SALE,
                "{\"fuelType\":\"petrol\",\"liters\":10,\"ratePerLiter\":170,\"purchaseRate\":160,\"profit\":100}");
        when(transactionRepository.findById(sale.getId())).thenReturn(Optional.of(sale));

        Map<String, Object> staffView = objectMapper.readValue(service.get(sale.getId(), staff).getCustomFields(), Map.class);
        Map<String, Object> managerView = objectMapper.readValue(service.get(sale.getId(), manager).getCustomFields(), Map.class);

        assertThat(staffView).containsKeys("fuelType", "liters", "ratePerLiter").doesNotContainKeys("purchaseRate", "profit");
        assertThat(managerView).containsKeys("purchaseRate", "profit");
    }

    @Test
    void shouldHideTheUnitCostOfAFuelPurchaseFromStaff() throws Exception {
        Transaction purchase = txn(petrol, Transaction.TransactionType.PURCHASE, "{\"fuelType\":\"petrol\",\"ratePerLiter\":160}");
        when(transactionRepository.findById(purchase.getId())).thenReturn(Optional.of(purchase));

        Map<String, Object> staffView = objectMapper.readValue(service.get(purchase.getId(), staff).getCustomFields(), Map.class);
        assertThat(staffView).containsKey("fuelType").doesNotContainKey("ratePerLiter");
    }

    // ---- creating -----------------------------------------------------------------------------------

    @Test
    void shouldRejectAZeroOrNegativeAmount() {
        assertThatThrownBy(() -> service.create(request("petrol", "SALE", "0", today, Map.of()), staff))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("greater than zero");
        assertThatThrownBy(() -> service.create(request("petrol", "SALE", "-50", today, Map.of()), staff))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(request("petrol", "SALE", null, today, Map.of()), staff))
                .isInstanceOf(IllegalArgumentException.class);
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void shouldRejectAFutureDate() {
        assertThatThrownBy(() -> service.create(request("petrol", "SALE", "100", today.plusDays(5), Map.of()), manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("future");
    }

    @Test
    void shouldAllowTomorrow_becauseThatIsTheBusinessDateAfterClosingToday() {
        service.create(request("petrol", "SALE", "100", today.plusDays(1), Map.of()), staff);
        verify(transactionRepository).save(any(Transaction.class));
    }

    @Test
    void shouldStopStaffAddingToAClosedDay_butLetAManagerCorrectIt() {
        LocalDate closed = today.minusDays(2);
        when(dailyReportRepository.findByReportDate(closed)).thenReturn(Optional.of(new DailyReport()));

        assertThatThrownBy(() -> service.create(request("petrol", "SALE", "100", closed, Map.of()), staff))
                .isInstanceOf(DayAlreadyClosedException.class);

        service.create(request("petrol", "SALE", "100", closed, Map.of()), manager);
        verify(transactionRepository).save(any(Transaction.class));
    }

    @Test
    void shouldUseTheBusinessDate_whenNoDateIsGiven() {
        when(dailyReportRepository.findByReportDate(today)).thenReturn(Optional.of(new DailyReport()));

        service.create(request("petrol", "SALE", "100", null, Map.of()), manager);

        ArgumentCaptor<Transaction> saved = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(saved.capture());
        assertThat(saved.getValue().getTransactionDate()).isEqualTo(today.plusDays(1));
    }

    @Test
    void shouldIgnoreAProfitFigureSentByStaff_andWorkOutThePurchaseRateItself() throws Exception {
        stubPurchases(0, List.of(
                txn(petrol, Transaction.TransactionType.PURCHASE, "{\"fuelType\":\"petrol\",\"ratePerLiter\":158.5}")));

        service.create(request("petrol", "SALE", "1700", today,
                Map.of("fuelType", "petrol", "liters", 10, "purchaseRate", 1, "profit", 99999)), staff);

        Map<String, Object> fields = savedFields();
        assertThat(new BigDecimal(fields.get("purchaseRate").toString())).isEqualByComparingTo("158.5");
        assertThat(fields).doesNotContainKey("profit");
    }

    // ---- the purchase-rate lookup reads a page of purchases, not the whole petrol history (finding K-01) ----

    private void stubPurchases(int page, List<Transaction> rows) {
        when(transactionRepository.findRecentByBusinessCodeAndTypeExcludingStatus(
                eq("petrol"), eq(Transaction.TransactionType.PURCHASE), eq(Transaction.TransactionStatus.REJECTED),
                eq(org.springframework.data.domain.PageRequest.of(page, 25)))).thenReturn(rows);
    }

    private Transaction purchase(String fuelType, String rate) {
        return txn(petrol, Transaction.TransactionType.PURCHASE,
                "{\"fuelType\":\"" + fuelType + "\"" + (rate == null ? "" : ",\"ratePerLiter\":" + rate) + "}");
    }

    private List<Transaction> fullPageOfDieselPurchases() {
        return java.util.Collections.nCopies(25, purchase("diesel", "150"));
    }

    private void sellPetrol() {
        service.create(request("petrol", "SALE", "1700", today, Map.of("fuelType", "petrol", "liters", 10)), staff);
    }

    @Test
    void shouldAskForOnePageOfPurchases_andNeverLoadTheWholePetrolHistory() {
        stubPurchases(0, List.of(purchase("petrol", "158.5")));

        sellPetrol();

        verify(transactionRepository, never()).findByBusinessCodeOrderByTransactionDateDesc(any());
        verify(transactionRepository, times(1)).findRecentByBusinessCodeAndTypeExcludingStatus(
                eq("petrol"), eq(Transaction.TransactionType.PURCHASE), eq(Transaction.TransactionStatus.REJECTED), any(Pageable.class));
    }

    @Test
    void shouldReadTheNextPage_whenTheFirstPageHasNoPurchaseOfThatFuel() throws Exception {
        stubPurchases(0, fullPageOfDieselPurchases());
        stubPurchases(1, List.of(purchase("petrol", "158.5")));

        sellPetrol();

        assertThat(new BigDecimal(savedFields().get("purchaseRate").toString())).isEqualByComparingTo("158.5");
    }

    @Test
    void shouldStopAfterEightPages_andLeaveTheCostOut_whenNoPurchaseMatches() throws Exception {
        for (int page = 0; page < 8; page++) stubPurchases(page, fullPageOfDieselPurchases());

        sellPetrol();

        verify(transactionRepository, times(8)).findRecentByBusinessCodeAndTypeExcludingStatus(
                eq("petrol"), eq(Transaction.TransactionType.PURCHASE), eq(Transaction.TransactionStatus.REJECTED), any(Pageable.class));
        assertThat(savedFields()).doesNotContainKey("purchaseRate");
    }

    @Test
    void shouldStopAtTheFirstMatch_withoutReadingMorePages() throws Exception {
        List<Transaction> page = new java.util.ArrayList<>(fullPageOfDieselPurchases());
        page.set(3, purchase("petrol", "158.5"));
        stubPurchases(0, page);

        sellPetrol();

        verify(transactionRepository, times(1)).findRecentByBusinessCodeAndTypeExcludingStatus(
                eq("petrol"), eq(Transaction.TransactionType.PURCHASE), eq(Transaction.TransactionStatus.REJECTED), any(Pageable.class));
        assertThat(new BigDecimal(savedFields().get("purchaseRate").toString())).isEqualByComparingTo("158.5");
    }

    @Test
    void shouldStopAtAShortPage_becauseThereAreNoMorePurchases() throws Exception {
        stubPurchases(0, List.of(purchase("diesel", "150"), purchase("diesel", "151")));

        sellPetrol();

        verify(transactionRepository, times(1)).findRecentByBusinessCodeAndTypeExcludingStatus(
                eq("petrol"), eq(Transaction.TransactionType.PURCHASE), eq(Transaction.TransactionStatus.REJECTED), any(Pageable.class));
        assertThat(savedFields()).doesNotContainKey("purchaseRate");
    }

    @Test
    void shouldSkipPurchasesWithoutAUsableRate_andMatchTheFuelWhateverItsCase() throws Exception {
        stubPurchases(0, List.of(purchase("petrol", null), purchase("petrol", "0"), purchase("PETROL", "158.5"), purchase("petrol", "140")));

        sellPetrol();

        assertThat(new BigDecimal(savedFields().get("purchaseRate").toString())).isEqualByComparingTo("158.5");
    }

    @Test
    void shouldNotLookUpAPurchaseRate_whenTheSaleNamesNoFuel() {
        service.create(request("petrol", "SALE", "1700", today, Map.of("liters", 10)), staff);

        verify(transactionRepository, never()).findRecentByBusinessCodeAndTypeExcludingStatus(any(), any(), any(), any());
        verify(transactionRepository, never()).findByBusinessCodeOrderByTransactionDateDesc(any());
    }

    @Test
    void shouldKeepAPurchaseRateSentByAManager_withoutLookingOneUp() throws Exception {
        service.create(request("petrol", "SALE", "1700", today,
                Map.of("fuelType", "petrol", "liters", 10, "purchaseRate", 140)), manager);

        verify(transactionRepository, never()).findRecentByBusinessCodeAndTypeExcludingStatus(any(), any(), any(), any());
        assertThat(new BigDecimal(savedFields().get("purchaseRate").toString())).isEqualByComparingTo("140");
    }

    @Test
    void shouldWorkOutEvElectricityCostAndProfitFromTheNeaRate() throws Exception {
        when(systemSettingRepository.findById("nea_rate"))
                .thenReturn(Optional.of(SystemSetting.builder().settingKey("nea_rate").settingValue("12").build()));

        service.create(request("ev", "SALE", "1000", today, Map.of("estimatedKwh", 50)), staff);

        Map<String, Object> fields = savedFields();
        assertThat(new BigDecimal(fields.get("neaCost").toString())).isEqualByComparingTo("600");
        assertThat(new BigDecimal(fields.get("profit").toString())).isEqualByComparingTo("400");
    }

    @Test
    void shouldNotReturnCostToStaff_inTheResponseToTheirOwnEntry() throws Exception {
        when(systemSettingRepository.findById("nea_rate"))
                .thenReturn(Optional.of(SystemSetting.builder().settingKey("nea_rate").settingValue("12").build()));

        TransactionResponse response = service.create(request("ev", "SALE", "1000", today, Map.of("estimatedKwh", 50)), staff);

        assertThat(objectMapper.readValue(response.getCustomFields(), Map.class)).doesNotContainKeys("neaCost", "profit");
    }
}

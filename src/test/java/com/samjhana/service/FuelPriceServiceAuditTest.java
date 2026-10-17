package com.samjhana.service;

import com.samjhana.dto.FuelPriceRequest;
import com.samjhana.dto.FuelPriceResponse;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.FuelPriceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Findings P0-08 and P1b-08 (fuel prices): a price must make sense (above zero, not absurdly large) before it becomes
 * the public price and the default rate at the pump, and every change a person makes is recorded with the old and
 * new price and who made it.
 */
@ExtendWith(MockitoExtension.class)
class FuelPriceServiceAuditTest {

    @Mock FuelPriceRepository fuelPriceRepository;
    @Mock NocPriceScraperService nocPriceScraperService;
    @Mock AuditLogRepository auditLogRepository;
    @InjectMocks FuelPriceService service;

    private final User manager = User.builder().id(UUID.randomUUID()).username("pump-manager").role(User.UserRole.MANAGER).build();
    private final LocalDate today = LocalDate.of(2026, 10, 16);

    @BeforeEach
    void setUp() {
        lenient().when(fuelPriceRepository.findByFuelTypeAndEffectiveDate(any(), any())).thenReturn(Optional.empty());
        lenient().when(fuelPriceRepository.save(any(FuelPrice.class))).thenAnswer(inv -> {
            FuelPrice saved = inv.getArgument(0);
            if (saved.getId() == null) saved.setId(UUID.randomUUID());
            return saved;
        });
    }

    private static FuelPriceRequest request(String fuelType, String price) {
        FuelPriceRequest request = new FuelPriceRequest();
        request.setFuelType(fuelType);
        request.setPricePerLiter(price == null ? null : new BigDecimal(price));
        request.setEffectiveDate(LocalDate.of(2026, 10, 16));
        return request;
    }

    private FuelPrice existing(String fuelType, String price) {
        FuelPrice row = FuelPrice.builder().id(UUID.randomUUID()).fuelType(FuelPrice.FuelType.valueOf(fuelType))
                .pricePerLiter(new BigDecimal(price)).effectiveDate(today).build();
        when(fuelPriceRepository.findByFuelTypeAndEffectiveDate(FuelPrice.FuelType.valueOf(fuelType), today)).thenReturn(Optional.of(row));
        return row;
    }

    private AuditLog theAuditRow() {
        ArgumentCaptor<AuditLog> row = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(row.capture());
        return row.getValue();
    }

    // ---- the price has to make sense ----

    @ParameterizedTest
    @ValueSource(strings = {"0", "0.00", "-5", "0.009", "10000.01", "1000000"})
    void shouldRefuseAPriceThatIsZeroNegativeOrAbsurd_andSaveNothing(String price) {
        assertThatThrownBy(() -> service.setPrice(request("PETROL", price), manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Price per litre must be between 0.01 and 10000");

        verify(fuelPriceRepository, never()).save(any(FuelPrice.class));
        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }

    @ParameterizedTest
    @NullSource
    void shouldRefuseAMissingPrice(String price) {
        assertThatThrownBy(() -> service.setPrice(request("PETROL", price), manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Price per litre must be between 0.01 and 10000");
    }

    @ParameterizedTest
    @ValueSource(strings = {"0.01", "169.50", "10000"})
    void shouldAcceptAPriceThatMakesSense(String price) {
        FuelPriceResponse saved = service.setPrice(request("DIESEL", price), manager);

        assertThat(saved.getPricePerLiter()).isEqualByComparingTo(price);
    }

    @Test
    void shouldRefuseAMissingFuelType() {
        assertThatThrownBy(() -> service.setPrice(request(null, "170"), manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Fuel type is required");
    }

    @Test
    void shouldCheckBothPricesOfTheBulkFormBeforeSavingEither() {
        assertThatThrownBy(() -> service.setBulkPrices(Map.of("petrolPrice", "170", "dieselPrice", "0"), manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Diesel price must be between 0.01 and 10000");

        verify(fuelPriceRepository, never()).save(any(FuelPrice.class));
        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }

    @Test
    void shouldNameThePetrolPrice_whenThePetrolPriceIsTheOneOutOfRange() {
        assertThatThrownBy(() -> service.setBulkPrices(Map.of("petrolPrice", "-1"), manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Petrol price must be between 0.01 and 10000");
    }

    // ---- every change leaves a record ----

    @Test
    void shouldRecordWhoSetANewPriceAndWhat() {
        FuelPriceResponse saved = service.setPrice(request("PETROL", "172.50"), manager);

        AuditLog row = theAuditRow();
        assertThat(row.getAction()).isEqualTo(AuditLog.AuditAction.CREATE);
        assertThat(row.getEntityType()).isEqualTo(AuditLog.EntityType.RESOURCE);
        assertThat(row.getEntityId().toString()).isEqualTo(saved.getId());
        assertThat(row.getUser()).isSameAs(manager);
        assertThat(row.getOldValues()).isNull();
        assertThat(row.getNewValues()).isEqualTo("{\"fuelType\":\"PETROL\",\"pricePerLiter\":\"172.50\",\"effectiveDate\":\"2026-10-16\"}");
        assertThat(row.getDescription()).isEqualTo("Fuel price set: PETROL 172.50 for 2026-10-16");
    }

    @Test
    void shouldRecordTheOldAndNewPrice_whenTodaysPriceIsChanged() {
        FuelPrice row = existing("DIESEL", "160.00");

        service.setPrice(request("DIESEL", "155.25"), manager);

        AuditLog audit = theAuditRow();
        assertThat(audit.getAction()).isEqualTo(AuditLog.AuditAction.UPDATE);
        assertThat(audit.getEntityId()).isEqualTo(row.getId());
        assertThat(audit.getUser()).isSameAs(manager);
        assertThat(audit.getEntityType()).isEqualTo(AuditLog.EntityType.RESOURCE);
        assertThat(audit.getOldValues()).isEqualTo("{\"fuelType\":\"DIESEL\",\"pricePerLiter\":\"160.00\",\"effectiveDate\":\"2026-10-16\"}");
        assertThat(audit.getNewValues()).isEqualTo("{\"fuelType\":\"DIESEL\",\"pricePerLiter\":\"155.25\",\"effectiveDate\":\"2026-10-16\"}");
        assertThat(audit.getDescription()).isEqualTo("Fuel price changed: DIESEL 160.00 -> 155.25 for 2026-10-16");
        assertThat(row.getPricePerLiter()).isEqualByComparingTo("155.25");
        assertThat(row.getUpdatedBy()).isSameAs(manager);
    }

    @Test
    void shouldWriteNothing_whenThePriceIsTheSameAsAlready() {
        FuelPrice row = existing("PETROL", "170.00");

        FuelPriceResponse response = service.setPrice(request("PETROL", "170"), manager);

        assertThat(response.getPricePerLiter()).isEqualByComparingTo("170");
        verify(fuelPriceRepository, never()).save(any(FuelPrice.class));
        verify(auditLogRepository, never()).save(any(AuditLog.class));
        assertThat(row.getUpdatedBy()).isNull();
    }

    @Test
    void shouldRecordEachFuelOfABulkChange() {
        service.setBulkPrices(Map.of("petrolPrice", "171", "dieselPrice", "158", "effectiveDate", "2026-10-16"), manager);

        ArgumentCaptor<AuditLog> rows = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository, org.mockito.Mockito.times(2)).save(rows.capture());
        assertThat(rows.getAllValues()).extracting(AuditLog::getDescription)
                .containsExactlyInAnyOrder("Fuel price set: PETROL 171 for 2026-10-16", "Fuel price set: DIESEL 158 for 2026-10-16");
        assertThat(rows.getAllValues()).allSatisfy(r -> assertThat(r.getUser()).isSameAs(manager));
    }
}

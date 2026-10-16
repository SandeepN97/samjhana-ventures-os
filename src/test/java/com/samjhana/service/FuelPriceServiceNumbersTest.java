package com.samjhana.service;

import com.samjhana.dto.FuelPriceResponse;
import com.samjhana.entity.FuelPrice;
import com.samjhana.entity.User;
import com.samjhana.repository.FuelPriceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** Findings G-01 / D-01: a fuel price typed into the bulk form is an ordinary number or it is refused. */
@ExtendWith(MockitoExtension.class)
class FuelPriceServiceNumbersTest {

    @Mock FuelPriceRepository fuelPriceRepository;
    @Mock NocPriceScraperService nocPriceScraperService;
    @InjectMocks FuelPriceService service;

    private final User admin = User.builder().username("admin").role(User.UserRole.ADMIN).build();

    @BeforeEach
    void setUp() {
        lenient().when(fuelPriceRepository.findByFuelTypeAndEffectiveDate(any(), any())).thenReturn(Optional.empty());
        lenient().when(fuelPriceRepository.save(any(FuelPrice.class))).thenAnswer(inv -> {
            FuelPrice saved = inv.getArgument(0);
            saved.setId(java.util.UUID.randomUUID());
            return saved;
        });
    }

    @Test
    void shouldSaveOrdinaryPrices_typedAsTextOrNumbers() {
        Map<String, FuelPriceResponse> saved = service.setBulkPrices(Map.of("petrolPrice", "170.50", "dieselPrice", 160), admin);

        assertThat(saved.get("petrol").getPricePerLiter()).isEqualByComparingTo(new BigDecimal("170.50"));
        assertThat(saved.get("diesel").getPricePerLiter()).isEqualByComparingTo(new BigDecimal("160"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1e100", "1E+1000000000", "abc", "", "1e-100"})
    void shouldRefuseAPetrolPriceThatIsNotAnOrdinaryNumber_andSaveNothing(String price) {
        assertThatThrownBy(() -> service.setBulkPrices(Map.of("petrolPrice", price), admin))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Petrol price must be a number");
        verify(fuelPriceRepository, never()).save(any(FuelPrice.class));
    }

    @Test
    void shouldRefuseADieselPriceThatIsNotAnOrdinaryNumber() {
        assertThatThrownBy(() -> service.setBulkPrices(Map.of("dieselPrice", "1e100"), admin))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Diesel price must be a number");
    }
}

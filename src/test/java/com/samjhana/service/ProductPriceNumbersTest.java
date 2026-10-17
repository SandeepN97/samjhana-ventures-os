package com.samjhana.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** Findings G-01 / D-01: a product price typed into the admin form is an ordinary number or it is refused. */
@ExtendWith(MockitoExtension.class)
class ProductPriceNumbersTest {

    @Mock BeekeepingProductRepository productRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock MediaService mediaService;
    @Mock SlugService slugService;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks BeekeepingService service;

    private final User admin = User.builder().username("admin").role(User.UserRole.ADMIN).build();

    @ParameterizedTest
    @ValueSource(strings = {"1e100", "1E+1000000000", "abc", "1e-100"})
    void shouldRefuseAPurchasePriceThatIsNotAnOrdinaryNumber(String price) {
        assertThatThrownBy(() -> service.createItem(
                Map.of("name", "Wild Honey", "category", "honey", "purchasePrice", price), admin))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Purchase price must be a number");
        verify(productRepository, never()).save(any());
    }

    @Test
    void shouldRefuseASellingPriceThatIsNotAnOrdinaryNumber() {
        assertThatThrownBy(() -> service.createItem(
                Map.of("name", "Wild Honey", "category", "honey", "sellingPrice", "1e100"), admin))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Selling price must be a number");
    }
}

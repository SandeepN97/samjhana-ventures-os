package com.samjhana.repository;

import com.samjhana.entity.FurnitureItem;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding P1a-13: a counter sale takes stock off in one statement that cannot go below zero, so it neither loses
 * a concurrent change nor drives the stock negative, and it touches nothing but the stock.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class FurnitureItemRepositoryStockTest {

    @Autowired FurnitureItemRepository items;
    @PersistenceContext EntityManager entityManager;

    private FurnitureItem item(int stock, boolean active) {
        return items.saveAndFlush(FurnitureItem.builder().name("Test chair").sku("REPO-" + UUID.randomUUID())
                .category(FurnitureItem.FurnitureCategory.CHAIR).stockQty(stock).isActive(active)
                .sellingPrice(new BigDecimal("1500.00")).build());
    }

    private FurnitureItem reload(FurnitureItem item) {
        entityManager.flush();
        entityManager.clear();
        return items.findById(item.getId()).orElseThrow();
    }

    @Test
    void shouldTakeTheQuantityOffTheStock_whenThereIsEnough() {
        FurnitureItem chair = item(5, true);

        assertThat(items.removeStockUpTo(chair.getId(), 3)).isEqualTo(1);

        assertThat(reload(chair).getStockQty()).isEqualTo(2);
    }

    @Test
    void shouldTakeTheStockToZero_whenTheQuantityIsExactlyWhatIsThere() {
        FurnitureItem chair = item(4, true);

        items.removeStockUpTo(chair.getId(), 4);

        assertThat(reload(chair).getStockQty()).isZero();
    }

    @Test
    void shouldStopAtZero_whenTheQuantityIsMoreThanWhatIsThere() {
        FurnitureItem chair = item(2, true);

        assertThat(items.removeStockUpTo(chair.getId(), 5)).isEqualTo(1);

        assertThat(reload(chair).getStockQty()).isZero();
    }

    @Test
    void shouldStayAtZero_whenThereIsNothingLeft() {
        FurnitureItem chair = item(0, true);

        items.removeStockUpTo(chair.getId(), 1);

        assertThat(reload(chair).getStockQty()).isZero();
    }

    @Test
    void shouldChangeNothing_forAZeroOrNegativeQuantity() {
        FurnitureItem chair = item(5, true);

        assertThat(items.removeStockUpTo(chair.getId(), 0)).isZero();
        assertThat(items.removeStockUpTo(chair.getId(), -3)).isZero();

        assertThat(reload(chair).getStockQty()).isEqualTo(5);
    }

    @Test
    void shouldChangeNothing_forAnItemThatDoesNotExist() {
        assertThat(items.removeStockUpTo(UUID.randomUUID(), 1)).isZero();
    }

    @Test
    void shouldAlsoApplyToAnItemTakenOffTheWebsite() {
        FurnitureItem chair = item(5, false);

        assertThat(items.removeStockUpTo(chair.getId(), 2)).isEqualTo(1);

        assertThat(reload(chair).getStockQty()).isEqualTo(3);
    }

    @Test
    void shouldTouchNothingButTheStock() {
        FurnitureItem chair = item(5, true);

        items.removeStockUpTo(chair.getId(), 1);

        FurnitureItem after = reload(chair);
        assertThat(after.getName()).isEqualTo("Test chair");
        assertThat(after.getSku()).isEqualTo(chair.getSku());
        assertThat(after.getSellingPrice()).isEqualByComparingTo("1500.00");
        assertThat(after.getIsActive()).isTrue();
    }
}

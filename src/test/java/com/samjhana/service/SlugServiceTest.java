package com.samjhana.service;

import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.FurnitureItemRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SlugServiceTest {

    @Mock FurnitureItemRepository furnitureItemRepository;
    @Mock BeekeepingProductRepository beekeepingProductRepository;
    @InjectMocks SlugService service;

    @Test
    void shouldMakeWebSafeSlugs() {
        assertThat(SlugService.slugify("Wild Honey — 500g!")).isEqualTo("wild-honey-500g");
        assertThat(SlugService.slugify("  Café Table  ")).isEqualTo("cafe-table");
        assertThat(SlugService.slugify("")).isEqualTo("product");
        assertThat(SlugService.slugify("मह")).isEqualTo("product");
        assertThat(SlugService.slugify("x".repeat(200))).hasSize(70);
    }

    @Test
    void shouldAddASuffix_whenEitherShopAlreadyUsesTheSlug() {
        when(furnitureItemRepository.existsBySlug("hive-1")).thenReturn(true);
        when(beekeepingProductRepository.existsBySlug("hive-1-2")).thenReturn(true);
        assertThat(service.uniqueSlug("HIVE-1")).isEqualTo("hive-1-3");
    }

    @Test
    void shouldKeepTheSlug_whenNobodyUsesIt() {
        assertThat(service.uniqueSlug("Sofa Set")).isEqualTo("sofa-set");
    }
}

package com.samjhana.controller;

import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BeekeepingProduct.BeekeepingCategory;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.FurnitureItem.FurnitureCategory;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.ShopOrderRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.List;
import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Deliberately NOT @Transactional: every request commits or rolls back by itself, as in production, so these
 * prove the stock rules hold for real: a refused order keeps nothing, and two buyers can't share the last unit.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ShopOrderAtomicityIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired BeekeepingProductRepository beekeepingRepository;
    @Autowired FurnitureItemRepository furnitureRepository;
    @Autowired ShopOrderRepository orderRepository;

    private BeekeepingProduct honey, hive;
    private FurnitureItem lastChair;

    @BeforeEach
    void setUp() {
        honey = beekeepingRepository.save(BeekeepingProduct.builder().name("Atomic Honey").sku("AT-HNY").slug("at-hny")
                .category(BeekeepingCategory.HONEY).sellingPrice(new BigDecimal("850")).stockQty(10).showOnWebsite(true).build());
        hive = beekeepingRepository.save(BeekeepingProduct.builder().name("Atomic Hive").sku("AT-HIVE").slug("at-hive")
                .category(BeekeepingCategory.HIVE).sellingPrice(new BigDecimal("4500")).stockQty(0).showOnWebsite(true).build());
        lastChair = furnitureRepository.save(FurnitureItem.builder().name("Last Chair").sku("AT-CHR").slug("at-chr")
                .category(FurnitureCategory.CHAIR).sellingPrice(new BigDecimal("2500")).stockQty(1).build());
    }

    @AfterEach
    void cleanUp() {
        orderRepository.deleteAll();
        beekeepingRepository.deleteAll(List.of(honey, hive));
        furnitureRepository.delete(lastChair);
    }

    private String json(String phone, String slugA, int qtyA, String slugB, int qtyB) {
        return "{\"customerName\":\"Test Buyer\",\"customerPhone\":\"" + phone + "\",\"fulfilment\":\"PICKUP\",\"items\":["
                + "{\"slug\":\"" + slugA + "\",\"quantity\":" + qtyA + "},{\"slug\":\"" + slugB + "\",\"quantity\":" + qtyB + "}]}";
    }

    @Test
    void shouldKeepNoStockAndNoOrder_whenALaterLineOfTheOrderIsRefused() throws Exception {
        long ordersBefore = orderRepository.count();
        mockMvc.perform(post("/api/public/shop/orders").contentType(MediaType.APPLICATION_JSON)
                        .content(json("9811110001", "at-hny", 3, "at-hive", 1)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(containsString("Atomic Hive")));

        assertThat(beekeepingRepository.findById(honey.getId()).orElseThrow().getStockQty()).isEqualTo(10);
        assertThat(orderRepository.count()).isEqualTo(ordersBefore);
    }

    @Test
    void shouldSellTheLastUnitToOnlyOneOfTwoBuyersAtTheSameTime() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Integer>> results = new ArrayList<>();
            for (String phone : List.of("9811110002", "9811110003")) {
                results.add(pool.submit(() -> mockMvc.perform(post("/api/public/shop/orders")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json(phone, "at-chr", 1, "at-hny", 1)))
                        .andReturn().getResponse().getStatus()));
            }
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> f : results) statuses.add(f.get());

            assertThat(statuses).containsExactlyInAnyOrder(201, 409);
            assertThat(furnitureRepository.findById(lastChair.getId()).orElseThrow().getStockQty()).isZero();
            // the buyer who lost the chair did not keep their honey either
            assertThat(beekeepingRepository.findById(honey.getId()).orElseThrow().getStockQty()).isEqualTo(9);
        } finally {
            pool.shutdownNow();
        }
    }
}

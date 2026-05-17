package com.samjhana.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublicControllerIntegrationTest {

    @Autowired MockMvc mockMvc;

    @Test
    void shouldAllowUnauthenticated_forFuelPrices() throws Exception {
        mockMvc.perform(get("/api/public/fuel-prices/current"))
            .andExpect(status().isOk());
    }

    @Test
    void shouldAllowUnauthenticated_forFurnitureCatalogue() throws Exception {
        mockMvc.perform(get("/api/public/furniture/catalogue"))
            .andExpect(status().isOk());
    }

    @Test
    void shouldAllowUnauthenticated_forEvRates() throws Exception {
        mockMvc.perform(get("/api/public/ev/rates"))
            .andExpect(status().isOk());
    }

    @Test
    void shouldRequireAuth_forTransactions() throws Exception {
        mockMvc.perform(get("/api/transactions"))
            .andExpect(status().isUnauthorized());
    }
}
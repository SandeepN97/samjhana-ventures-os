package com.samjhana.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Browser-side protections sent with every response. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityHeadersIntegrationTest {

    @Autowired MockMvc mockMvc;

    @Test
    void shouldSendHsts_evenThoughTheAppOnlySeesPlainHttpBehindTheProxy() throws Exception {
        mockMvc.perform(get("/api/public/ev/rates"))
                .andExpect(status().isOk())
                .andExpect(header().string("Strict-Transport-Security", containsString("max-age=31536000")));
    }

    @Test
    void shouldOnlyAllowTheAppsOwnScripts() throws Exception {
        mockMvc.perform(get("/api/public/ev/rates"))
                .andExpect(header().string("Content-Security-Policy", containsString("script-src 'self'")))
                .andExpect(header().string("Content-Security-Policy", containsString("object-src 'none'")));
    }

    @Test
    void shouldSendTheHeaders_onRefusedRequestsToo() throws Exception {
        mockMvc.perform(get("/api/transactions"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists("Strict-Transport-Security"))
                .andExpect(header().exists("Content-Security-Policy"));
    }

    @Test
    void shouldNotPutTheCspOnTheDevOnlyH2Console() throws Exception {
        mockMvc.perform(get("/h2-console/"))
                .andExpect(header().doesNotExist("Content-Security-Policy"));
    }

    @Test
    void shouldKeepTheReferrerOnThisSite() throws Exception {
        mockMvc.perform(get("/api/public/ev/rates"))
                .andExpect(header().string("Referrer-Policy", "same-origin"));
    }

    @Test
    void shouldNoLongerOpenTheUnusedShopRoutes() throws Exception {
        mockMvc.perform(get("/api/ecommerce/products")).andExpect(status().isUnauthorized());
    }
}

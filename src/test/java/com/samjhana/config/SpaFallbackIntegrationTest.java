package com.samjhana.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * With the admin app bundled (src/test/resources/static/index.html stands in for the real build),
 * its routes still load the app, while API paths never do.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SpaFallbackIntegrationTest {

    @Autowired MockMvc mockMvc;

    @Test
    void shouldServeTheAdminApp_forABrowserRoute() throws Exception {
        mockMvc.perform(get("/entry/ev"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("spa-shell")));
    }

    @Test
    void shouldNotServeTheAdminApp_inPlaceOfTheSwitchedOffApiDocs() throws Exception {
        // Not a permitted path outside dev, so an anonymous caller is stopped before reaching it.
        mockMvc.perform(get("/api-docs")).andExpect(status().isUnauthorized());
    }
}

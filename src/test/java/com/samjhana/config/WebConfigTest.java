package com.samjhana.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WebConfigTest {

    @Test
    void shouldServeTheAdminApp_forItsOwnRoutes() {
        assertThat(WebConfig.isAppPage("entry/ev")).isTrue();
        assertThat(WebConfig.isAppPage("analytics")).isTrue();
        assertThat(WebConfig.isAppPage("/ev-electricity")).isTrue();
        assertThat(WebConfig.isAppPage("apiary")).isTrue();
    }

    @Test
    void shouldNotServeTheAdminApp_forApiPaths() {
        assertThat(WebConfig.isAppPage("api/no-such-endpoint")).isFalse();
        assertThat(WebConfig.isAppPage("api")).isFalse();
        assertThat(WebConfig.isAppPage("api-docs")).isFalse();
        assertThat(WebConfig.isAppPage("api-docs/swagger-config")).isFalse();
        assertThat(WebConfig.isAppPage("/swagger-ui/index.html")).isFalse();
    }
}

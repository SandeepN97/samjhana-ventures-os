package com.samjhana.config;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding L-01: the PostgreSQL driver puts the server's "Detail:" text - the values of the row that clashed, such as
 * a number plate or a username, or a whole row for a NOT NULL failure - into its error messages, and Hibernate logs
 * those messages itself. The driver is told to leave that text out in the two hosted profiles.
 */
class DatabaseErrorDetailConfigTest {

    private static String datasourceUrl(String profile) throws Exception {
        List<PropertySource<?>> documents = new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"));
        return documents.stream()
                .filter(document -> profile.equals(String.valueOf(document.getProperty("spring.config.activate.on-profile"))))
                .map(document -> document.getProperty("spring.datasource.url"))
                .filter(url -> url != null)
                .map(Object::toString)
                .findFirst().orElseThrow(() -> new AssertionError("no spring.datasource.url in the " + profile + " profile"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"staging", "prod"})
    void shouldAskTheDriverToLeaveServerErrorDetailOut_inTheHostedProfile(String profile) throws Exception {
        String url = datasourceUrl(profile);

        assertThat(url).startsWith("jdbc:postgresql://");
        assertThat(url).contains("&logServerErrorDetail=false");
        assertThat(url).doesNotContain("logServerErrorDetail=true");
    }

    @ParameterizedTest
    @ValueSource(strings = {"staging", "prod"})
    void shouldKeepTheCertificateCheckInTheHostedUrl(String profile) throws Exception {
        assertThat(datasourceUrl(profile)).contains("sslmode=verify-full").contains("sslrootcert=");
    }
}

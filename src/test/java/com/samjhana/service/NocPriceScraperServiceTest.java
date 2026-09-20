package com.samjhana.service;

import com.samjhana.repository.FuelPriceRepository;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** SSRF guard: the scraper may only ever connect to the official NOC domain. Jsoup is mocked, nothing is fetched. */
@ExtendWith(MockitoExtension.class)
class NocPriceScraperServiceTest {

    @Mock FuelPriceRepository fuelPriceRepository;

    private NocPriceScraperService service;

    @BeforeEach
    void setUp() {
        service = new NocPriceScraperService(fuelPriceRepository);
        ReflectionTestUtils.setField(service, "depot", "Bhalbari");
        ReflectionTestUtils.setField(service, "enabled", true);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "https://evil.example.com",                         // unrelated host
            "https://noc.org.np.evil.example.com",              // NOC as a prefix of an attacker's domain
            "https://notnoc.org.np",                            // suffix match without the dot boundary
            "https://evil.example.com/noc.org.np",              // NOC only in the path
            "https://noc.org.np@evil.example.com/",             // NOC in the userinfo, real host is evil.example.com
            "http://169.254.169.254/latest/meta-data/",         // cloud metadata endpoint
            "http://localhost:8080/api/auth/login",             // our own backend
            "http://127.0.0.1",
            "file:///etc/passwd",                               // no host at all
            "",                                                 // empty configuration
            "not a valid url"                                   // malformed: must be swallowed, not thrown
    })
    void shouldNeverConnect_whenTheConfiguredUrlIsNotNoc(String url) {
        ReflectionTestUtils.setField(service, "nocUrl", url);

        try (MockedStatic<Jsoup> jsoup = mockStatic(Jsoup.class)) {
            assertDoesNotThrow(() -> service.fetchAndSavePrices());

            jsoup.verifyNoInteractions();
        }
        verifyNoInteractions(fuelPriceRepository);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "https://noc.org.np",
            "https://www.noc.org.np",
            "https://noc.org.np/prices?depot=Bhalbari"
    })
    void shouldConnect_whenTheHostIsNocOrOneOfItsSubdomains(String url) throws IOException {
        ReflectionTestUtils.setField(service, "nocUrl", url);
        Connection connection = mock(Connection.class, RETURNS_SELF);
        when(connection.get()).thenThrow(new IOException("offline"));

        try (MockedStatic<Jsoup> jsoup = mockStatic(Jsoup.class)) {
            jsoup.when(() -> Jsoup.connect(url)).thenReturn(connection);

            assertDoesNotThrow(() -> service.fetchAndSavePrices());

            jsoup.verify(() -> Jsoup.connect(url));
        }
        // the fetch failed, so nothing may have been saved
        verifyNoInteractions(fuelPriceRepository);
    }
}

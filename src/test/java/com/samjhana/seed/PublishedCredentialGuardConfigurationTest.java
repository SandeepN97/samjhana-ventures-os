package com.samjhana.seed;

import com.samjhana.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.Banner;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.env.SystemEnvironmentPropertySource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

/**
 * The extra published passwords are set on Render as an environment variable. A name that Spring does not map to the
 * property would fail silently (the check would simply never see the values), so this boots a tiny context with
 * Spring Boot's own property handling and a fake environment instead of trusting the spelling.
 */
class PublishedCredentialGuardConfigurationTest {

    /**
     * An environment that sees only what the test gives it. CI runs every backend job with
     * {@code SPRING_PROFILES_ACTIVE=test}, and the guard is deliberately not loaded in the test profile, so the real
     * system properties and environment variables must not leak in.
     */
    private static StandardEnvironment isolatedEnvironment(Map<String, Object> environmentVariables) {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().replace(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME,
                new MapPropertySource(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME, Map.of()));
        environment.getPropertySources().replace(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                new SystemEnvironmentPropertySource(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                        environmentVariables));
        return environment;
    }

    @Test
    void shouldReadTheExtraPublishedPasswords_fromTheRenderEnvironmentVariable() {
        StandardEnvironment environment =
                isolatedEnvironment(Map.of("SAMJHANA_SECURITY_PUBLISHEDPASSWORDS", "x1-legacy,x2-legacy"));

        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(Wiring.class)
                .web(WebApplicationType.NONE).bannerMode(Banner.Mode.OFF).environment(environment).run()) {
            PublishedCredentialGuard guard = context.getBean(PublishedCredentialGuard.class);

            assertEquals("x1-legacy,x2-legacy", ReflectionTestUtils.getField(guard, "extraPublishedPasswords"));
        }
    }

    @Test
    void shouldTreatTheExtraPublishedPasswordsAsEmpty_whenNothingIsConfigured() {
        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(Wiring.class)
                .web(WebApplicationType.NONE).bannerMode(Banner.Mode.OFF).environment(isolatedEnvironment(Map.of())).run()) {
            PublishedCredentialGuard guard = context.getBean(PublishedCredentialGuard.class);

            assertEquals("", ReflectionTestUtils.getField(guard, "extraPublishedPasswords"));
        }
    }

    @Configuration
    @Import(PublishedCredentialGuard.class)
    static class Wiring {
        @Bean
        UserRepository userRepository() {
            return mock(UserRepository.class);
        }

        @Bean
        PasswordEncoder passwordEncoder() {
            return new BCryptPasswordEncoder(4);
        }
    }
}

package com.samjhana.config;

import com.samjhana.entity.ChargePoint;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@ConfigurationProperties(prefix = "samjhana.ocpp")
@Getter
@Setter
@Slf4j
public class OcppProperties {

    private final Environment environment;
    private Map<String, String> stationSecrets = new LinkedHashMap<>();
    private ChargePoint.LockBehavior defaultLockBehavior = ChargePoint.LockBehavior.EXPLICIT_UNLOCK;

    public OcppProperties(Environment environment) {
        this.environment = environment;
    }

    /**
     * Refuses the charger secrets published in this repository (the {@code dev-*} defaults) anywhere
     * except a developer's machine or the test suite. Staging is reachable from the internet just like
     * prod, so a forgotten OCPP_SECRET_* there would let anyone connect as a charger and feed it fake
     * readings. Decided by the secret's value, not by the profile being "prod".
     */
    @PostConstruct
    void validate() {
        List<String> profiles = Arrays.asList(environment.getActiveProfiles());
        boolean local = profiles.isEmpty() || profiles.contains("dev") || profiles.contains("test");
        boolean insecure = stationSecrets.isEmpty() || stationSecrets.values().stream()
                .anyMatch(secret -> secret == null || secret.isBlank() || secret.startsWith("dev-"));
        if (insecure && !local) {
            throw new IllegalStateException(
                    "OCPP charger secrets are missing or still the published dev defaults (active profiles: "
                    + profiles + "). Set every OCPP_SECRET_* to a random value, e.g. `openssl rand -base64 32`.");
        }
        if (insecure) {
            log.warn("OCPP is using development charger secrets. Configure OCPP_SECRET_* before provisioning hardware.");
        }
    }

    public String secretFor(String chargePointCode) {
        String secret = stationSecrets.get(chargePointCode);
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("No OCPP secret configured for charge point " + chargePointCode);
        }
        return secret;
    }
}

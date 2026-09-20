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

    @PostConstruct
    void validate() {
        boolean prod = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        boolean insecure = stationSecrets.isEmpty() || stationSecrets.values().stream()
                .anyMatch(secret -> secret == null || secret.isBlank() || secret.startsWith("dev-"));
        if (prod && insecure) {
            throw new IllegalStateException(
                    "All OCPP station secrets must be configured with secure non-dev values in production.");
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

package com.samjhana.ocpp.diag;

import org.springframework.boot.logging.LogLevel;
import org.springframework.core.env.Environment;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.Function;

/**
 * Log settings that must never be on while OCPP endpoints are active, because they can print request
 * headers (including the charger's Authorization header) or bound SQL values (including secret hashes).
 */
public final class ForbiddenLogSettings {

    public record Violation(String setting, String why) {}

    private ForbiddenLogSettings() {}

    public static List<Violation> check(Environment env, Function<String, LogLevel> effectiveLevel) {
        List<Violation> found = new ArrayList<>();
        if (env.getProperty("spring.mvc.log-request-details", Boolean.class, false)) {
            found.add(new Violation("spring.mvc.log-request-details=true",
                    "logs request headers and parameters, including the Authorization header"));
        }
        for (String name : List.of("org.springframework.web", "_org.springframework.web")) {
            // the underscore form is Spring's hidden-logger convention (for example the URI parser, which logs queries)
            if (effectiveLevel.apply(name) == LogLevel.TRACE) {
                found.add(new Violation("TRACE on " + name, "can log request headers and query strings"));
            }
        }
        LogLevel socket = effectiveLevel.apply("org.springframework.web.socket");
        if (socket == LogLevel.TRACE || socket == LogLevel.DEBUG) {
            found.add(new Violation(socket + " on org.springframework.web.socket",
                    "logs handshake and message internals outside our masking"));
        }
        LogLevel coyote = effectiveLevel.apply("org.apache.coyote");
        if (coyote == LogLevel.TRACE || coyote == LogLevel.DEBUG) {
            found.add(new Violation(coyote + " on org.apache.coyote (or a DEBUG/TRACE root logger)",
                    "Tomcat prints every raw request, including the Authorization header"));
        }
        boolean hosted = Arrays.stream(env.getActiveProfiles()).anyMatch(p -> p.equals("staging") || p.equals("prod"));
        if (hosted) {
            for (String binder : List.of("org.hibernate.type.descriptor.sql.BasicBinder", "org.hibernate.orm.jdbc.bind")) {
                if (effectiveLevel.apply(binder) == LogLevel.TRACE) {
                    found.add(new Violation("TRACE on " + binder,
                            "prints bound SQL values, including secret hashes, in a hosted environment"));
                }
            }
        }
        return found;
    }
}

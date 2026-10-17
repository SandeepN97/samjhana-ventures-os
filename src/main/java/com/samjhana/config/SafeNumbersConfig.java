package com.samjhana.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.deser.std.NumberDeserializers;
import com.fasterxml.jackson.databind.deser.std.StdScalarDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.samjhana.util.SafeDecimal;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.math.BigDecimal;

/**
 * Makes every {@link BigDecimal} read from a request body go through {@link SafeDecimal}'s limits (findings G-01 and
 * D-01). A money amount written as {@code 1E+1000000000} is cheap to read but makes the arithmetic that follows build a
 * number with a billion digits; it is refused when the request is read (HTTP 400), before any code calculates with it.
 * Spring Boot adds every {@link Module} bean to the shared {@code ObjectMapper}.
 */
@Configuration
public class SafeNumbersConfig {

    @Bean
    public Module safeDecimalModule() {
        SimpleModule module = new SimpleModule("SafeDecimal");
        module.addDeserializer(BigDecimal.class, new SafeBigDecimalDeserializer());
        return module;
    }

    /** Reads a BigDecimal the usual way, then refuses one outside {@link SafeDecimal}'s limits. */
    public static class SafeBigDecimalDeserializer extends StdScalarDeserializer<BigDecimal> {

        public SafeBigDecimalDeserializer() {
            super(BigDecimal.class);
        }

        @Override
        public BigDecimal deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            BigDecimal value = NumberDeserializers.BigDecimalDeserializer.instance.deserialize(parser, context);
            if (value != null && !SafeDecimal.isSafe(value)) {
                context.handleWeirdNumberValue(BigDecimal.class, value,
                        "is outside what this application accepts (at most %d digits, %d places after the point, and 10^%d)",
                        SafeDecimal.MAX_DIGITS, SafeDecimal.MAX_SCALE, SafeDecimal.MAX_POWER);
            }
            return value;
        }
    }
}

package com.samjhana.config;

import com.samjhana.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final Environment environment;

    /**
     * In production, set SAMJHANA_CORS_ALLOWED_ORIGINS to the Vercel frontend URL.
     * The default deliberately omits wildcard '*' — an unset value blocks cross-origin
     * requests from unknown origins rather than opening them.
     */
    @Value("${samjhana.cors.allowed-origins:http://localhost:5173,http://localhost:5175,http://localhost:8080}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        boolean isDevProfile = Arrays.asList(environment.getActiveProfiles()).contains("dev");

        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> {
                auth.requestMatchers(
                    // Auth: only the login endpoint is public (change-password requires auth)
                    "/api/auth/login",
                    // Public read-only data API (samjhana-web public site)
                    "/api/public/**",
                    "/api/fuel-prices/current",
                    // WebSocket handshakes perform protocol-specific authentication.
                    "/ocpp/**",
                    "/ws/ev/**",
                    // Static SPA assets
                    "/",
                    "/index.html",
                    "/assets/**",
                    "/*.js",
                    "/*.css",
                    "/*.ico",
                    // SPA HTML routes (React Router handles auth client-side)
                    "/login",
                    "/entry/**",
                    "/furniture/**",
                    "/records",
                    "/reports/**",
                    "/settings",
                    "/pending",
                    "/fuel-prices",
                    "/fuel-orders",
                    "/staff",
                    "/ev-vehicles",
                    "/ev-electricity",
                    "/ev-manual",
                    "/analytics",
                    // Public ecommerce routes
                    "/api/ecommerce/products",
                    "/api/ecommerce/products/**",
                    "/api/ecommerce/auth/**",
                    "/shop",
                    "/shop/**"
                ).permitAll();

                // H2 console and Swagger/OpenAPI docs: dev only
                if (isDevProfile) {
                    auth.requestMatchers(
                        "/h2-console/**",
                        "/swagger-ui/**",
                        "/api-docs/**"
                    ).permitAll();
                }

                auth.anyRequest().authenticated();
            })
            .exceptionHandling(ex -> ex.authenticationEntryPoint(
                (request, response, authException) -> response.sendError(401, "Unauthorized")))
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();

        // Never fall back to '*' — if origins are somehow empty, allow nothing.
        config.setAllowedOrigins(origins.isEmpty() ? List.of() : origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}

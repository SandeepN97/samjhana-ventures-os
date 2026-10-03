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
import org.springframework.security.web.header.writers.ContentSecurityPolicyHeaderWriter;
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.util.matcher.AnyRequestMatcher;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
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
    static final String CONTENT_SECURITY_POLICY =
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            + "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; "
            + "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

    @Value("${samjhana.cors.allowed-origins:http://localhost:5173,http://localhost:5175,http://localhost:8080}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        boolean isDevProfile = Arrays.asList(environment.getActiveProfiles()).contains("dev");

        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .headers(headers -> headers
                .frameOptions(frame -> frame.sameOrigin())
                // Render terminates TLS, so the app itself never sees HTTPS and Spring would skip HSTS.
                // Send it on every response; browsers ignore it on plain-http localhost.
                .httpStrictTransportSecurity(hsts -> hsts
                    .requestMatcher(AnyRequestMatcher.INSTANCE)
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000))
                .referrerPolicy(referrer -> referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.SAME_ORIGIN))
                // Only this app's own scripts may run, so an injected <script> can't read the login token.
                // Not applied to the dev-only H2 console and Swagger UI, which rely on inline scripts.
                .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(
                    new NegatedRequestMatcher(new OrRequestMatcher(
                        new AntPathRequestMatcher("/h2-console/**"),
                        new AntPathRequestMatcher("/swagger-ui/**"))),
                    new ContentSecurityPolicyHeaderWriter(CONTENT_SECURITY_POLICY))))
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
                    "/beekeeping/**",
                    "/website/**",
                    "/restaurant-menu/**",
                    "/online-orders/**",
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
                    "/rental-properties",
                    "/rental-tenants"
                    // (The old /api/ecommerce/** and /shop/** entries were removed: nothing serves them,
                    // and an open rule waiting for a future controller would make it public by accident.)
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

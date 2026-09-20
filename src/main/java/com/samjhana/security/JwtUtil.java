package com.samjhana.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;

@Component
@Slf4j
public class JwtUtil {

    private static final String DEV_FALLBACK_PREFIX = "dev-only-insecure";

    private final SecretKey key;
    private final long expirationMs;

    public JwtUtil(
            @Value("${samjhana.security.jwt.secret}") String secret,
            @Value("${samjhana.security.jwt.expiration-hours}") long expirationHours,
            Environment environment) {

        boolean isProd = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (isProd && secret.startsWith(DEV_FALLBACK_PREFIX)) {
            throw new IllegalStateException(
                "JWT_SECRET is using the dev fallback value in a production profile. " +
                "Set JWT_SECRET to a secure random string of 32+ characters.");
        }
        if (secret.startsWith(DEV_FALLBACK_PREFIX)) {
            log.warn("JWT secret is using the dev fallback value. Set JWT_SECRET for production.");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            log.warn("JWT secret is shorter than 32 bytes — use a longer secret in production.");
        }

        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationHours * 3600 * 1000;
    }

    public String generateToken(String username) {
        return Jwts.builder()
                .subject(username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }

    public String extractUsername(String token) {
        return extractClaims(token).getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            Claims claims = extractClaims(token);
            return !claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    private Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}

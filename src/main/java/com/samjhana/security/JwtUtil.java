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

    // .env.example ships this literally so an operator who copies it without editing it — rather
    // than one who never sets JWT_SECRET at all — must also be refused, not just warned.
    private static final String ENV_EXAMPLE_PLACEHOLDER = "change-me-to-a-random-string-of-at-least-32-characters";

    private final SecretKey key;
    private final long expirationMs;

    public JwtUtil(
            @Value("${samjhana.security.jwt.secret}") String secret,
            @Value("${samjhana.security.jwt.expiration-hours}") long expirationHours,
            Environment environment) {

        // Refuse a published placeholder because of its value, not because of a profile name: a
        // staging, preview or unlabeled deployment that is reachable from the internet must not be
        // able to sign sessions with a secret that is public in this repository — whether that's
        // the application.yml dev fallback, or .env.example's placeholder copied in unedited.
        if (secret.startsWith(DEV_FALLBACK_PREFIX) || secret.equals(ENV_EXAMPLE_PLACEHOLDER)) {
            throw new IllegalStateException(
                "JWT_SECRET is still a published placeholder value (active profiles: " +
                Arrays.toString(environment.getActiveProfiles()) + "). " +
                "Set JWT_SECRET to a random string of at least 32 bytes, e.g. `openssl rand -base64 48`.");
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

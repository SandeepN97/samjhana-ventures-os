package com.samjhana.security;

import com.samjhana.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.Optional;

@Component
@Slf4j
public class JwtUtil {

    private static final String DEV_FALLBACK_PREFIX = "dev-only-insecure";

    // .env.example ships this literally so an operator who copies it without editing it — rather
    // than one who never sets JWT_SECRET at all — must also be refused, not just warned.
    private static final String ENV_EXAMPLE_PLACEHOLDER = "change-me-to-a-random-string-of-at-least-32-characters";

    /**
     * Claim holding a keyed fingerprint of the user's password hash at the time the token was issued.
     * Changing the password changes the hash, so every token issued before the change stops matching
     * and is refused, without keeping a server-side list of revoked tokens.
     */
    static final String PASSWORD_FINGERPRINT_CLAIM = "pwd";

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

    public String generateToken(User user) {
        return Jwts.builder()
                .subject(user.getUsername())
                .claim(PASSWORD_FINGERPRINT_CLAIM, passwordFingerprint(user.getPassword()))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }

    public String extractUsername(String token) {
        return extractClaims(token).getSubject();
    }

    /** Signature and expiry only. Use {@link #isTokenValidFor} to also check the account is still allowed in. */
    public boolean isTokenValid(String token) {
        return parse(token).isPresent();
    }

    /** The token's claims if its signature and expiry are good, otherwise empty. */
    public Optional<Claims> parse(String token) {
        try {
            Claims claims = extractClaims(token);
            return claims.getExpiration().before(new Date()) ? Optional.empty() : Optional.of(claims);
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /**
     * True only if the token belongs to this user, the account is still active, and the password
     * hasn't changed since the token was issued. A deactivated user or a changed password therefore
     * logs out every existing session on the next request.
     */
    public boolean isTokenValidFor(Claims claims, User user) {
        if (user == null || !user.isEnabled() || !user.getUsername().equals(claims.getSubject())) {
            return false;
        }
        String issuedFor = claims.get(PASSWORD_FINGERPRINT_CLAIM, String.class);
        if (issuedFor == null) {
            return false;   // issued before fingerprints existed: log in again
        }
        return MessageDigest.isEqual(
                issuedFor.getBytes(StandardCharsets.US_ASCII),
                passwordFingerprint(user.getPassword()).getBytes(StandardCharsets.US_ASCII));
    }

    /** HMAC of the password hash with the signing key, so the claim reveals nothing about the hash itself. */
    private String passwordFingerprint(String passwordHash) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            byte[] digest = mac.doFinal(String.valueOf(passwordHash).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(Arrays.copyOf(digest, 16));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
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

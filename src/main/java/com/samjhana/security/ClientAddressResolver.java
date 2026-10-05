package com.samjhana.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Works out which internet address a request really came from, for the login limits.
 *
 * <p>Behind Render, the address arrives in the {@code X-Forwarded-For} list. Render does not clear what a
 * visitor sends, it only adds entries on the right, so the left side can be faked. This reads from the
 * RIGHT: with {@code trustedProxyHops} = 0 the right-most entry (the one the nearest proxy added) is the
 * client; each trusted proxy that adds its own entry after it raises the setting by one
 * ({@code SAMJHANA_TRUSTED_PROXY_HOPS}). With no header at all (local development) the connecting
 * address is used. Anything that is not a plain address gives no answer, and the address limits then
 * simply do not apply to that request.
 *
 * <p>Addresses are used only as in-memory counter keys. They are never saved or logged.
 */
@Component
public class ClientAddressResolver {

    private static final int MAX_ENTRY_LENGTH = 45;
    private static final Pattern IPV4 = Pattern.compile("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$");
    private static final Pattern IPV6 = Pattern.compile("^[0-9a-f:.]+$");

    private final int trustedProxyHops;

    public ClientAddressResolver(@Value("${samjhana.security.trusted-proxy-hops:0}") int trustedProxyHops) {
        this.trustedProxyHops = Math.max(0, trustedProxyHops);
    }

    public int trustedProxyHops() {
        return trustedProxyHops;
    }

    /** The raw header, as the visitor and the proxies sent it, or null. */
    public String forwardedFor(HttpServletRequest request) {
        return request.getHeader("X-Forwarded-For");
    }

    public Optional<String> resolve(HttpServletRequest request) {
        String header = forwardedFor(request);
        if (header == null) {
            return clean(request.getRemoteAddr());
        }
        List<String> entries = new ArrayList<>();
        for (String part : header.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) entries.add(trimmed);
        }
        int index = entries.size() - 1 - trustedProxyHops;
        if (index < 0) {
            return Optional.empty();
        }
        return clean(entries.get(index));
    }

    private static Optional<String> clean(String raw) {
        if (raw == null) return Optional.empty();
        String value = raw.trim().toLowerCase(Locale.ROOT);
        if (value.isEmpty() || value.length() > MAX_ENTRY_LENGTH) return Optional.empty();
        // "1.2.3.4:5678" -> "1.2.3.4" (an IPv6 address has more than one colon, so it is left alone)
        int firstColon = value.indexOf(':');
        if (firstColon > 0 && firstColon == value.lastIndexOf(':')) {
            value = value.substring(0, firstColon);
        }
        var v4 = IPV4.matcher(value);
        if (v4.matches()) {
            for (int i = 1; i <= 4; i++) {
                if (Integer.parseInt(v4.group(i)) > 255) return Optional.empty();
            }
            return Optional.of(value);
        }
        if (value.indexOf(':') >= 0 && IPV6.matcher(value).matches()) {
            return Optional.of(value);
        }
        return Optional.empty();
    }
}

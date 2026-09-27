package com.samjhana.websocket;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Short-lived, single-use tickets for opening the live EV WebSocket.
 *
 * <p>Browsers can't set an Authorization header on a WebSocket, so the connection has to carry its
 * credential in the URL, and URLs end up in proxy and server logs. Putting the 7-day login token
 * there would leak it; a ticket that works once, within 30 seconds, is worthless by the time
 * anyone reads a log.
 */
@Component
public class LiveTicketService {

    static final Duration TICKET_LIFETIME = Duration.ofSeconds(30);

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Issued> tickets = new ConcurrentHashMap<>();
    private final Clock clock;

    public LiveTicketService() {
        this(Clock.systemUTC());
    }

    LiveTicketService(Clock clock) {
        this.clock = clock;
    }

    public String issue(String username) {
        dropExpired();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String ticket = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tickets.put(ticket, new Issued(username, clock.instant().plus(TICKET_LIFETIME)));
        return ticket;
    }

    /** The username the ticket was issued to, if it is unused and unexpired. A ticket works once. */
    public Optional<String> redeem(String ticket) {
        if (ticket == null) return Optional.empty();
        Issued issued = tickets.remove(ticket);
        if (issued == null || issued.expiresAt().isBefore(clock.instant())) return Optional.empty();
        return Optional.of(issued.username());
    }

    private void dropExpired() {
        Instant now = clock.instant();
        tickets.values().removeIf(issued -> issued.expiresAt().isBefore(now));
    }

    private record Issued(String username, Instant expiresAt) {}
}

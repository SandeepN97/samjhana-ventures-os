package com.samjhana.websocket;

import com.samjhana.exception.TooManyRequestsException;
import com.samjhana.security.RequestThrottle;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
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
 *
 * <p>Asking for tickets is limited (finding D-02): one person gets {@value #MAX_TICKETS_PER_PERSON} a minute (a
 * screen asks once each time it connects) and only {@value #MAX_WAITING} can be waiting to be used at any moment,
 * so a signed-in account cannot make the server hold an unlimited number of them.
 */
@Component
public class LiveTicketService {

    static final Duration TICKET_LIFETIME = Duration.ofSeconds(30);
    /** Tickets one person may ask for within {@link #TICKET_WINDOW}. */
    static final int MAX_TICKETS_PER_PERSON = 10;
    static final Duration TICKET_WINDOW = Duration.ofMinutes(1);
    /** Tickets that can be waiting to be used, whoever asked for them. */
    static final int MAX_WAITING = 1_000;

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Issued> tickets = new ConcurrentHashMap<>();
    private final Clock clock;
    private final RequestThrottle throttle;

    @Autowired
    public LiveTicketService(RequestThrottle throttle) {
        this(Clock.systemUTC(), throttle);
    }

    LiveTicketService(Clock clock, RequestThrottle throttle) {
        this.clock = clock;
        this.throttle = throttle;
    }

    /** A new ticket for this person, or {@link TooManyRequestsException} when they (or everybody) asked too often. */
    public String issue(String username) {
        if (!throttle.tryAcquire("live-ticket:" + username, MAX_TICKETS_PER_PERSON, TICKET_WINDOW)) {
            throw new TooManyRequestsException("Too many live-update requests just now. Please wait a moment and try again.");
        }
        if (tickets.size() >= MAX_WAITING) {
            dropExpired();
            if (tickets.size() >= MAX_WAITING) {
                throw new TooManyRequestsException("The live updates are busy. Please try again in a moment.");
            }
        }
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

    /** Forgets tickets nobody used in time, so a request never has to scan for them. */
    @Scheduled(fixedDelayString = "PT30S")
    void forgetExpired() {
        dropExpired();
    }

    /** How many tickets are waiting to be used (or to expire). */
    int waiting() {
        return tickets.size();
    }

    private void dropExpired() {
        Instant now = clock.instant();
        tickets.values().removeIf(issued -> issued.expiresAt().isBefore(now));
    }

    private record Issued(String username, Instant expiresAt) {}
}

package com.samjhana.websocket;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;

import java.time.Clock;
import java.time.Duration;
import java.util.Optional;

/**
 * Keeps a live-feed socket from outliving the sign-in that opened it (finding P1b-06).
 *
 * <p>A socket is allowed in once, with a one-time ticket. Without this, a person whose account was switched off, whose
 * password was changed or reset, or whose role was changed would go on receiving every charging session (number
 * plate, customer name, amount) for as long as the socket happened to stay open. Every few seconds the account behind
 * each open socket is looked at again; a socket whose account is gone, switched off, or no longer matches how it was
 * when the socket was opened is closed, and the screen has to ask for a new ticket (which the account's own checks
 * then allow or refuse). Sockets are also closed after {@link #MAX_SOCKET_AGE}, whoever they belong to.
 */
@Component
@Slf4j
public class LiveFeedWatchdog {

    /** How long a socket may stay open before its screen has to connect again and be checked from scratch. */
    static final Duration MAX_SOCKET_AGE = Duration.ofHours(12);

    static final CloseStatus ACCOUNT_CHANGED = new CloseStatus(4401, "Sign in again");
    static final CloseStatus REFRESH = CloseStatus.SERVICE_RESTARTED.withReason("Connection refreshed");

    private final EvLiveWebSocketHandler hub;
    private final UserRepository userRepository;
    private final Clock clock;

    @Autowired
    public LiveFeedWatchdog(EvLiveWebSocketHandler hub, UserRepository userRepository) {
        this(hub, userRepository, Clock.systemUTC());
    }

    LiveFeedWatchdog(EvLiveWebSocketHandler hub, UserRepository userRepository, Clock clock) {
        this.hub = hub;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "PT15S", initialDelayString = "PT15S")
    public void recheck() {
        for (String username : hub.connectedUsernames()) {
            try {
                Optional<User> user = userRepository.findByUsername(username);
                int closed = hub.closeSocketsOf(username, stamp -> isOutOfDate(user, stamp), ACCOUNT_CHANGED);
                if (closed > 0) log.info("Closed {} live-feed socket(s) whose account no longer matches how it was when they opened", closed);
            } catch (RuntimeException ex) {
                // One person's lookup failing must not leave everybody else unchecked.
                log.warn("Could not re-check one person's live-feed sign-in", ex);
            }
        }
        hub.closeSocketsOpenedBefore(clock.instant().minus(MAX_SOCKET_AGE), REFRESH);
    }

    private static boolean isOutOfDate(Optional<User> user, AccountStamp stampWhenOpened) {
        return user.isEmpty()
                || !user.get().isEnabled()
                || stampWhenOpened == null
                || !stampWhenOpened.equals(AccountStamp.of(user.get()));
    }
}

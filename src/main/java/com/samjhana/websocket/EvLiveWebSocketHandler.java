package com.samjhana.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * The live EV feed: every open kiosk or staff screen is a socket here, and each charging event is sent to all of them.
 *
 * <p>An event is handed to each socket's own small queue and written out by a sender thread, so the thread that
 * publishes it - the one that has just committed a charging session, or a staff request, or a charger's own socket -
 * never waits for a socket and never gets an error back from one. A socket whose reader has stopped, or that fails
 * to write, is closed on its own; the others carry on (finding D-02).
 *
 * <p>Nobody can hold an unlimited number of sockets: one person may have {@value #MAX_SOCKETS_PER_PERSON} (a sixth
 * closes their oldest) and the feed carries at most {@value #MAX_SOCKETS} in all. {@link LiveFeedWatchdog} closes the
 * sockets of people whose account has changed, and sockets that have been open for too long.
 */
@Component
@Slf4j
public class EvLiveWebSocketHandler extends TextWebSocketHandler {

    /** The most sockets one person may have open. Opening another closes their oldest. */
    static final int MAX_SOCKETS_PER_PERSON = 5;
    /** The most sockets the whole app carries. A new one beyond this is refused. */
    static final int MAX_SOCKETS = 100;
    /** Events waiting for one socket. A socket that falls this far behind is not keeping up and is closed. */
    static final int MAX_EVENTS_WAITING_PER_SOCKET = 100;

    static final CloseStatus REPLACED = CloseStatus.POLICY_VIOLATION.withReason("Replaced by a newer connection");
    static final CloseStatus FEED_FULL = CloseStatus.SERVICE_OVERLOAD.withReason("Too many connections, try again later");
    static final CloseStatus NOT_KEEPING_UP = CloseStatus.SESSION_NOT_RELIABLE.withReason("Not keeping up with the feed");

    private final ObjectMapper objectMapper;
    private final ExecutorService sender;
    private final Clock clock;

    private final Map<String, LiveFeedSubscriber> subscribers = new ConcurrentHashMap<>();
    private final Object admission = new Object();
    private final AtomicLong opened = new AtomicLong();

    @Autowired
    public EvLiveWebSocketHandler(ObjectMapper objectMapper) {
        this(objectMapper, newSenderPool(), Clock.systemUTC());
    }

    EvLiveWebSocketHandler(ObjectMapper objectMapper, ExecutorService sender, Clock clock) {
        this.objectMapper = objectMapper;
        this.sender = sender;
        this.clock = clock;
    }

    /**
     * Threads that write to sockets. A socket nobody reads from holds one of them until the container gives up on the
     * write, so there are enough of them that a few such sockets cannot keep the others waiting. Idle threads end.
     */
    private static ExecutorService newSenderPool() {
        AtomicInteger counter = new AtomicInteger();
        ThreadPoolExecutor pool = new ThreadPoolExecutor(16, 16, 30, TimeUnit.SECONDS, new LinkedBlockingQueue<>(512), task -> {
            Thread thread = new Thread(task, "ev-live-sender-" + counter.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        });
        pool.allowCoreThreadTimeOut(true);
        return pool;
    }

    @PreDestroy
    void stop() {
        sender.shutdownNow();
    }

    // ------------------------------------------------------------------ sockets

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Object attribute = session.getAttributes().get("username");
        if (!(attribute instanceof String username) || username.isBlank()) {
            closeInBackground(session, CloseStatus.POLICY_VIOLATION.withReason("Not signed in"));   // cannot happen through the handshake
            return;
        }
        AccountStamp stamp = session.getAttributes().get(AccountStamp.ATTRIBUTE) instanceof AccountStamp known ? known : null;
        LiveFeedSubscriber subscriber = new LiveFeedSubscriber(session, username, stamp, clock.instant(),
                opened.incrementAndGet(), MAX_EVENTS_WAITING_PER_SOCKET);

        List<LiveFeedSubscriber> replaced = new ArrayList<>();
        boolean refused = false;
        synchronized (admission) {
            List<LiveFeedSubscriber> theirs = subscribers.values().stream()
                    .filter(other -> other.username().equals(username))
                    .sorted(Comparator.comparingLong(LiveFeedSubscriber::sequence))
                    .toList();
            int toReplace = Math.max(0, theirs.size() - MAX_SOCKETS_PER_PERSON + 1);
            if (subscribers.size() - toReplace >= MAX_SOCKETS) {
                refused = true;
            } else {
                for (int i = 0; i < toReplace; i++) {
                    subscribers.remove(theirs.get(i).id(), theirs.get(i));
                    replaced.add(theirs.get(i));
                }
                subscribers.put(session.getId(), subscriber);
            }
        }
        if (refused) {
            closeInBackground(session, FEED_FULL);
            return;
        }
        replaced.forEach(old -> drop(old, REPLACED));
        deliver(subscriber, connectedFrame());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        LiveFeedSubscriber subscriber = subscribers.remove(session.getId());
        if (subscriber != null) subscriber.markClosed();
    }

    // ------------------------------------------------------------------ events

    /** Hands the event to every open socket. Never waits for a socket and never throws. */
    public void publish(String type, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(Map.of(
                    "type", type,
                    "at", LocalDateTime.now().toString(),
                    "payload", payload));
            for (LiveFeedSubscriber subscriber : subscribers.values()) {
                deliver(subscriber, json);
            }
        } catch (Exception ex) {
            // A live update that cannot be sent must never fail the work that caused it.
            log.warn("Could not broadcast EV live event {}", type, ex);
        }
    }

    private String connectedFrame() {
        try {
            return objectMapper.writeValueAsString(Map.of("type", "CONNECTED", "at", LocalDateTime.now().toString()));
        } catch (Exception ex) {
            return "{\"type\":\"CONNECTED\"}";
        }
    }

    private void deliver(LiveFeedSubscriber subscriber, String json) {
        switch (subscriber.offer(json)) {
            case QUEUED_START_SENDER -> startSender(subscriber);
            case TOO_SLOW -> drop(subscriber, NOT_KEEPING_UP);
            case QUEUED, CLOSED -> { }
        }
    }

    private void startSender(LiveFeedSubscriber subscriber) {
        try {
            sender.execute(() -> send(subscriber));
        } catch (RejectedExecutionException ex) {
            drop(subscriber, NOT_KEEPING_UP);   // shutting down
        }
    }

    /** Writes this socket's waiting events, in order, until none are left. Runs on a sender thread. */
    private void send(LiveFeedSubscriber subscriber) {
        String json;
        while ((json = subscriber.nextToSend()) != null) {
            try {
                subscriber.session().sendMessage(new TextMessage(json));
            } catch (Exception ex) {
                log.debug("Closing EV live-feed socket {} after a failed write: {}", subscriber.id(), ex.toString());
                drop(subscriber, NOT_KEEPING_UP);
                return;
            }
        }
    }

    // ------------------------------------------------------------------ closing

    /** Stops sending to the socket and closes it, without making the caller wait for the close to finish. */
    private void drop(LiveFeedSubscriber subscriber, CloseStatus status) {
        if (!subscriber.markClosed()) return;
        subscribers.remove(subscriber.id(), subscriber);
        closeInBackground(subscriber.session(), status);
    }

    private void closeInBackground(WebSocketSession session, CloseStatus status) {
        try {
            sender.execute(() -> {
                try {
                    session.close(status);
                } catch (Exception ex) {
                    log.debug("EV live-feed socket {} was already gone: {}", session.getId(), ex.toString());
                }
            });
        } catch (RejectedExecutionException ex) {
            // shutting down: the container closes every socket anyway
        }
    }

    // ------------------------------------------------------------------ for LiveFeedWatchdog

    /** The people who have at least one socket open right now. */
    Set<String> connectedUsernames() {
        return subscribers.values().stream().map(LiveFeedSubscriber::username).collect(Collectors.toSet());
    }

    /** Closes this person's sockets whose sign-in no longer matches (or never had) the stamp taken when they opened. */
    int closeSocketsOf(String username, Predicate<AccountStamp> isOutOfDate, CloseStatus status) {
        return closeWhere(subscriber -> subscriber.username().equals(username) && isOutOfDate.test(subscriber.stamp()), status);
    }

    /** Closes the sockets opened before the cutoff. */
    int closeSocketsOpenedBefore(Instant cutoff, CloseStatus status) {
        return closeWhere(subscriber -> subscriber.openedAt().isBefore(cutoff), status);
    }

    private int closeWhere(Predicate<LiveFeedSubscriber> test, CloseStatus status) {
        int closed = 0;
        for (LiveFeedSubscriber subscriber : List.copyOf(subscribers.values())) {
            if (test.test(subscriber)) {
                drop(subscriber, status);
                closed++;
            }
        }
        return closed;
    }

    /** How many sockets are open. */
    int socketCount() {
        return subscribers.size();
    }
}

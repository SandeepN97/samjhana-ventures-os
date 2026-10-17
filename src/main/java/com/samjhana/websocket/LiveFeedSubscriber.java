package com.samjhana.websocket;

import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.ArrayDeque;

/**
 * One open live-feed socket and the events waiting to be written to it.
 *
 * <p>Whoever publishes an event only ever puts it in this small queue, which never waits for the network; a sender
 * thread writes the queue out, one event at a time, so the events of one socket stay in order and a socket whose
 * reader has stopped reading holds up nobody but itself.
 */
final class LiveFeedSubscriber {

    /** What happened to an event handed to {@link #offer}. */
    enum Offered {
        /** Queued, and nothing was writing this socket: the caller must start a sender for it. */
        QUEUED_START_SENDER,
        /** Queued behind a sender that is already running. */
        QUEUED,
        /** Not queued: this socket already has too many events waiting. It is not keeping up. */
        TOO_SLOW,
        /** Not queued: the socket was already closed or dropped. */
        CLOSED
    }

    private final WebSocketSession session;
    private final String username;
    private final AccountStamp stamp;
    private final Instant openedAt;
    private final long sequence;
    private final int maxQueued;

    private final Object lock = new Object();
    private final ArrayDeque<String> pending = new ArrayDeque<>();
    private boolean sending;
    private boolean closed;

    /** {@code sequence} numbers the sockets in the order they were opened; the lowest is the oldest. */
    LiveFeedSubscriber(WebSocketSession session, String username, AccountStamp stamp, Instant openedAt, long sequence, int maxQueued) {
        this.session = session;
        this.username = username;
        this.stamp = stamp;
        this.openedAt = openedAt;
        this.sequence = sequence;
        this.maxQueued = maxQueued;
    }

    WebSocketSession session() { return session; }
    String id() { return session.getId(); }
    String username() { return username; }
    AccountStamp stamp() { return stamp; }
    Instant openedAt() { return openedAt; }
    long sequence() { return sequence; }

    /** Puts an event in the queue. Never waits for the network. */
    Offered offer(String json) {
        synchronized (lock) {
            if (closed) return Offered.CLOSED;
            if (pending.size() >= maxQueued) return Offered.TOO_SLOW;
            pending.add(json);
            if (sending) return Offered.QUEUED;
            sending = true;
            return Offered.QUEUED_START_SENDER;
        }
    }

    /** The next event to write, or null when there is none (or the socket was closed), which also ends the sender. */
    String nextToSend() {
        synchronized (lock) {
            String next = closed ? null : pending.poll();
            if (next == null) sending = false;
            return next;
        }
    }

    /** Marks the socket closed and forgets what was waiting. True only for the call that did it. */
    boolean markClosed() {
        synchronized (lock) {
            if (closed) return false;
            closed = true;
            pending.clear();
            return true;
        }
    }
}

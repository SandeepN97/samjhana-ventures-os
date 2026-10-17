package com.samjhana.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Findings D-02 and P1b-06 - the live EV feed. An event is handed to every open socket without the thread that
 * publishes it ever waiting for a socket, a socket that stops reading or fails cannot hold up the others or send an
 * error back to whoever published, and nobody can hold an unlimited number of sockets.
 */
@Timeout(value = 20, unit = TimeUnit.SECONDS)   // a publisher stuck behind a stalled socket fails the test instead of hanging it
class EvLiveWebSocketHandlerTest {

    private static final AccountStamp STAMP = new AccountStamp(User.UserRole.STAFF, "digest");

    private final ObjectMapper mapper = new ObjectMapper();
    private final EvLiveWebSocketHandler hub = new EvLiveWebSocketHandler(mapper);
    private final List<CountDownLatch> toRelease = new ArrayList<>();

    @AfterEach
    void releaseAnySocketTheTestLeftWaiting() {
        toRelease.forEach(CountDownLatch::countDown);
    }

    private final List<List<String>> everything = new ArrayList<>();

    /** A socket that records what is written to it. */
    private WebSocketSession socket(String id, String username) throws IOException {
        List<String> received = new CopyOnWriteArrayList<>();
        everything.add(received);
        WebSocketSession session = mock(WebSocketSession.class);
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("username", username);
        attributes.put(AccountStamp.ATTRIBUTE, STAMP);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        when(session.getAttributes()).thenReturn(attributes);
        doAnswer(call -> { received.add(((TextMessage) call.getArgument(0)).getPayload()); return null; })
                .when(session).sendMessage(any());
        return session;
    }

    private static List<String> receivedBy(WebSocketSession session) throws IOException {
        ArgumentCaptor<TextMessage> sent = ArgumentCaptor.forClass(TextMessage.class);
        verify(session, org.mockito.Mockito.atLeast(0)).sendMessage(sent.capture());
        return sent.getAllValues().stream().map(TextMessage::getPayload).toList();
    }

    /** A socket that works until the test sets {@code failure}, and then fails every write with it. */
    private WebSocketSession flakySocket(String id, String username, AtomicReference<Throwable> failure) throws IOException {
        WebSocketSession session = socket(id, username);
        List<String> received = everything.get(everything.size() - 1);
        doAnswer(call -> {
            if (failure.get() != null) throw failure.get();
            received.add(((TextMessage) call.getArgument(0)).getPayload());
            return null;
        }).when(session).sendMessage(any());
        return session;
    }

    /** A socket whose reader has stopped: every write waits until the test lets it go. */
    private WebSocketSession stalledSocket(String id, String username) throws IOException {
        WebSocketSession session = socket(id, username);
        CountDownLatch stall = new CountDownLatch(1);
        toRelease.add(stall);
        doAnswer(call -> { stall.await(30, TimeUnit.SECONDS); return null; }).when(session).sendMessage(any());
        return session;
    }

    /** Waits until the socket with this index in {@code everything} has been written {@code count} messages. */
    private void waitUntilReceived(int index, int count) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (everything.get(index).size() < count) {
            if (System.nanoTime() > deadline) throw new AssertionError("socket " + index + " did not get " + count + " messages in time");
            Thread.sleep(1);
        }
    }

    private String typeOf(String json) throws IOException {
        JsonNode node = mapper.readTree(json);
        return node.get("type").asText() + (node.has("payload") ? ":" + node.get("payload").get("n").asText() : "");
    }

    // ------------------------------------------------------------------ delivery

    @Test
    void shouldHandEveryEventToEveryOpenSocketInOrder() throws Exception {
        WebSocketSession a = socket("a", "sita");
        WebSocketSession b = socket("b", "ram");
        hub.afterConnectionEstablished(a);
        hub.afterConnectionEstablished(b);

        for (int n = 1; n <= 3; n++) hub.publish("CHARGE_SESSION_UPDATED", Map.of("n", n));

        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
            assertThat(everything.get(0)).hasSize(4);   // the CONNECTED frame and three events
            assertThat(everything.get(1)).hasSize(4);
        });
        List<String> seenByA = new ArrayList<>();
        for (String json : everything.get(0)) seenByA.add(typeOf(json));
        assertThat(seenByA).containsExactly("CONNECTED", "CHARGE_SESSION_UPDATED:1", "CHARGE_SESSION_UPDATED:2", "CHARGE_SESSION_UPDATED:3");
    }

    @Test
    void shouldSendTheConnectedFrameBeforeAnyEvent() throws Exception {
        WebSocketSession a = socket("a", "sita");
        hub.afterConnectionEstablished(a);
        hub.publish("CHARGE_POINT_UPDATED", Map.of("n", 1));

        await().atMost(5, TimeUnit.SECONDS).until(() -> everything.get(0).size() == 2);
        assertThat(typeOf(everything.get(0).get(0))).isEqualTo("CONNECTED");
    }

    @Test
    void shouldStopSendingToASocketThatClosed() throws Exception {
        WebSocketSession a = socket("a", "sita");
        hub.afterConnectionEstablished(a);
        await().atMost(5, TimeUnit.SECONDS).until(() -> everything.get(0).size() == 1);

        hub.afterConnectionClosed(a, CloseStatus.NORMAL);
        hub.publish("CHARGE_POINT_UPDATED", Map.of("n", 1));

        Thread.sleep(200);
        assertThat(everything.get(0)).hasSize(1);
    }

    // ------------------------------------------------------------------ a socket that does not keep up (D-02)

    @Test
    void shouldNotWaitForASocketThatHasStoppedReading() throws Exception {
        WebSocketSession stalled = stalledSocket("stalled", "sita");
        WebSocketSession healthy = socket("healthy", "ram");
        hub.afterConnectionEstablished(stalled);
        hub.afterConnectionEstablished(healthy);

        long started = System.nanoTime();
        for (int n = 1; n <= 50; n++) hub.publish("CHARGE_SESSION_UPDATED", Map.of("n", n));
        long tookMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);

        assertThat(tookMillis).as("time the publishing thread spent publishing 50 events").isLessThan(1_000);
        await().atMost(5, TimeUnit.SECONDS).until(() -> everything.get(1).size() == 51);   // the healthy one got them all
    }

    @Test
    void shouldCloseASocketThatFallsFarBehind_andKeepServingTheOthers() throws Exception {
        WebSocketSession stalled = stalledSocket("stalled", "sita");
        WebSocketSession healthy = socket("healthy", "ram");
        hub.afterConnectionEstablished(stalled);
        hub.afterConnectionEstablished(healthy);

        for (int n = 1; n <= 400; n++) {
            hub.publish("CHARGE_SESSION_UPDATED", Map.of("n", n));
            waitUntilReceived(1, n + 1);   // events come at a human pace: the healthy socket keeps up with them
        }

        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> verify(stalled).close(any(CloseStatus.class)));
        assertThat(everything.get(1)).hasSize(401);
        verify(healthy, never()).close(any(CloseStatus.class));
    }

    @Test
    void shouldNeverLetAFailingSocketReachWhoeverPublished() throws Exception {
        AtomicReference<Throwable> failure = new AtomicReference<>();
        WebSocketSession healthy = socket("healthy", "ram");
        WebSocketSession broken = flakySocket("broken", "sita", failure);
        hub.afterConnectionEstablished(healthy);
        hub.afterConnectionEstablished(broken);
        await().atMost(5, TimeUnit.SECONDS).until(() -> everything.get(0).size() == 1 && everything.get(1).size() == 1);

        failure.set(new IllegalStateException("The remote endpoint was in state [TEXT_FULL_WRITING]"));   // the unchecked kind
        hub.publish("CHARGE_SESSION_UPDATED", Map.of("n", 1));   // must not throw
        hub.publish("CHARGE_SESSION_UPDATED", Map.of("n", 2));

        await().atMost(5, TimeUnit.SECONDS).until(() -> everything.get(0).size() == 3);   // CONNECTED and two events
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> verify(broken).close(any(CloseStatus.class)));
    }

    @Test
    void shouldNeverLetAnIoFailureOfASocketReachWhoeverPublished() throws Exception {
        AtomicReference<Throwable> failure = new AtomicReference<>();
        WebSocketSession broken = flakySocket("broken", "sita", failure);
        hub.afterConnectionEstablished(broken);
        await().atMost(5, TimeUnit.SECONDS).until(() -> everything.get(0).size() == 1);

        failure.set(new IOException("Broken pipe"));
        hub.publish("CHARGE_SESSION_UPDATED", Map.of("n", 1));

        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> verify(broken).close(any(CloseStatus.class)));
    }

    @Test
    void shouldNotThrow_whenTheEventCannotBeTurnedIntoJson() throws Exception {
        WebSocketSession a = socket("a", "sita");
        hub.afterConnectionEstablished(a);
        await().atMost(5, TimeUnit.SECONDS).until(() -> everything.get(0).size() == 1);

        hub.publish("CHARGE_POINT_UPDATED", new Object() { public Object getSelf() { return this; } });   // endless loop in the payload

        Thread.sleep(200);
        assertThat(everything.get(0)).hasSize(1);   // only the CONNECTED frame
    }

    // ------------------------------------------------------------------ limits on sockets (D-02)

    @Test
    void shouldKeepAtMostFiveSocketsPerPerson_closingTheOldestOne() throws Exception {
        List<WebSocketSession> sita = new ArrayList<>();
        for (int n = 1; n <= 6; n++) {
            WebSocketSession s = socket("sita-" + n, "sita");
            sita.add(s);
            hub.afterConnectionEstablished(s);
        }
        WebSocketSession ram = socket("ram-1", "ram");
        hub.afterConnectionEstablished(ram);

        ArgumentCaptor<CloseStatus> status = ArgumentCaptor.forClass(CloseStatus.class);
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> verify(sita.get(0)).close(status.capture()));
        assertThat(status.getValue().getCode()).isEqualTo(CloseStatus.POLICY_VIOLATION.getCode());
        for (int n = 1; n < 6; n++) verify(sita.get(n), never()).close(any(CloseStatus.class));
        verify(ram, never()).close(any(CloseStatus.class));
    }

    @Test
    void shouldRefuseANewSocket_whenTheFeedAlreadyHasTheMostItWillCarry() throws Exception {
        for (int n = 0; n < 100; n++) hub.afterConnectionEstablished(socket("s-" + n, "person-" + (n / 5)));
        WebSocketSession late = socket("late", "someone-new");

        hub.afterConnectionEstablished(late);

        ArgumentCaptor<CloseStatus> status = ArgumentCaptor.forClass(CloseStatus.class);
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> verify(late).close(status.capture()));
        assertThat(status.getValue().getCode()).isEqualTo(CloseStatus.SERVICE_OVERLOAD.getCode());
        hub.publish("CHARGE_POINT_UPDATED", Map.of("n", 1));
        Thread.sleep(200);
        assertThat(receivedBy(late)).isEmpty();
    }

    @Test
    void shouldFreeARoomInTheFeed_whenASocketCloses() throws Exception {
        List<WebSocketSession> all = new ArrayList<>();
        for (int n = 0; n < 100; n++) {
            WebSocketSession s = socket("s-" + n, "person-" + (n / 5));
            all.add(s);
            hub.afterConnectionEstablished(s);
        }
        hub.afterConnectionClosed(all.get(0), CloseStatus.NORMAL);
        WebSocketSession next = socket("next", "someone-new");

        hub.afterConnectionEstablished(next);

        hub.publish("CHARGE_POINT_UPDATED", Map.of("n", 1));
        await().atMost(5, TimeUnit.SECONDS).until(() -> everything.get(100).size() == 2);
        verify(next, never()).close(any(CloseStatus.class));
    }

    @Test
    void shouldReplaceAPersonsOldestSocket_evenWhenTheFeedIsFull() throws Exception {
        List<WebSocketSession> all = new ArrayList<>();
        for (int n = 0; n < 100; n++) {
            WebSocketSession s = socket("s-" + n, "person-" + (n / 5));
            all.add(s);
            hub.afterConnectionEstablished(s);
        }
        WebSocketSession replacement = socket("replacement", "person-0");   // person-0 already has five

        hub.afterConnectionEstablished(replacement);

        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> verify(all.get(0)).close(any(CloseStatus.class)));
        hub.publish("CHARGE_POINT_UPDATED", Map.of("n", 1));
        await().atMost(5, TimeUnit.SECONDS).until(() -> everything.get(100).size() == 2);
        verify(replacement, never()).close(any(CloseStatus.class));
    }

    @Test
    void shouldCloseASocketThatHasNoUsername() throws Exception {
        WebSocketSession anonymous = socket("anonymous", "ignored");
        anonymous.getAttributes().remove("username");

        hub.afterConnectionEstablished(anonymous);

        ArgumentCaptor<CloseStatus> status = ArgumentCaptor.forClass(CloseStatus.class);
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> verify(anonymous).close(status.capture()));
        assertThat(status.getValue().getCode()).isEqualTo(CloseStatus.POLICY_VIOLATION.getCode());
        assertThat(hub.socketCount()).isZero();
    }

    @Test
    void shouldCloseASocketWhoseUsernameIsBlank() throws Exception {
        WebSocketSession blank = socket("blank", "   ");

        hub.afterConnectionEstablished(blank);

        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> verify(blank).close(any(CloseStatus.class)));
        assertThat(hub.socketCount()).isZero();
    }
}

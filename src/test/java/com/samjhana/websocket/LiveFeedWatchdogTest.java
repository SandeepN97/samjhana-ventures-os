package com.samjhana.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Finding P1b-06: the live feed let a person in once and never looked at their account again. A person whose account
 * was switched off, whose password was changed or reset, or whose role was changed kept receiving every charging
 * session (number plate, customer name, amount) until their socket happened to close.
 */
class LiveFeedWatchdogTest {

    private static final class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-10-16T08:00:00Z");
        @Override public Instant instant() { return now; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
    }

    private final MovableClock clock = new MovableClock();
    private final ExecutorService threads = Executors.newFixedThreadPool(2);
    private final EvLiveWebSocketHandler hub = new EvLiveWebSocketHandler(new ObjectMapper(), threads, clock);
    private final UserRepository users = mock(UserRepository.class);
    private final LiveFeedWatchdog watchdog = new LiveFeedWatchdog(hub, users, clock);
    private final List<List<String>> everything = new CopyOnWriteArrayList<>();

    @AfterEach
    void stopThreads() {
        threads.shutdownNow();
    }

    private static User account(String username, User.UserRole role, String passwordHash, boolean active) {
        return User.builder().username(username).role(role).passwordHash(passwordHash).isActive(active)
                .fullName(username).build();
    }

    /** Opens a socket for the account exactly as the handshake would, and has the hub look at it. */
    private WebSocketSession open(String id, User account) throws IOException {
        return open(id, account.getUsername(), AccountStamp.of(account));
    }

    private WebSocketSession open(String id, String username, AccountStamp stamp) throws IOException {
        List<String> received = new CopyOnWriteArrayList<>();
        everything.add(received);
        WebSocketSession session = mock(WebSocketSession.class);
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("username", username);
        if (stamp != null) attributes.put(AccountStamp.ATTRIBUTE, stamp);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        when(session.getAttributes()).thenReturn(attributes);
        doAnswer(call -> { received.add(((TextMessage) call.getArgument(0)).getPayload()); return null; })
                .when(session).sendMessage(any());
        hub.afterConnectionEstablished(session);
        return session;
    }

    private void assertClosedWith(WebSocketSession session, CloseStatus expected) throws IOException {
        ArgumentCaptor<CloseStatus> status = ArgumentCaptor.forClass(CloseStatus.class);
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> verify(session).close(status.capture()));
        assertThat(status.getValue().getCode()).isEqualTo(expected.getCode());
    }

    private void assertStillOpen(WebSocketSession session) throws Exception {
        Thread.sleep(150);   // closing happens on another thread: give it the chance it would need
        verify(session, never()).close(any(CloseStatus.class));
    }

    // ------------------------------------------------------------------ the account changed

    @Test
    void shouldCloseTheSocket_whenTheAccountWasSwitchedOff() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        WebSocketSession socket = open("a", sita);
        sita.setIsActive(false);
        when(users.findByUsername("sita")).thenReturn(Optional.of(sita));

        watchdog.recheck();

        assertClosedWith(socket, LiveFeedWatchdog.ACCOUNT_CHANGED);
    }

    @Test
    void shouldCloseTheSocket_whenThePasswordWasChangedOrReset() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        WebSocketSession socket = open("a", sita);
        sita.setPasswordHash("hash-2");
        when(users.findByUsername("sita")).thenReturn(Optional.of(sita));

        watchdog.recheck();

        assertClosedWith(socket, LiveFeedWatchdog.ACCOUNT_CHANGED);
    }

    @Test
    void shouldCloseTheSocket_whenTheRoleWasChanged() throws Exception {
        User sita = account("sita", User.UserRole.MANAGER, "hash-1", true);
        WebSocketSession socket = open("a", sita);
        sita.setRole(User.UserRole.STAFF);
        when(users.findByUsername("sita")).thenReturn(Optional.of(sita));

        watchdog.recheck();

        assertClosedWith(socket, LiveFeedWatchdog.ACCOUNT_CHANGED);
    }

    @Test
    void shouldCloseTheSocket_whenTheAccountNoLongerExists() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        WebSocketSession socket = open("a", sita);
        when(users.findByUsername("sita")).thenReturn(Optional.empty());

        watchdog.recheck();

        assertClosedWith(socket, LiveFeedWatchdog.ACCOUNT_CHANGED);
    }

    @Test
    void shouldCloseTheSocket_whenItWasOpenedWithoutAStampToCompareWith() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        WebSocketSession socket = open("a", "sita", null);
        when(users.findByUsername("sita")).thenReturn(Optional.of(sita));

        watchdog.recheck();

        assertClosedWith(socket, LiveFeedWatchdog.ACCOUNT_CHANGED);
    }

    @Test
    void shouldLeaveTheSocketAlone_whenTheAccountIsAsItWas() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        WebSocketSession socket = open("a", sita);
        when(users.findByUsername("sita")).thenReturn(Optional.of(sita));

        watchdog.recheck();

        assertStillOpen(socket);
    }

    @Test
    void shouldLeaveEveryoneElseAlone_whenOnePersonIsRevoked() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        User ram = account("ram", User.UserRole.STAFF, "hash-9", true);
        WebSocketSession sitas = open("a", sita);
        WebSocketSession rams = open("b", ram);
        sita.setIsActive(false);
        when(users.findByUsername("sita")).thenReturn(Optional.of(sita));
        when(users.findByUsername("ram")).thenReturn(Optional.of(ram));

        watchdog.recheck();

        assertClosedWith(sitas, LiveFeedWatchdog.ACCOUNT_CHANGED);
        assertStillOpen(rams);
    }

    @Test
    void shouldCloseEverySocketOfARevokedPerson_andLookThemUpOnlyOnce() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        WebSocketSession phone = open("a", sita);
        WebSocketSession laptop = open("b", sita);
        WebSocketSession kiosk = open("c", sita);
        sita.setIsActive(false);
        when(users.findByUsername("sita")).thenReturn(Optional.of(sita));

        watchdog.recheck();

        assertClosedWith(phone, LiveFeedWatchdog.ACCOUNT_CHANGED);
        assertClosedWith(laptop, LiveFeedWatchdog.ACCOUNT_CHANGED);
        assertClosedWith(kiosk, LiveFeedWatchdog.ACCOUNT_CHANGED);
        verify(users, times(1)).findByUsername("sita");
    }

    @Test
    void shouldReceiveNothingMore_afterTheAccountWasRevoked() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        WebSocketSession socket = open("a", sita);
        await().atMost(5, TimeUnit.SECONDS).until(() -> everything.get(0).size() == 1);   // the CONNECTED frame
        sita.setIsActive(false);
        when(users.findByUsername("sita")).thenReturn(Optional.of(sita));

        watchdog.recheck();
        hub.publish("CHARGE_SESSION_UPDATED", Map.of("plate", "BA 1 PA 1234"));

        assertClosedWith(socket, LiveFeedWatchdog.ACCOUNT_CHANGED);
        Thread.sleep(150);
        assertThat(everything.get(0)).hasSize(1);
        assertThat(hub.socketCount()).isZero();
    }

    @Test
    void shouldStillCheckEveryoneElse_whenOnePersonsLookupFails() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        User ram = account("ram", User.UserRole.STAFF, "hash-9", true);
        open("a", sita);
        WebSocketSession rams = open("b", ram);
        ram.setIsActive(false);
        when(users.findByUsername("sita")).thenThrow(new IllegalStateException("database hiccup"));
        when(users.findByUsername("ram")).thenReturn(Optional.of(ram));

        watchdog.recheck();

        assertClosedWith(rams, LiveFeedWatchdog.ACCOUNT_CHANGED);
    }

    // ------------------------------------------------------------------ age

    @Test
    void shouldCloseSocketsThatHaveBeenOpenTooLong_butNotNewerOnes() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        User ram = account("ram", User.UserRole.STAFF, "hash-9", true);
        when(users.findByUsername("sita")).thenReturn(Optional.of(sita));
        when(users.findByUsername("ram")).thenReturn(Optional.of(ram));
        WebSocketSession old = open("old", sita);
        clock.now = clock.now.plus(Duration.ofHours(12)).minus(Duration.ofMinutes(1));
        WebSocketSession newer = open("newer", ram);
        clock.now = clock.now.plus(Duration.ofMinutes(2));   // the first has now been open twelve hours and a minute

        watchdog.recheck();

        assertClosedWith(old, LiveFeedWatchdog.REFRESH);
        assertStillOpen(newer);
    }

    @Test
    void shouldNotCloseASocketThatIsJustUnderTwelveHours() throws Exception {
        User sita = account("sita", User.UserRole.STAFF, "hash-1", true);
        when(users.findByUsername("sita")).thenReturn(Optional.of(sita));
        WebSocketSession socket = open("a", sita);
        clock.now = clock.now.plus(Duration.ofHours(12)).minusSeconds(1);

        watchdog.recheck();

        assertStillOpen(socket);
    }

    @Test
    void shouldAllowASocketToStayOpenForTwelveHours() {
        assertThat(LiveFeedWatchdog.MAX_SOCKET_AGE).isEqualTo(Duration.ofHours(12));
    }
}

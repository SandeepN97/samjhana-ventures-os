package com.samjhana.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

/**
 * Findings D-02 and P1b-06 end to end, over a real server and real WebSockets: a screen gets its ticket, connects,
 * receives charging events; a person whose account is switched off or whose password changes is cut off; nobody can
 * hold an unlimited number of screens or ask for an unlimited number of tickets.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class EvLiveFeedIntegrationTest {

    @LocalServerPort int port;
    @Autowired TestRestTemplate rest;
    @Autowired ObjectMapper mapper;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JdbcTemplate jdbc;
    @Autowired EvLiveWebSocketHandler hub;
    @Autowired LiveFeedWatchdog watchdog;

    private final List<WebSocketSession> sockets = new ArrayList<>();

    @AfterEach
    void closeEveryScreen() {
        for (WebSocketSession socket : sockets) {
            try {
                socket.close();
            } catch (Exception ignored) {
                // already closed by the server
            }
        }
    }

    private User newPerson(User.UserRole role) {
        return userRepository.save(User.builder()
                .username("feed-" + UUID.randomUUID().toString().substring(0, 8))
                .passwordHash(passwordEncoder.encode("not-used"))
                .fullName("Feed Test").fullNameNepali("परीक्षण").role(role).build());
    }

    private ResponseEntity<JsonNode> askForTicket(User person) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtUtil.generateToken(userRepository.findByUsername(person.getUsername()).orElseThrow()));
        return rest.exchange("/api/ev/live-ticket", HttpMethod.POST, new HttpEntity<>(headers), JsonNode.class);
    }

    /** Opens a screen the way the app does: ask for a one-time ticket, then connect with it. */
    private Screen connect(User person) throws Exception {
        String ticket = askForTicket(person).getBody().get("ticket").asText();
        Screen screen = new Screen();
        screen.session = new StandardWebSocketClient()
                .execute(screen, new WebSocketHttpHeaders(), URI.create("ws://localhost:" + port + "/ws/ev?ticket=" + ticket))
                .get(5, TimeUnit.SECONDS);
        sockets.add(screen.session);
        return screen;
    }

    private final class Screen extends TextWebSocketHandler {
        final BlockingQueue<JsonNode> events = new LinkedBlockingQueue<>();
        volatile CloseStatus closedWith;
        WebSocketSession session;

        @Override
        protected void handleTextMessage(WebSocketSession s, TextMessage message) throws Exception {
            events.add(mapper.readTree(message.getPayload()));
        }

        @Override
        public void afterConnectionClosed(WebSocketSession s, CloseStatus status) {
            closedWith = status;
        }

        JsonNode awaitEvent(String type) throws Exception {
            long deadline = System.currentTimeMillis() + 5_000;
            while (System.currentTimeMillis() < deadline) {
                JsonNode event = events.poll(200, TimeUnit.MILLISECONDS);
                if (event != null && type.equals(event.path("type").asText())) return event;
            }
            throw new AssertionError("No " + type + " event arrived within 5s");
        }

        CloseStatus awaitClosed() {
            await().atMost(5, TimeUnit.SECONDS).until(() -> closedWith != null);
            return closedWith;
        }

        boolean isOpen() {
            return closedWith == null && session.isOpen();
        }
    }

    // ------------------------------------------------------------------ normal use

    @Test
    void shouldDeliverALiveEventToAScreenThatConnectedWithATicket() throws Exception {
        Screen screen = connect(newPerson(User.UserRole.STAFF));
        screen.awaitEvent("CONNECTED");

        hub.publish("CHARGE_POINT_UPDATED", Map.of("code", "FEED-TEST-1"));

        assertThat(screen.awaitEvent("CHARGE_POINT_UPDATED").path("payload").path("code").asText()).isEqualTo("FEED-TEST-1");
    }

    // ------------------------------------------------------------------ the account changes while a screen is open (P1b-06)

    @Test
    void shouldCutOffAScreenAndKeepItOut_whenThePersonsAccountIsSwitchedOff() throws Exception {
        User person = newPerson(User.UserRole.STAFF);
        Screen screen = connect(person);
        screen.awaitEvent("CONNECTED");

        jdbc.update("update users set is_active = false where id = ?", person.getId());
        watchdog.recheck();
        hub.publish("CHARGE_SESSION_UPDATED", Map.of("plateNumber", "BA 1 PA 1234"));

        assertThat(screen.awaitClosed().getCode()).isEqualTo(4401);
        Thread.sleep(200);
        assertThat(screen.events.stream().map(event -> event.path("type").asText())).doesNotContain("CHARGE_SESSION_UPDATED");
        assertThat(askForTicket(person).getStatusCode()).as("a new ticket for the switched-off account").isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldCutOffAScreen_whenThePersonsPasswordIsChanged() throws Exception {
        User person = newPerson(User.UserRole.MANAGER);
        Screen screen = connect(person);
        screen.awaitEvent("CONNECTED");

        jdbc.update("update users set password_hash = ? where id = ?", passwordEncoder.encode("a-new-password"), person.getId());
        watchdog.recheck();

        assertThat(screen.awaitClosed().getCode()).isEqualTo(4401);
    }

    @Test
    void shouldRefuseToOpenAScreen_whenTheAccountWasSwitchedOffAfterTheTicketWasIssued() throws Exception {
        User person = newPerson(User.UserRole.STAFF);
        String ticket = askForTicket(person).getBody().get("ticket").asText();
        jdbc.update("update users set is_active = false where id = ?", person.getId());

        assertThatThrownBy(() -> new StandardWebSocketClient()
                .execute(new Screen(), new WebSocketHttpHeaders(), URI.create("ws://localhost:" + port + "/ws/ev?ticket=" + ticket))
                .get(5, TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class);
    }

    @Test
    void shouldLeaveOtherPeoplesScreensOpen_whenOnePersonIsCutOff() throws Exception {
        User revoked = newPerson(User.UserRole.STAFF);
        User other = newPerson(User.UserRole.STAFF);
        Screen revokedScreen = connect(revoked);
        Screen otherScreen = connect(other);
        otherScreen.awaitEvent("CONNECTED");

        jdbc.update("update users set is_active = false where id = ?", revoked.getId());
        watchdog.recheck();

        revokedScreen.awaitClosed();
        hub.publish("CHARGE_POINT_UPDATED", Map.of("code", "FEED-TEST-2"));
        otherScreen.awaitEvent("CHARGE_POINT_UPDATED");
        assertThat(otherScreen.isOpen()).isTrue();
    }

    // ------------------------------------------------------------------ limits (D-02)

    @Test
    void shouldCloseAPersonsOldestScreen_whenTheyOpenASixth() throws Exception {
        User person = newPerson(User.UserRole.STAFF);
        List<Screen> screens = new ArrayList<>();
        for (int n = 1; n <= 6; n++) {
            Screen screen = connect(person);
            screen.awaitEvent("CONNECTED");
            screens.add(screen);
        }

        assertThat(screens.get(0).awaitClosed().getCode()).isEqualTo(CloseStatus.POLICY_VIOLATION.getCode());
        for (int n = 1; n < 6; n++) assertThat(screens.get(n).isOpen()).as("screen %d", n + 1).isTrue();
    }

    @Test
    void shouldRefuseTheNextTicketRequestWithinAMinute_afterTheAllowanceIsUsed() {
        User person = newPerson(User.UserRole.STAFF);
        for (int n = 1; n <= LiveTicketService.MAX_TICKETS_PER_PERSON; n++) {
            assertThat(askForTicket(person).getStatusCode()).as("request %d", n).isEqualTo(HttpStatus.OK);
        }

        assertThat(askForTicket(person).getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void shouldStillGiveAnotherPersonATicket_whenOnePersonHasUsedUpTheirs() {
        User busy = newPerson(User.UserRole.STAFF);
        User calm = newPerson(User.UserRole.STAFF);
        for (int n = 1; n <= LiveTicketService.MAX_TICKETS_PER_PERSON + 1; n++) askForTicket(busy);

        assertThat(askForTicket(calm).getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}

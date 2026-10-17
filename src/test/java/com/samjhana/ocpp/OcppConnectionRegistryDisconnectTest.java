package com.samjhana.ocpp;

import com.samjhana.ocpp.diag.OcppCommandAudit;
import com.samjhana.ocpp.diag.OcppConnectionState;
import com.samjhana.ocpp.diag.OcppFrameSender;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Finding P1a-03: a charger's secret is only checked when it connects, so changing the secret (the admin's answer to
 * a leaked one) used to leave the connection that was already open working as that charger. The registry can now
 * close a charger's live connection.
 */
class OcppConnectionRegistryDisconnectTest {

    private static final CloseStatus CREDENTIALS_CHANGED = CloseStatus.POLICY_VIOLATION.withReason("credentials changed");

    private final OcppConnectionRegistry registry =
            new OcppConnectionRegistry(mock(OcppFrameSender.class), mock(OcppCommandAudit.class));

    private WebSocketSession register(String code, String sessionId) {
        WebSocketSession socket = mock(WebSocketSession.class);
        when(socket.getId()).thenReturn(sessionId);
        when(socket.isOpen()).thenReturn(true);
        when(socket.getAttributes()).thenReturn(new HashMap<>());
        registry.register(code, socket, new OcppConnectionState(sessionId, code, "203.0.113.9", "ocpp2.0.1", Instant.now(), 30));
        return socket;
    }

    @Test
    void shouldCloseTheLiveConnectionWithTheGivenStatus() throws Exception {
        WebSocketSession socket = register("CP-1", "s1");

        boolean closed = registry.disconnect("CP-1", CREDENTIALS_CHANGED);

        assertThat(closed).isTrue();
        verify(socket).close(CREDENTIALS_CHANGED);
    }

    @Test
    void shouldReturnFalseAndDoNothing_whenTheChargerIsNotConnected() {
        assertThat(registry.disconnect("CP-NOT-THERE", CREDENTIALS_CHANGED)).isFalse();
    }

    @Test
    void shouldCloseOnlyTheNamedCharger() throws Exception {
        WebSocketSession first = register("CP-1", "s1");
        WebSocketSession second = register("CP-2", "s2");

        registry.disconnect("CP-1", CREDENTIALS_CHANGED);

        verify(first).close(CREDENTIALS_CHANGED);
        verify(second, never()).close(any(CloseStatus.class));
    }

    @Test
    void shouldCloseTheNewestConnection_whenTheChargerReconnected() throws Exception {
        WebSocketSession older = register("CP-1", "old");
        WebSocketSession newer = register("CP-1", "new");

        registry.disconnect("CP-1", CREDENTIALS_CHANGED);

        verify(newer).close(CREDENTIALS_CHANGED);
        verify(older, never()).close(any(CloseStatus.class));   // the handler closes a replaced socket itself
    }

    @Test
    void shouldNotFail_whenTheSocketCannotBeClosed() throws Exception {
        WebSocketSession socket = register("CP-1", "s1");
        doThrow(new IOException("already gone")).when(socket).close(any(CloseStatus.class));

        assertThat(registry.disconnect("CP-1", CREDENTIALS_CHANGED)).isTrue();
    }

    @Test
    void shouldNotFail_whenTheContainerThrowsWhileClosing() throws Exception {
        WebSocketSession socket = register("CP-1", "s1");
        doThrow(new IllegalStateException("closing")).when(socket).close(any(CloseStatus.class));

        assertThat(registry.disconnect("CP-1", CREDENTIALS_CHANGED)).isTrue();
    }

    @Test
    void shouldKeepTheRegistrationUntilTheCloseIsReported_soTheUsualDisconnectHandlingStillRuns() {
        register("CP-1", "s1");

        registry.disconnect("CP-1", CREDENTIALS_CHANGED);

        // the container reports the close back to the handler, which unregisters it and marks the charger offline
        assertThat(registry.unregister("CP-1", "s1").wasCurrent()).isTrue();
    }
}

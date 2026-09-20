package com.samjhana.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class EvLiveWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        sessions.put(session.getId(), new ConcurrentWebSocketSessionDecorator(session, 10_000, 256 * 1024));
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                "type", "CONNECTED",
                "at", LocalDateTime.now().toString()))));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
    }

    public void publish(String type, Object payload) {
        String json;
        try {
            json = objectMapper.writeValueAsString(Map.of(
                    "type", type,
                    "at", LocalDateTime.now().toString(),
                    "payload", payload));
        } catch (Exception ex) {
            log.warn("Could not serialize EV live event {}", type, ex);
            return;
        }
        sessions.forEach((id, session) -> {
            if (!session.isOpen()) {
                sessions.remove(id);
                return;
            }
            try {
                session.sendMessage(new TextMessage(json));
            } catch (IOException ex) {
                sessions.remove(id);
                log.debug("Removed disconnected EV kiosk WebSocket {}", id);
            }
        });
    }
}

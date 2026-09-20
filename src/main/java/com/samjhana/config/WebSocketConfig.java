package com.samjhana.config;

import com.samjhana.websocket.EvKioskHandshakeInterceptor;
import com.samjhana.websocket.EvLiveWebSocketHandler;
import com.samjhana.websocket.OcppHandshakeInterceptor;
import com.samjhana.websocket.OcppWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.Arrays;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final OcppWebSocketHandler ocppWebSocketHandler;
    private final OcppHandshakeInterceptor ocppHandshakeInterceptor;
    private final EvLiveWebSocketHandler evLiveWebSocketHandler;
    private final EvKioskHandshakeInterceptor evKioskHandshakeInterceptor;

    @Value("${samjhana.cors.allowed-origins:http://localhost:5173,http://localhost:5175,http://localhost:8080}")
    private String allowedOrigins;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(ocppWebSocketHandler, "/ocpp/*")
                .addInterceptors(ocppHandshakeInterceptor)
                .setAllowedOrigins(origins());
        registry.addHandler(evLiveWebSocketHandler, "/ws/ev")
                .addInterceptors(evKioskHandshakeInterceptor)
                .setAllowedOrigins(origins());
    }

    private String[] origins() {
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toArray(String[]::new);
    }
}

package com.samjhana.config;

import com.samjhana.ocpp.diag.OcppLoggingProperties;
import com.samjhana.websocket.EvKioskHandshakeInterceptor;
import com.samjhana.websocket.EvLiveWebSocketHandler;
import com.samjhana.websocket.OcppHandshakeInterceptor;
import com.samjhana.websocket.OcppWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.server.ConfigurableServletWebServerFactory;
import org.springframework.context.annotation.Bean;
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
    private final OcppLoggingProperties ocppLoggingProperties;

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

    /**
     * Tomcat closes a connection with code 1009 on any frame above 8 KB by default. A charger's NotifyReport or a
     * long TransactionEvent can exceed that, so raise the limit (ocpp.logging.web-socket-max-message-bytes).
     * Done through Tomcat's own servlet-context parameters, which only exist on the real embedded server.
     */
    @Bean
    public WebServerFactoryCustomizer<ConfigurableServletWebServerFactory> webSocketBufferSizes() {
        String size = String.valueOf(ocppLoggingProperties.getWebSocketMaxMessageBytes());
        return factory -> factory.addInitializers(servletContext -> {
            servletContext.setInitParameter("org.apache.tomcat.websocket.textBufferSize", size);
            servletContext.setInitParameter("org.apache.tomcat.websocket.binaryBufferSize", size);
        });
    }

    private String[] origins() {
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toArray(String[]::new);
    }
}

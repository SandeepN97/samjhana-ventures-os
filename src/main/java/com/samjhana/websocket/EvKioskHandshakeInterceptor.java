package com.samjhana.websocket;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

/**
 * Opens the live EV WebSocket only for a one-time ticket from {@code POST /api/ev/live-ticket}
 * (see {@link LiveTicketService}), never for the login token itself, and only while the account
 * that asked for the ticket is still active.
 */
@Component
@RequiredArgsConstructor
public class EvKioskHandshakeInterceptor implements HandshakeInterceptor {

    private final LiveTicketService liveTicketService;
    private final UserRepository userRepository;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String ticket = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams().getFirst("ticket");
        User user = liveTicketService.redeem(ticket)
                .flatMap(userRepository::findByUsername)
                .filter(User::isEnabled)
                .orElse(null);
        if (user == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        attributes.put("username", user.getUsername());
        // What the person's account looked like when they connected, so the socket can be closed once it no longer
        // does (the password was changed or reset, the role changed, the account was switched off): finding P1b-06.
        attributes.put(AccountStamp.ATTRIBUTE, AccountStamp.of(user));
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // No-op.
    }
}

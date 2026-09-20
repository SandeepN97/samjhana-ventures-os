package com.samjhana.websocket;

import com.samjhana.entity.ChargePoint;
import com.samjhana.repository.ChargePointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class OcppHandshakeInterceptor implements HandshakeInterceptor {

    public static final String CHARGE_POINT_CODE = "chargePointCode";
    private static final String OCPP_SUBPROTOCOL = "ocpp2.0.1";

    private final ChargePointRepository chargePointRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String protocol = request.getHeaders().getFirst("Sec-WebSocket-Protocol");
        if (protocol == null || !protocol.contains(OCPP_SUBPROTOCOL)) {
            response.setStatusCode(HttpStatus.UPGRADE_REQUIRED);
            return false;
        }

        String path = request.getURI().getPath();
        String code = path.substring(path.lastIndexOf('/') + 1);
        ChargePoint point = chargePointRepository.findByCodeAndDeletedAtIsNull(code).orElse(null);
        if (point == null || !Boolean.TRUE.equals(point.getIsActive()) || point.getOcppAuthSecretHash() == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        String authorization = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        Credentials credentials = parseBasic(authorization);
        if (credentials == null || !code.equals(credentials.username())
                || !passwordEncoder.matches(credentials.password(), point.getOcppAuthSecretHash())) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        attributes.put(CHARGE_POINT_CODE, code);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // Nothing to clean up; authentication state is stored in the WebSocket attributes.
    }

    private Credentials parseBasic(String authorization) {
        if (authorization == null || !authorization.startsWith("Basic ")) return null;
        try {
            String decoded = new String(Base64.getDecoder().decode(authorization.substring(6)),
                    StandardCharsets.UTF_8);
            int separator = decoded.indexOf(':');
            if (separator <= 0) return null;
            return new Credentials(decoded.substring(0, separator), decoded.substring(separator + 1));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private record Credentials(String username, String password) {}
}

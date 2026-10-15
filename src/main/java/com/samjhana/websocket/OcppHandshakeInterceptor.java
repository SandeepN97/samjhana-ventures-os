package com.samjhana.websocket;

import com.samjhana.entity.ChargePoint;
import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.ocpp.diag.HandshakeOutcome;
import com.samjhana.ocpp.diag.LogSafe;
import com.samjhana.ocpp.diag.OcppAuditWriter;
import com.samjhana.ocpp.diag.OcppLoggers;
import com.samjhana.ocpp.diag.OcppMdc;
import com.samjhana.repository.ChargePointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Authenticates the charger's WebSocket handshake (Basic auth, subprotocol {@code ocpp2.0.1}) and logs
 * exactly one line per attempt with the reason for the outcome. The client still only ever sees an
 * opaque 401 or 426; the precise reason (unknown charger, bad password, wrong subprotocol...) is for our
 * logs and {@code ocpp_connection_log}. The Authorization header value and the password are never logged,
 * only whether the header was present and parsable, and the Basic username.
 */
@Component
@RequiredArgsConstructor
public class OcppHandshakeInterceptor implements HandshakeInterceptor {

    public static final String CHARGE_POINT_CODE = "chargePointCode";
    public static final String ATTR_REMOTE = "ocpp.remoteAddr";
    public static final String ATTR_FORWARDED_FOR = "ocpp.forwardedFor";
    public static final String ATTR_USER_AGENT = "ocpp.userAgent";
    public static final String ATTR_OFFERED = "ocpp.offeredProtocols";
    /** Set on the servlet request so the request filter knows the interceptor already logged and stored it. */
    public static final String REQUEST_OUTCOME_ATTRIBUTE = "ocpp.handshake.outcome";
    private static final String OCPP_SUBPROTOCOL = "ocpp2.0.1";

    private final ChargePointRepository chargePointRepository;
    private final PasswordEncoder passwordEncoder;
    private final OcppAuditWriter auditWriter;

    private record Decision(HandshakeOutcome outcome, String authorization, String basicUser) {}

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String path = request.getURI().getPath();
        String code = path.substring(path.lastIndexOf('/') + 1);
        HttpHeaders headers = request.getHeaders();
        List<String> offeredHeader = headers.get("Sec-WebSocket-Protocol");
        String offered = offeredHeader == null ? "" : String.join(",", offeredHeader);
        String remote = remoteAddress(request);
        String forwardedFor = headers.getFirst("X-Forwarded-For");
        String userAgent = headers.getFirst(HttpHeaders.USER_AGENT);

        Decision decision = decide(code, offeredHeader, offered, headers);

        try (OcppMdc mdc = OcppMdc.open().chargePoint(LogSafe.clean(code, 64))) {
            boolean accepted = decision.outcome() == HandshakeOutcome.ACCEPTED;
            String line = "HANDSHAKE {} path={} chargePointId={} offeredProtocols=[{}] remote={} xForwardedFor={} "
                    + "xForwardedProto={} xForwardedHost={} authorization={} basicUser={} userAgent={}";
            Object[] args = {decision.outcome(), LogSafe.clean(path), LogSafe.clean(code, 64), LogSafe.clean(offered),
                    remote, LogSafe.clean(forwardedFor), LogSafe.clean(headers.getFirst("X-Forwarded-Proto"), 20),
                    LogSafe.clean(headers.getFirst("X-Forwarded-Host"), 100), decision.authorization(),
                    LogSafe.clean(decision.basicUser(), 64), LogSafe.clean(userAgent, 120)};
            if (accepted) OcppLoggers.HANDSHAKE.info(line, args);
            else OcppLoggers.HANDSHAKE.warn(line, args);
        }

        auditWriter.enqueue(OcppConnectionLog.builder()
                .chargePointId(LogSafe.clean(code, 64))
                .event(decision.outcome() == HandshakeOutcome.ACCEPTED
                        ? OcppConnectionLog.Event.HANDSHAKE_ACCEPTED : OcppConnectionLog.Event.HANDSHAKE_REJECTED)
                .reason(decision.outcome().name())
                .remoteAddr(remote)
                .forwardedFor(LogSafe.clean(forwardedFor, 255))
                .offeredProtocols(LogSafe.clean(offered, 255))
                .userAgent(LogSafe.clean(userAgent, 255))
                .requestUri(LogSafe.clean(path, 1000))
                .detail("authorization=" + decision.authorization()
                        + (decision.basicUser() == null ? "" : " basicUser=" + LogSafe.clean(decision.basicUser(), 64)))
                .createdAt(Instant.now())
                .build());

        if (request instanceof ServletServerHttpRequest servlet) {
            servlet.getServletRequest().setAttribute(REQUEST_OUTCOME_ATTRIBUTE, decision.outcome().name());
        }

        switch (decision.outcome()) {
            case ACCEPTED -> {
                attributes.put(CHARGE_POINT_CODE, code);
                attributes.put(ATTR_REMOTE, remote);
                attributes.put(ATTR_FORWARDED_FOR, forwardedFor);
                attributes.put(ATTR_USER_AGENT, userAgent);
                attributes.put(ATTR_OFFERED, offered);
                return true;
            }
            case NO_SUBPROTOCOL, UNSUPPORTED_SUBPROTOCOL -> response.setStatusCode(HttpStatus.UPGRADE_REQUIRED);
            default -> response.setStatusCode(HttpStatus.UNAUTHORIZED);
        }
        return false;
    }

    private Decision decide(String code, List<String> offeredHeader, String offered, HttpHeaders headers) {
        if (offeredHeader == null || offeredHeader.isEmpty()) return new Decision(HandshakeOutcome.NO_SUBPROTOCOL, "n/a", null);
        if (!offered.contains(OCPP_SUBPROTOCOL)) return new Decision(HandshakeOutcome.UNSUPPORTED_SUBPROTOCOL, "n/a", null);

        ChargePoint point = chargePointRepository.findByCodeAndDeletedAtIsNull(code).orElse(null);
        if (point == null) return new Decision(HandshakeOutcome.UNKNOWN_CHARGER, "n/a", null);
        if (!Boolean.TRUE.equals(point.getIsActive())) return new Decision(HandshakeOutcome.INACTIVE_CHARGER, "n/a", null);
        if (point.getOcppAuthSecretHash() == null) return new Decision(HandshakeOutcome.NO_SECRET_HASH, "n/a", null);

        String authorization = headers.getFirst(HttpHeaders.AUTHORIZATION);
        if (authorization == null) return new Decision(HandshakeOutcome.NO_AUTH_HEADER, "absent", null);
        Credentials credentials = parseBasic(authorization);
        if (credentials == null) {
            String kind = authorization.startsWith("Basic ") ? "present, Basic but not parsable" : "present, not Basic";
            return new Decision(HandshakeOutcome.MALFORMED_BASIC, kind, null);
        }
        if (!code.equals(credentials.username())) {
            return new Decision(HandshakeOutcome.USER_MISMATCH, "present, Basic parsable", credentials.username());
        }
        if (!passwordEncoder.matches(credentials.password(), point.getOcppAuthSecretHash())) {
            return new Decision(HandshakeOutcome.BAD_PASSWORD, "present, Basic parsable", credentials.username());
        }
        return new Decision(HandshakeOutcome.ACCEPTED, "present, Basic parsable", credentials.username());
    }

    private String remoteAddress(ServerHttpRequest request) {
        if (request instanceof ServletServerHttpRequest servlet) {
            return servlet.getServletRequest().getRemoteAddr();
        }
        return request.getRemoteAddress() == null ? null : request.getRemoteAddress().toString();
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

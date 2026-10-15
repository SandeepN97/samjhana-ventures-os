package com.samjhana.ocpp.diag;

import com.samjhana.entity.OcppConnectionLog;
import com.samjhana.websocket.OcppHandshakeInterceptor;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Logs every HTTP request whose path starts with {@code /ocpp}, including those that die before our
 * handshake interceptor runs (404 for a near-miss URL, a 403 from the Origin check, a failed upgrade).
 * Ordered ahead of Spring Security and the WebSocket routing so nothing under /ocpp escapes it.
 *
 * <p>Authorization and Cookie are reported by name only. Query-string values whose name looks like a
 * credential are masked. Near-miss URLs are classified for the log only; which URLs are accepted is
 * decided elsewhere and is not changed here.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class OcppRequestLoggingFilter extends OncePerRequestFilter {

    private static final Pattern SENSITIVE_PARAM = Pattern.compile("(?i)(pass|pwd|secret|token|auth|key|cred)");

    private final OcppAuditWriter auditWriter;

    public OcppRequestLoggingFilter(OcppAuditWriter auditWriter) {
        this.auditWriter = auditWriter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/ocpp");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long started = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            try {
                record(request, response, (System.nanoTime() - started) / 1_000_000);
            } catch (RuntimeException ex) {
                logger.warn("OCPP request logging failed: " + ex);
            }
        }
    }

    private void record(HttpServletRequest request, HttpServletResponse response, long millis) {
        String path = request.getRequestURI();
        int status = response.getStatus();
        OcppUrlClassifier.Shape shape = OcppUrlClassifier.classify(path);
        String interceptorOutcome = (String) request.getAttribute(OcppHandshakeInterceptor.REQUEST_OUTCOME_ATTRIBUTE);
        String origin = request.getHeader("Origin");
        String uri = LogSafe.clean(path + maskedQuery(request.getQueryString()), 1000);
        String code = path.substring(Math.min(path.length(), path.lastIndexOf('/') + 1));
        String forwardedFor = request.getHeader("X-Forwarded-For");
        String offered = request.getHeader("Sec-WebSocket-Protocol");
        String userAgent = request.getHeader("User-Agent");

        List<String> sensitive = new ArrayList<>();
        if (request.getHeader("Authorization") != null) sensitive.add("Authorization");
        if (request.getHeader("Cookie") != null) sensitive.add("Cookie");

        String detail = "method=" + request.getMethod()
                + " upgrade=" + LogSafe.clean(request.getHeader("Upgrade"), 40)
                + " connection=" + LogSafe.clean(request.getHeader("Connection"), 60)
                + " secWebSocketVersion=" + LogSafe.clean(request.getHeader("Sec-WebSocket-Version"), 20)
                + " secWebSocketKey=" + (request.getHeader("Sec-WebSocket-Key") != null ? "present" : "absent")
                + " secWebSocketExtensions=" + LogSafe.clean(request.getHeader("Sec-WebSocket-Extensions"), 120)
                + " xForwardedProto=" + LogSafe.clean(request.getHeader("X-Forwarded-Proto"), 20)
                + " xForwardedHost=" + LogSafe.clean(request.getHeader("X-Forwarded-Host"), 100)
                + " origin=" + LogSafe.clean(origin, 120)
                + " headersPresentNotLogged=" + sensitive
                + " handledBy=" + (interceptorOutcome == null ? "none (rejected before the handshake interceptor)" : "handshake interceptor")
                + " responseContentType=" + LogSafe.clean(response.getContentType(), 60)
                + " tookMs=" + millis;

        String reason = shape.name();
        OcppConnectionLog.Event event = null;
        if (shape.isNearMiss()) {
            event = OcppConnectionLog.Event.REQUEST_NEAR_MISS;
        } else if (interceptorOutcome == null && status == 403 && origin != null) {
            reason = HandshakeOutcome.ORIGIN_REJECTED.name();
            event = OcppConnectionLog.Event.HANDSHAKE_REJECTED;
        } else if (interceptorOutcome == null && status >= 400) {
            reason = "HTTP_" + status + "_BEFORE_HANDSHAKE";
            event = OcppConnectionLog.Event.HANDSHAKE_REJECTED;
        } else if (HandshakeOutcome.ACCEPTED.name().equals(interceptorOutcome) && status != 101) {
            reason = "UPGRADE_FAILED_HTTP_" + status;
            event = OcppConnectionLog.Event.HANDSHAKE_REJECTED;
        }

        boolean problem = event != null || status >= 400;
        try (OcppMdc mdc = OcppMdc.open().chargePoint(LogSafe.clean(code, 64))) {
            String line = "REQUEST {} {} -> {} shape={} reason={} remote={} xForwardedFor={} offeredProtocols=[{}] "
                    + "userAgent={} {}";
            Object[] args = {request.getMethod(), uri, status, shape, reason, request.getRemoteAddr(),
                    LogSafe.clean(forwardedFor), LogSafe.clean(offered), LogSafe.clean(userAgent, 120), detail};
            if (problem) OcppLoggers.HANDSHAKE.warn(line, args);
            else OcppLoggers.HANDSHAKE.info(line, args);
        }

        // The interceptor stores its own rows; store only what it never saw, plus a failed upgrade.
        if (event != null) {
            auditWriter.enqueue(OcppConnectionLog.builder()
                    .chargePointId(LogSafe.clean(code, 64))
                    .event(event)
                    .reason(reason)
                    .remoteAddr(request.getRemoteAddr())
                    .forwardedFor(LogSafe.clean(forwardedFor, 255))
                    .offeredProtocols(LogSafe.clean(offered, 255))
                    .userAgent(LogSafe.clean(userAgent, 255))
                    .requestUri(uri)
                    .httpStatus(status)
                    .detail(detail)
                    .createdAt(Instant.now())
                    .build());
        }
    }

    static String maskedQuery(String query) {
        if (query == null || query.isEmpty()) return "";
        StringBuilder out = new StringBuilder("?");
        for (String pair : query.split("&")) {
            if (out.length() > 1) out.append('&');
            int eq = pair.indexOf('=');
            if (eq < 0) {
                out.append(pair);
            } else {
                String name = pair.substring(0, eq);
                out.append(name).append('=').append(SENSITIVE_PARAM.matcher(name).find() ? "***" : pair.substring(eq + 1));
            }
        }
        return out.toString();
    }
}

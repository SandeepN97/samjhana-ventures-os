package com.samjhana.security;

import com.samjhana.exception.RequestBodyTooLargeException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Finding F-01: nothing limited the size of a request body, so one stranger could make the server build strings of
 * millions of characters (several copies of each) before any check ran, and a few of them at once could exhaust the
 * memory of the one process that also holds the charger connections.
 *
 * <p>This filter runs before everything else (login, security, JSON parsing) and looks at the size first:
 * <ul>
 *   <li>an ordinary request may carry {@code samjhana.security.max-body-bytes} (default 512 KB; the biggest legitimate
 *       one, a sale with its extra details, is far smaller);</li>
 *   <li>{@code POST /api/ev/sessions/start}, which can carry a camera photo as text, may carry
 *       {@code samjhana.security.max-photo-body-bytes} (default 7.5 MB: a 5 MB photo is about 7 MB as base64);</li>
 *   <li>a file upload ({@code multipart/*}) may carry {@code samjhana.security.max-upload-body-bytes} (default 12 MB;
 *       the upload code applies its own, tighter limits on top).</li>
 * </ul>
 * A request that announces more is answered with 413 without reading any of it. A request that does not announce
 * its size (chunked) is counted as it is read, and reading stops with {@link RequestBodyTooLargeException} as soon
 * as it passes the limit.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestBodyLimitFilter extends OncePerRequestFilter {

    /** The one route that is allowed the bigger photo limit, matched exactly on the raw path. */
    static final String PHOTO_START_PATH = "/api/ev/sessions/start";

    /** Methods that can carry a body. A GET (e.g. the charger's WebSocket handshake) is never wrapped. */
    private static final Set<String> METHODS_WITH_BODY = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final long jsonLimit;
    private final long photoLimit;
    private final long uploadLimit;

    public RequestBodyLimitFilter(
            @Value("${samjhana.security.max-body-bytes:524288}") long jsonLimit,
            @Value("${samjhana.security.max-photo-body-bytes:7864320}") long photoLimit,
            @Value("${samjhana.security.max-upload-body-bytes:12582912}") long uploadLimit) {
        this.jsonLimit = jsonLimit;
        this.photoLimit = photoLimit;
        this.uploadLimit = uploadLimit;
    }

    private long limitFor(HttpServletRequest request) {
        String contentType = request.getContentType();
        if (contentType != null && contentType.regionMatches(true, 0, "multipart/", 0, "multipart/".length())) {
            return uploadLimit;
        }
        if ("POST".equals(request.getMethod()) && PHOTO_START_PATH.equals(request.getRequestURI())) {
            return photoLimit;
        }
        return jsonLimit;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long limit = limitFor(request);
        long announced = request.getContentLengthLong();

        if (announced > limit) {
            response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Connection", "close");
            response.getWriter().write("{\"code\":\"TOO_LARGE\",\"message\":\"That request is too large.\"}");
            return;
        }
        boolean sizeNotAnnounced = announced < 0 && METHODS_WITH_BODY.contains(request.getMethod());
        chain.doFilter(sizeNotAnnounced ? new CountingRequest(request, limit) : request, response);
    }

    /** The request, with its body counted as it is read. */
    private static final class CountingRequest extends HttpServletRequestWrapper {
        private final long limit;
        private ServletInputStream stream;
        private BufferedReader reader;

        CountingRequest(HttpServletRequest request, long limit) {
            super(request);
            this.limit = limit;
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            if (reader != null) throw new IllegalStateException("getReader() has already been called");
            if (stream == null) stream = new CountingStream(super.getInputStream(), limit);
            return stream;
        }

        @Override
        public BufferedReader getReader() throws IOException {
            if (reader == null) {
                if (stream != null) throw new IllegalStateException("getInputStream() has already been called");
                String encoding = getCharacterEncoding();
                Charset charset = encoding == null ? StandardCharsets.ISO_8859_1 : Charset.forName(encoding);
                stream = new CountingStream(super.getInputStream(), limit);
                reader = new BufferedReader(new InputStreamReader(stream, charset));
            }
            return reader;
        }
    }

    private static final class CountingStream extends ServletInputStream {
        private final ServletInputStream in;
        private final long limit;
        private long count;

        CountingStream(ServletInputStream in, long limit) {
            this.in = in;
            this.limit = limit;
        }

        private void count(long bytes) throws RequestBodyTooLargeException {
            count += bytes;
            if (count > limit) {
                throw new RequestBodyTooLargeException("The request body is larger than " + limit + " bytes");
            }
        }

        @Override
        public int read() throws IOException {
            int next = in.read();
            if (next >= 0) count(1);
            return next;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            int read = in.read(buffer, offset, length);
            if (read > 0) count(read);
            return read;
        }

        @Override
        public int available() throws IOException {
            return in.available();
        }

        @Override
        public void close() throws IOException {
            in.close();
        }

        @Override
        public boolean isFinished() {
            return in.isFinished();
        }

        @Override
        public boolean isReady() {
            return in.isReady();
        }

        @Override
        public void setReadListener(ReadListener listener) {
            // Counting is done on blocking reads; refuse the non-blocking mode rather than let it go uncounted.
            throw new UnsupportedOperationException("Non-blocking reads are not supported on this request");
        }
    }
}

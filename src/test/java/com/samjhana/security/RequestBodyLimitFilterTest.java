package com.samjhana.security;

import com.samjhana.exception.RequestBodyTooLargeException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.BufferedReader;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Finding F-01: nothing limited the size of a request body, so a stranger could make the server build strings of
 * millions of characters before any check ran. The filter looks at the size first: an ordinary request may carry
 * a little, the EV start (which carries a photo) more, a multipart upload its own limit, and a body whose size
 * is not announced (chunked) is cut off as soon as it passes the limit.
 */
class RequestBodyLimitFilterTest {

    private static final long JSON = 1_000;
    private static final long PHOTO = 5_000;
    private static final long UPLOAD = 9_000;

    private final RequestBodyLimitFilter filter = new RequestBodyLimitFilter(JSON, PHOTO, UPLOAD);

    private static MockHttpServletRequest request(String method, String path, String contentType, int bytes) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        if (contentType != null) request.setContentType(contentType);
        request.setContent(new byte[bytes]);
        return request;
    }

    private static MockHttpServletRequest json(String method, String path, int bytes) {
        return request(method, path, "application/json", bytes);
    }

    /** A request whose size is not announced, like one sent with "Transfer-Encoding: chunked". */
    private static MockHttpServletRequest chunked(String method, String path, byte[] body) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path) {
            @Override public long getContentLengthLong() { return -1; }
            @Override public int getContentLength() { return -1; }
        };
        request.setRequestURI(path);
        request.setContentType("application/json");
        request.addHeader("Transfer-Encoding", "chunked");
        request.setContent(body);
        return request;
    }

    private MockHttpServletResponse run(MockHttpServletRequest request, MockFilterChain chain) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }

    // ---- announced size ----

    @Test
    void shouldAnswer413WithoutCallingTheRestOfTheChain_whenAnOrdinaryRequestIsOverTheLimit() throws Exception {
        MockFilterChain chain = new MockFilterChain();

        MockHttpServletResponse response = run(json("POST", "/api/public/shop/orders", (int) JSON + 1), chain);

        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString()).contains("\"code\":\"TOO_LARGE\"");
        assertThat(chain.getRequest()).as("the request must not travel any further").isNull();
    }

    @Test
    void shouldLetARequestThrough_whenItIsExactlyAtTheLimit() throws Exception {
        MockFilterChain chain = new MockFilterChain();

        MockHttpServletResponse response = run(json("POST", "/api/public/shop/orders", (int) JSON), chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    void shouldLetAnEmptyPostThrough() throws Exception {
        MockFilterChain chain = new MockFilterChain();

        run(json("POST", "/api/auth/login", 0), chain);

        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    void shouldGiveOnlyTheEvSessionStartTheBiggerLimitForPhotos() throws Exception {
        MockFilterChain allowed = new MockFilterChain();
        MockFilterChain tooBig = new MockFilterChain();

        run(json("POST", "/api/ev/sessions/start", (int) PHOTO), allowed);
        MockHttpServletResponse refused = run(json("POST", "/api/ev/sessions/start", (int) PHOTO + 1), tooBig);

        assertThat(allowed.getRequest()).isNotNull();
        assertThat(refused.getStatus()).isEqualTo(413);
        assertThat(tooBig.getRequest()).isNull();
    }

    @Test
    void shouldNotGiveTheBiggerLimitToAnyOtherRouteOrMethod() throws Exception {
        for (MockHttpServletRequest other : new MockHttpServletRequest[] {
                json("POST", "/api/ev/sessions/stop", (int) JSON + 1),
                json("POST", "/api/ev/sessions/start/", (int) JSON + 1),
                json("POST", "/api/ev/sessions/start/extra", (int) JSON + 1),
                json("PUT", "/api/ev/sessions/start", (int) JSON + 1),
                json("POST", "/api/ev/sessions", (int) JSON + 1),
                json("POST", "/x/api/ev/sessions/start", (int) JSON + 1)}) {
            MockFilterChain chain = new MockFilterChain();
            MockHttpServletResponse response = run(other, chain);
            assertThat(response.getStatus()).as(other.getMethod() + " " + other.getRequestURI()).isEqualTo(413);
            assertThat(chain.getRequest()).isNull();
        }
    }

    @Test
    void shouldGiveMultipartUploadsTheirOwnLimit() throws Exception {
        String multipart = "multipart/form-data; boundary=----x";
        MockFilterChain allowed = new MockFilterChain();
        MockFilterChain tooBig = new MockFilterChain();

        run(request("POST", "/api/media", multipart, (int) UPLOAD), allowed);
        MockHttpServletResponse refused = run(request("POST", "/api/media", multipart, (int) UPLOAD + 1), tooBig);

        assertThat(allowed.getRequest()).isNotNull();
        assertThat(refused.getStatus()).isEqualTo(413);
        assertThat(tooBig.getRequest()).isNull();
    }

    @Test
    void shouldNotLetAJsonRequestUseTheUploadLimit() throws Exception {
        MockFilterChain chain = new MockFilterChain();

        MockHttpServletResponse response = run(json("POST", "/api/media", (int) UPLOAD), chain);

        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void shouldTakeTheContentTypeInAnyCase() throws Exception {
        MockFilterChain chain = new MockFilterChain();

        run(request("POST", "/api/media", "Multipart/Form-Data; boundary=x", (int) UPLOAD), chain);

        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    void shouldNotChangeTheRequest_whenItsSizeIsAnnounced() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletRequest request = json("POST", "/api/auth/login", 100);

        run(request, chain);

        assertThat(chain.getRequest()).isSameAs(request);
    }

    // ---- size not announced ----

    private static byte[] bytes(int count) {
        byte[] body = new byte[count];
        java.util.Arrays.fill(body, (byte) 'a');
        return body;
    }

    @Test
    void shouldCutOffAChunkedBody_whenReadingGoesPastTheLimit() {
        FilterChain reader = (req, res) -> ((HttpServletRequest) req).getInputStream().readAllBytes();

        assertThatThrownBy(() -> filter.doFilter(chunked("POST", "/api/public/shop/orders", bytes((int) JSON + 1)),
                new MockHttpServletResponse(), reader))
                .isInstanceOf(RequestBodyTooLargeException.class);
    }

    @Test
    void shouldLetAChunkedBodyBeReadInFull_whenItIsExactlyAtTheLimit() throws Exception {
        AtomicReference<byte[]> read = new AtomicReference<>();
        FilterChain reader = (req, res) -> read.set(((HttpServletRequest) req).getInputStream().readAllBytes());

        filter.doFilter(chunked("POST", "/api/public/shop/orders", bytes((int) JSON)), new MockHttpServletResponse(), reader);

        assertThat(read.get()).hasSize((int) JSON);
    }

    @Test
    void shouldCountBytesReadOneAtATime() throws Exception {
        FilterChain oneByOne = (req, res) -> {
            InputStream in = ((HttpServletRequest) req).getInputStream();
            while (in.read() >= 0) { /* keep reading */ }
        };

        assertThatThrownBy(() -> filter.doFilter(chunked("POST", "/api/auth/login", bytes((int) JSON + 1)),
                new MockHttpServletResponse(), oneByOne))
                .isInstanceOf(RequestBodyTooLargeException.class);
        // and one byte fewer is fine
        filter.doFilter(chunked("POST", "/api/auth/login", bytes((int) JSON)), new MockHttpServletResponse(), oneByOne);
    }

    @Test
    void shouldCountBytesReadInBlocks() throws Exception {
        FilterChain blocks = (req, res) -> {
            InputStream in = ((HttpServletRequest) req).getInputStream();
            byte[] buffer = new byte[64];
            while (in.read(buffer, 0, buffer.length) >= 0) { /* keep reading */ }
        };

        assertThatThrownBy(() -> filter.doFilter(chunked("PUT", "/api/transactions/1", bytes((int) JSON + 1)),
                new MockHttpServletResponse(), blocks))
                .isInstanceOf(RequestBodyTooLargeException.class);
    }

    @Test
    void shouldCountCharactersReadThroughAReader_asBytes() throws Exception {
        FilterChain viaReader = (req, res) -> {
            BufferedReader reader = ((HttpServletRequest) req).getReader();
            while (reader.read() >= 0) { /* keep reading */ }
        };
        MockHttpServletRequest tooBig = chunked("PATCH", "/api/shop-orders/1/notes", bytes((int) JSON + 1));
        tooBig.setCharacterEncoding(StandardCharsets.UTF_8.name());

        assertThatThrownBy(() -> filter.doFilter(tooBig, new MockHttpServletResponse(), viaReader))
                .isInstanceOf(RequestBodyTooLargeException.class);
    }

    @Test
    void shouldApplyThePhotoLimit_toAChunkedStartRequest() throws Exception {
        AtomicReference<byte[]> read = new AtomicReference<>();
        FilterChain reader = (req, res) -> read.set(((HttpServletRequest) req).getInputStream().readAllBytes());

        filter.doFilter(chunked("POST", "/api/ev/sessions/start", bytes((int) PHOTO)), new MockHttpServletResponse(), reader);

        assertThat(read.get()).hasSize((int) PHOTO);
        assertThatThrownBy(() -> filter.doFilter(chunked("POST", "/api/ev/sessions/start", bytes((int) PHOTO + 1)),
                new MockHttpServletResponse(), reader)).isInstanceOf(RequestBodyTooLargeException.class);
    }

    @Test
    void shouldLeaveAGetAlone_evenWhenItsSizeIsNotAnnounced() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletRequest upgrade = chunked("GET", "/ocpp/charger-1", new byte[0]);
        upgrade.removeHeader("Transfer-Encoding");

        run(upgrade, chain);

        assertThat(chain.getRequest()).as("a request that cannot carry a body is not wrapped").isSameAs(upgrade);
    }
}

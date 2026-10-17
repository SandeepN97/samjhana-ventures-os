package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding F-01 on a real server: a body that does not say how big it is (sent in chunks) cannot be judged up front,
 * so it is counted as it is read and cut off with 413 once it passes the limit. The caller still gets a clean answer
 * and the oversized body never becomes a Java string. A file upload keeps its own, bigger limit.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class RequestBodyLimitRealServerIntegrationTest {

    @LocalServerPort int port;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newHttpClient();

    /** A stream of {@code size} identical bytes that holds nothing in memory; with no length given, it is sent chunked. */
    private static HttpRequest.BodyPublisher chunkedBody(String prefix, long size, String suffix) {
        return HttpRequest.BodyPublishers.ofInputStream(() -> new InputStream() {
            private final byte[] head = prefix.getBytes();
            private final byte[] tail = suffix.getBytes();
            private long position;
            @Override public int read() {
                long total = head.length + size + tail.length;
                if (position >= total) return -1;
                long at = position++;
                if (at < head.length) return head[(int) at];
                if (at < head.length + size) return 'x';
                return tail[(int) (at - head.length - size)];
            }
        });
    }

    private HttpResponse<String> post(String path, HttpRequest.BodyPublisher body, String bearer) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json").POST(body);
        if (bearer != null) request.header("Authorization", bearer);
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void shouldAnswer413_whenAChunkedLoginBodyGrowsPastTheLimit() throws Exception {
        HttpResponse<String> response = post("/api/auth/login",
                chunkedBody("{\"username\":\"", 2_000_000, "\",\"password\":\"x\"}"), null);

        assertThat(response.statusCode()).isEqualTo(413);
        assertThat(response.body()).contains("TOO_LARGE");
    }

    @Test
    void shouldAnswer413_whenAChunkedAnonymousShopOrderGrowsPastTheLimit() throws Exception {
        HttpResponse<String> response = post("/api/public/shop/orders",
                chunkedBody("{\"customerName\":\"", 2_000_000, "\",\"items\":[]}"), null);

        assertThat(response.statusCode()).isEqualTo(413);
    }

    @Test
    void shouldStillAcceptASmallChunkedLogin() throws Exception {
        HttpResponse<String> response = post("/api/auth/login",
                chunkedBody("{\"username\":\"nobody\",\"password\":\"", 20, "\"}"), null);

        assertThat(response.statusCode()).as("a small chunked body is read normally, and this login is simply wrong").isEqualTo(401);
    }

    private HttpResponse<String> upload(int fileBytes, String bearer) throws Exception {
        String boundary = "----limit-test-boundary";
        byte[] head = ("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.png\"\r\n"
                + "Content-Type: image/png\r\n\r\n").getBytes();
        byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes();
        byte[] body = new byte[head.length + fileBytes + tail.length];
        System.arraycopy(head, 0, body, 0, head.length);
        System.arraycopy(tail, 0, body, head.length + fileBytes, tail.length);
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/media"))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .header("Authorization", bearer).POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private String adminBearer() {
        User admin = userRepository.findByUsername("chunk-admin").orElseGet(() -> userRepository.save(
                User.builder().username("chunk-admin").passwordHash(passwordEncoder.encode("x"))
                        .fullName("chunk-admin").fullNameNepali("chunk-admin").role(User.UserRole.ADMIN).build()));
        return "Bearer " + jwtUtil.generateToken(admin);
    }

    @Test
    void shouldLetAFileUploadBiggerThanAnOrdinaryBodyThrough_toBeJudgedByTheUploadCode() throws Exception {
        HttpResponse<String> response = upload(600_000, adminBearer());   // 600 KB: over the 512 KB body limit, under the upload limit

        assertThat(response.statusCode()).as("refused later for not being a real picture, but not by the size check").isNotEqualTo(413);
    }

    @Test
    void shouldRefuseAFileUploadBiggerThanTheUploadLimit_withoutReadingIt() throws Exception {
        HttpResponse<String> response = upload(13 * 1024 * 1024, adminBearer());

        assertThat(response.statusCode()).isEqualTo(413);
    }

    @Test
    void shouldAllowAChunkedEvStartWithAPhotoBiggerThanAnOrdinaryBody() throws Exception {
        User staff = userRepository.findByUsername("chunk-staff").orElseGet(() -> userRepository.save(
                User.builder().username("chunk-staff").passwordHash(passwordEncoder.encode("x"))
                        .fullName("chunk-staff").fullNameNepali("chunk-staff").role(User.UserRole.STAFF).build()));

        HttpResponse<String> response = post("/api/ev/sessions/start",
                chunkedBody("{\"chargePointId\":\"NO-SUCH-CHARGER\",\"plateNumber\":\"BA1PA1234\",\"targetPercent\":80,"
                        + "\"platePhotoDataUrl\":\"data:image/jpeg;base64,", 3_000_000, "\"}"),
                "Bearer " + jwtUtil.generateToken(staff));

        assertThat(response.statusCode()).as("3 MB chunked is fine for the photo route").isNotEqualTo(413);
    }
}

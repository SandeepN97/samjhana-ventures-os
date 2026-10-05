package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The role table, enforced. Every private API endpoint is listed below with the lowest role allowed to call it
 * (docs/ROLES.md explains the choices). The test calls each one as staff, a manager, an admin and a visitor who is
 * not logged in:
 * <ul>
 *   <li>below the lowest role, the answer must be 403 (and 401 when not logged in);</li>
 *   <li>at or above it, the answer must not be 401 or 403 (a 400 or 404 for an empty request is fine).</li>
 * </ul>
 * A new endpoint that is not in the table fails {@link #everyEndpointIsInTheTable()}, so it cannot be added
 * without deciding who may use it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RoleMatrixIntegrationTest {

    private enum Min { STAFF, MANAGER, ADMIN }

    private record Row(String method, String path, Min min) {
        String key() { return method + " " + path; }
    }

    private static Row row(String method, String path, Min min) {
        return new Row(method, path, min);
    }

    /** The policy. "STAFF" means any logged-in user. */
    private static final List<Row> TABLE = List.of(
            // administration
            row("GET", "/api/admin/features", Min.ADMIN),
            row("GET", "/api/admin/users", Min.ADMIN),
            row("POST", "/api/admin/users", Min.ADMIN),
            row("DELETE", "/api/admin/users/{username}", Min.ADMIN),
            row("POST", "/api/admin/users/{username}/reset-password", Min.ADMIN),
            row("PUT", "/api/admin/users/{username}/role", Min.ADMIN),
            row("POST", "/api/admin/demo-reset", Min.ADMIN),
            row("GET", "/api/staff", Min.ADMIN),
            row("GET", "/api/staff/{id}", Min.ADMIN),
            row("POST", "/api/staff", Min.ADMIN),
            row("PUT", "/api/staff/{id}", Min.ADMIN),
            row("DELETE", "/api/staff/{id}", Min.ADMIN),
            // own account
            row("GET", "/api/auth/me", Min.STAFF),
            row("PUT", "/api/auth/profile", Min.STAFF),
            row("POST", "/api/auth/change-password", Min.STAFF),
            row("GET", "/api/auth/my-address", Min.ADMIN),
            // daily work and records
            row("POST", "/api/transactions", Min.STAFF),
            row("GET", "/api/transactions", Min.STAFF),
            row("GET", "/api/transactions/{id}", Min.STAFF),
            row("PUT", "/api/transactions/{id}", Min.MANAGER),
            row("PATCH", "/api/transactions/{id}/approve", Min.MANAGER),
            row("PATCH", "/api/transactions/{id}/reject", Min.MANAGER),
            row("GET", "/api/daily-reports/today-summary", Min.STAFF),
            row("GET", "/api/daily-reports/business-date", Min.STAFF),
            row("GET", "/api/daily-reports/recent", Min.STAFF),
            row("POST", "/api/daily-reports/close", Min.STAFF),
            row("GET", "/api/daily-reports", Min.MANAGER),
            row("GET", "/api/daily-reports/{date}", Min.MANAGER),
            row("GET", "/api/daily-reports/{date}/transactions", Min.STAFF),
            row("PATCH", "/api/daily-reports/{date}/verify", Min.MANAGER),
            row("GET", "/api/analytics/summary", Min.STAFF),
            row("GET", "/api/settings/{key}", Min.MANAGER),
            row("PUT", "/api/settings/{key}", Min.MANAGER),
            // petrol
            row("GET", "/api/fuel-prices/current/{fuelType}", Min.STAFF),
            row("GET", "/api/fuel-prices", Min.STAFF),
            row("POST", "/api/fuel-prices", Min.MANAGER),
            row("POST", "/api/fuel-prices/bulk", Min.MANAGER),
            row("POST", "/api/fuel-prices/fetch-noc", Min.MANAGER),
            // EV
            row("GET", "/api/charge-points", Min.STAFF),
            row("POST", "/api/charge-points/{id}/rotate-secret", Min.ADMIN),
            row("PATCH", "/api/charge-points/{id}/lock-behavior", Min.MANAGER),
            row("POST", "/api/ev/sessions/start", Min.STAFF),
            row("GET", "/api/ev/sessions/active", Min.STAFF),
            row("GET", "/api/ev/sessions/recent", Min.STAFF),
            row("GET", "/api/ev/sessions/{id}", Min.STAFF),
            row("POST", "/api/ev/sessions/{id}/stop", Min.STAFF),
            row("POST", "/api/ev/sessions/{id}/mark-paid", Min.STAFF),
            row("POST", "/api/ev/sessions/{id}/unlock", Min.STAFF),
            row("POST", "/api/ev/live-ticket", Min.STAFF),
            row("GET", "/api/ev/vehicle-photos/{vehicleId}", Min.STAFF),
            row("GET", "/api/ev-vehicles", Min.STAFF),
            row("GET", "/api/ev-vehicles/all", Min.ADMIN),
            row("POST", "/api/ev-vehicles", Min.ADMIN),
            row("PUT", "/api/ev-vehicles/{id}", Min.ADMIN),
            row("DELETE", "/api/ev-vehicles/{id}", Min.ADMIN),
            row("GET", "/api/ev/electricity-bills", Min.MANAGER),
            row("POST", "/api/ev/electricity-bills", Min.MANAGER),
            row("GET", "/api/ev/electricity-bills/{id}/reconciliation", Min.MANAGER),
            row("DELETE", "/api/ev/electricity-bills/{id}", Min.MANAGER),
            // rental
            row("GET", "/api/rental-properties", Min.STAFF),
            row("GET", "/api/rental-properties/all", Min.ADMIN),
            row("POST", "/api/rental-properties", Min.ADMIN),
            row("PUT", "/api/rental-properties/{id}", Min.ADMIN),
            row("DELETE", "/api/rental-properties/{id}", Min.ADMIN),
            row("GET", "/api/rental-properties/{id}/ledger", Min.STAFF),
            // furniture
            row("GET", "/api/furniture/dashboard", Min.STAFF),
            row("GET", "/api/furniture/customers", Min.STAFF),
            row("POST", "/api/furniture/customers", Min.STAFF),
            row("PUT", "/api/furniture/customers/{id}", Min.STAFF),
            row("DELETE", "/api/furniture/customers/{id}", Min.MANAGER),
            row("GET", "/api/furniture/items", Min.STAFF),
            row("GET", "/api/furniture/items/{id}", Min.STAFF),
            row("POST", "/api/furniture/items", Min.ADMIN),
            row("PUT", "/api/furniture/items/{id}", Min.ADMIN),
            row("DELETE", "/api/furniture/items/{id}", Min.ADMIN),
            row("PATCH", "/api/furniture/items/{id}/stock", Min.MANAGER),
            row("GET", "/api/furniture/orders", Min.STAFF),
            row("PATCH", "/api/furniture/orders/{id}/delivery-status", Min.STAFF),
            // beekeeping
            row("GET", "/api/beekeeping/dashboard", Min.STAFF),
            row("GET", "/api/beekeeping/items", Min.STAFF),
            row("GET", "/api/beekeeping/items/{id}", Min.STAFF),
            row("POST", "/api/beekeeping/items", Min.ADMIN),
            row("PUT", "/api/beekeeping/items/{id}", Min.ADMIN),
            row("DELETE", "/api/beekeeping/items/{id}", Min.ADMIN),
            row("PATCH", "/api/beekeeping/items/{id}/stock", Min.MANAGER),
            row("GET", "/api/beekeeping/orders", Min.STAFF),
            // online shop and website
            row("GET", "/api/shop-orders", Min.STAFF),
            row("GET", "/api/shop-orders/summary", Min.STAFF),
            row("GET", "/api/shop-orders/{id}", Min.STAFF),
            row("PATCH", "/api/shop-orders/{id}/status", Min.STAFF),
            row("PATCH", "/api/shop-orders/{id}/notes", Min.STAFF),
            row("GET", "/api/site-content", Min.MANAGER),
            row("PUT", "/api/site-content/{key}", Min.MANAGER),
            row("GET", "/api/restaurant/dishes", Min.STAFF),
            row("POST", "/api/restaurant/dishes", Min.ADMIN),
            row("PUT", "/api/restaurant/dishes/{id}", Min.ADMIN),
            row("PATCH", "/api/restaurant/dishes/{id}/available", Min.MANAGER),
            row("DELETE", "/api/restaurant/dishes/{id}", Min.ADMIN),
            row("POST", "/api/media", Min.MANAGER),
            row("DELETE", "/api/media/{id}", Min.ADMIN));

    /**
     * Endpoints that check the request body before the role check run (a {@code @Valid} body is checked first), so an
     * empty body would be answered with 400 even for someone who is not allowed. These get a valid body instead.
     */
    private static final Map<String, String> VALID_BODIES = Map.of(
            "POST /api/ev/electricity-bills",
            "{\"periodStart\":\"2026-01-01\",\"periodEnd\":\"2026-01-31\",\"billedKwh\":100,\"amountPaid\":1500}");

    /** Open to everyone on purpose (see SecurityConfig); not part of the role table. */
    private static final List<String> NOT_ROLE_PROTECTED = List.of("/api/public/", "/api/auth/login", "/api/fuel-prices/current");

    @Autowired MockMvc mockMvc;
    @Autowired @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping handlerMapping;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JwtUtil jwtUtil;

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).isActive(true).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    /** Every private API endpoint the app really has, as "METHOD /path". */
    private Map<String, HandlerMethod> realEndpoints() {
        Map<String, HandlerMethod> found = new LinkedHashMap<>();
        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : handlerMapping.getHandlerMethods().entrySet()) {
            var info = entry.getKey();
            var patterns = info.getPathPatternsCondition() != null
                    ? info.getPathPatternsCondition().getPatternValues()
                    : info.getPatternValues();
            for (String pattern : patterns) {
                if (!pattern.startsWith("/api/")) continue;
                if (NOT_ROLE_PROTECTED.stream().anyMatch(pattern::startsWith) && !pattern.startsWith("/api/fuel-prices/current/")) continue;
                for (var method : info.getMethodsCondition().getMethods()) {
                    found.put(method.name() + " " + pattern, entry.getValue());
                }
            }
        }
        return found;
    }

    @Test
    void everyEndpointIsInTheTable() {
        var real = new TreeSet<>(realEndpoints().keySet());
        var listed = new TreeSet<String>();
        TABLE.forEach(r -> listed.add(r.key()));

        var missing = new TreeSet<>(real);
        missing.removeAll(listed);
        var stale = new TreeSet<>(listed);
        stale.removeAll(real);

        assertThat(missing).as("endpoints with no role decision in RoleMatrixIntegrationTest.TABLE").isEmpty();
        assertThat(stale).as("table rows that match no real endpoint").isEmpty();
    }

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\w+)}");

    private static String fill(String path) {
        Matcher m = PLACEHOLDER.matcher(path);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String name = m.group(1);
            String value = switch (name) {
                case "date" -> "2026-01-02";
                case "fuelType" -> "petrol";
                case "key" -> "nea_rate";
                case "username" -> "matrix-nobody";
                default -> UUID.randomUUID().toString();
            };
            m.appendReplacement(out, Matcher.quoteReplacement(value));
        }
        m.appendTail(out);
        return out.toString();
    }

    private MockHttpServletRequestBuilder request(Row row, HandlerMethod handler) {
        String uri = fill(row.path());
        boolean multipart = handler != null && java.util.Arrays.stream(handler.getMethodParameters())
                .anyMatch(p -> MultipartFile.class.isAssignableFrom(p.getParameterType()));
        if (multipart) {
            return MockMvcRequestBuilders.multipart(HttpMethod.valueOf(row.method()), uri)
                    .file(new MockMultipartFile("file", "a.png", "image/png", new byte[]{1, 2, 3}));
        }
        MockHttpServletRequestBuilder builder = MockMvcRequestBuilders.request(HttpMethod.valueOf(row.method()), uri);
        if (!row.method().equals("GET") && !row.method().equals("DELETE")) {
            builder.contentType(MediaType.APPLICATION_JSON).content(VALID_BODIES.getOrDefault(row.key(), "{}"));
        }
        return builder;
    }

    @TestFactory
    List<DynamicTest> everyRoleGetsTheAnswerTheTableSays() {
        String staff = bearer("matrix-staff", User.UserRole.STAFF);
        String manager = bearer("matrix-manager", User.UserRole.MANAGER);
        String admin = bearer("matrix-admin", User.UserRole.ADMIN);
        Map<String, HandlerMethod> real = realEndpoints();

        List<DynamicTest> tests = new ArrayList<>();
        for (Row row : TABLE) {
            HandlerMethod handler = real.get(row.key());
            tests.add(DynamicTest.dynamicTest(row.key() + " (lowest role: " + row.min() + ")", () -> {
                int visitor = mockMvc.perform(request(row, handler)).andReturn().getResponse().getStatus();
                assertThat(visitor).as("not logged in").isEqualTo(401);

                check(row, handler, "staff", staff, row.min() == Min.STAFF);
                check(row, handler, "manager", manager, row.min() != Min.ADMIN);
                check(row, handler, "admin", admin, true);
            }));
        }
        return tests;
    }

    private void check(Row row, HandlerMethod handler, String who, String authorization, boolean allowed) throws Exception {
        int status = mockMvc.perform(request(row, handler).header("Authorization", authorization))
                .andReturn().getResponse().getStatus();
        if (allowed) {
            assertThat(status).as(who + " should be allowed on " + row.key()).isNotIn(401, 403);
        } else {
            assertThat(status).as(who + " should be refused on " + row.key()).isEqualTo(403);
        }
    }
}

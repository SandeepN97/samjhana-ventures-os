package com.samjhana.security;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Turns a valid Bearer token into a logged-in user for this request. Besides the signature and
 * expiry, the account must still be active and its password unchanged since the token was issued
 * (see {@link JwtUtil#isTokenValidFor}); otherwise the request continues unauthenticated and gets a 401.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    /** The only things a person with a temporary password may do: see who they are, and change the password. */
    private static boolean allowedWhileChangingPassword(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "/api/auth/change-password".equals(path) || "/api/auth/me".equals(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        User authenticated = null;

        if (authHeader != null && authHeader.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            authenticated = jwtUtil.parse(authHeader.substring(7))
                    .flatMap(claims -> userRepository.findByUsername(claims.getSubject())
                            .filter(user -> jwtUtil.isTokenValidFor(claims, user)))
                    .orElse(null);
            if (authenticated != null) {
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(authenticated, null, authenticated.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        // An admin reset this password: nothing else works until the person has chosen their own.
        // Enforced here, not in the app screens, so it cannot be skipped by calling the API directly.
        if (authenticated != null && Boolean.TRUE.equals(authenticated.getMustChangePassword())
                && !allowedWhileChangingPassword(request)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"code\":\"PASSWORD_CHANGE_REQUIRED\","
                    + "\"message\":\"You must choose a new password before continuing.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}

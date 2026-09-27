package com.samjhana.security;

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

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (authHeader != null && authHeader.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            jwtUtil.parse(authHeader.substring(7)).ifPresent(claims ->
                    userRepository.findByUsername(claims.getSubject())
                            .filter(user -> jwtUtil.isTokenValidFor(claims, user))
                            .ifPresent(user -> {
                                UsernamePasswordAuthenticationToken authToken =
                                        new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                                SecurityContextHolder.getContext().setAuthentication(authToken);
                            }));
        }

        filterChain.doFilter(request, response);
    }
}

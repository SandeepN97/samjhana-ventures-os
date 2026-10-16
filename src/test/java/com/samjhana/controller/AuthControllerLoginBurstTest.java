package com.samjhana.controller;

import com.samjhana.dto.LoginRequest;
import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.ClientAddressResolver;
import com.samjhana.security.JwtUtil;
import com.samjhana.security.LoginAttemptService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Finding P1B2-01: forty guesses at one account that arrive together used to be judged against a counter that was still
 * at zero, so every one of them reached the (slow) password check. Now an attempt is counted as it starts, so no more
 * than the limit of ten reach the password check, however they are timed.
 */
@ExtendWith(MockitoExtension.class)
class AuthControllerLoginBurstTest {

    @Mock AuthenticationManager authenticationManager;
    @Mock JwtUtil jwtUtil;
    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;

    private LoginAttemptService attempts;
    private AuthController controller;

    @BeforeEach
    void setUp() {
        attempts = new LoginAttemptService(false);
        controller = new AuthController(authenticationManager, jwtUtil, userRepository, passwordEncoder, attempts,
                new ClientAddressResolver(0));
    }

    private static LoginRequest request(String username, String password) {
        LoginRequest request = new LoginRequest();
        request.setUsername(username);
        request.setPassword(password);
        return request;
    }

    @Test
    void shouldLetOnlyTenOfFortySimultaneousGuessesReachThePasswordCheck() throws Exception {
        AtomicInteger reachedThePasswordCheck = new AtomicInteger();
        CountDownLatch passwordCheckMayFinish = new CountDownLatch(1);
        when(authenticationManager.authenticate(any())).thenAnswer(inv -> {
            reachedThePasswordCheck.incrementAndGet();
            passwordCheckMayFinish.await(10, TimeUnit.SECONDS);   // the slow BCrypt comparison
            throw new BadCredentialsException("bad");
        });

        ExecutorService pool = Executors.newFixedThreadPool(40);
        try {
            AtomicInteger refused = new AtomicInteger();
            AtomicInteger wrong = new AtomicInteger();
            List<Future<?>> done = new ArrayList<>();
            for (int i = 0; i < 40; i++) {
                String guess = "guess-" + i;
                done.add(pool.submit(() -> {
                    try {
                        ResponseEntity<?> answer = controller.login(request("admin", guess), new MockHttpServletRequest());
                        if (answer.getStatusCode().value() == 429) refused.incrementAndGet();
                    } catch (BadCredentialsException e) {
                        wrong.incrementAndGet();
                    }
                }));
            }
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            while (refused.get() < 30 && System.nanoTime() < deadline) Thread.sleep(10);   // the refused ones answer at once
            passwordCheckMayFinish.countDown();
            for (Future<?> f : done) f.get(10, TimeUnit.SECONDS);

            assertThat(reachedThePasswordCheck.get()).isEqualTo(10);
            assertThat(wrong.get()).isEqualTo(10);
            assertThat(refused.get()).isEqualTo(30);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void shouldStopAfterTenWrongPasswords_evenWhenTheyCameOneByOne() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));
        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> controller.login(request("admin", "nope"), new MockHttpServletRequest()))
                    .isInstanceOf(BadCredentialsException.class);
        }

        ResponseEntity<?> answer = controller.login(request("admin", "nope"), new MockHttpServletRequest());

        assertThat(answer.getStatusCode().value()).isEqualTo(429);
        assertThat(((Map<?, ?>) answer.getBody()).get("message")).isEqualTo("Too many wrong passwords. Try again in 15 minutes.");
    }

    @Test
    void shouldForgetTheMistakes_afterTheRightPassword() {
        User user = User.builder().id(java.util.UUID.randomUUID()).username("dad").fullName("Dad").fullNameNepali("Dad")
                .role(User.UserRole.STAFF).build();
        Authentication ok = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("bad")).thenThrow(new BadCredentialsException("bad"))
                .thenReturn(ok);
        when(jwtUtil.generateToken(user)).thenReturn("token");
        for (int i = 0; i < 2; i++) {
            assertThatThrownBy(() -> controller.login(request("dad", "typo"), new MockHttpServletRequest()))
                    .isInstanceOf(BadCredentialsException.class);
        }

        assertThat(controller.login(request("dad", "right"), new MockHttpServletRequest()).getStatusCode().value()).isEqualTo(200);

        // nine more wrong passwords are allowed again, because the right one cleared the count
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));
        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> controller.login(request("dad", "typo"), new MockHttpServletRequest()))
                    .isInstanceOf(BadCredentialsException.class);
        }
    }

    @Test
    void shouldNotHoldAnErrorOtherThanAWrongPasswordAgainstTheUsername() {
        when(authenticationManager.authenticate(any())).thenThrow(new IllegalStateException("database down"));
        for (int i = 0; i < 40; i++) {
            assertThatThrownBy(() -> controller.login(request("dad", "right"), new MockHttpServletRequest()))
                    .isInstanceOf(IllegalStateException.class);
        }

        assertThat(attempts.isBlocked("dad")).isFalse();
    }
}

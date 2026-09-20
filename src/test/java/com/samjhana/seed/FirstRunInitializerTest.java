package com.samjhana.seed;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Profiles;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** First-boot admin creation for real environments: hashed password, never logged when the operator chose it. */
@ExtendWith(MockitoExtension.class)
class FirstRunInitializerTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;

    private FirstRunInitializer initializer;
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private final Logger logger = (Logger) LoggerFactory.getLogger(FirstRunInitializer.class);

    @BeforeEach
    void setUp() {
        initializer = new FirstRunInitializer(userRepository, passwordEncoder);
        lenient().when(passwordEncoder.encode(anyString())).thenAnswer(inv -> "hash(" + inv.getArgument(0) + ")");
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void releaseLogs() {
        logger.detachAppender(logs);
    }

    private User savedUser() {
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        return saved.getValue();
    }

    private String encodedPassword() {
        ArgumentCaptor<String> raw = ArgumentCaptor.forClass(String.class);
        verify(passwordEncoder).encode(raw.capture());
        return raw.getValue();
    }

    private long logLinesContaining(String text) {
        return logs.list.stream().filter(e -> e.getFormattedMessage().contains(text)).count();
    }

    @Test
    void shouldCreateAnActiveAdminWithTheProvidedPasswordHashed_whenNoUsersExist() {
        when(userRepository.count()).thenReturn(0L);
        ReflectionTestUtils.setField(initializer, "adminInitialPassword", "Chosen-Passw0rd!");

        initializer.run();

        User admin = savedUser();
        assertEquals("admin", admin.getUsername());
        assertEquals(User.UserRole.ADMIN, admin.getRole());
        assertTrue(admin.isEnabled());
        assertEquals("hash(Chosen-Passw0rd!)", admin.getPassword());
        assertNotEquals("Chosen-Passw0rd!", admin.getPassword(), "the plaintext password must never be stored");
    }

    @Test
    void shouldNeverLogAPasswordTheOperatorChose() {
        when(userRepository.count()).thenReturn(0L);
        ReflectionTestUtils.setField(initializer, "adminInitialPassword", "Chosen-Passw0rd!");

        initializer.run();

        assertEquals(0, logLinesContaining("Chosen-Passw0rd!"));
        assertTrue(logLinesContaining("set via ADMIN_INITIAL_PASSWORD") > 0);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   "})
    void shouldGenerateARandomPasswordAndLogItOnce_whenNoneIsProvided(String provided) {
        when(userRepository.count()).thenReturn(0L);
        ReflectionTestUtils.setField(initializer, "adminInitialPassword", provided);

        initializer.run();

        String generated = encodedPassword();
        assertTrue(generated.matches("[A-Za-z0-9_-]{22}"), "expected 16 random bytes, url-safe base64: " + generated);
        assertEquals("hash(" + generated + ")", savedUser().getPassword());
        assertEquals(1, logLinesContaining(generated), "the generated password is shown exactly once, in the log");
    }

    @Test
    void shouldGenerateADifferentPasswordOnEachFirstRun() {
        when(userRepository.count()).thenReturn(0L);

        initializer.run();
        initializer.run();

        ArgumentCaptor<String> raw = ArgumentCaptor.forClass(String.class);
        verify(passwordEncoder, times(2)).encode(raw.capture());
        assertNotEquals(raw.getAllValues().get(0), raw.getAllValues().get(1));
    }

    @Test
    void shouldDoNothing_whenAUserAlreadyExists() {
        when(userRepository.count()).thenReturn(1L);
        ReflectionTestUtils.setField(initializer, "adminInitialPassword", "Chosen-Passw0rd!");

        initializer.run();

        verify(userRepository, never()).save(any(User.class));
        verifyNoInteractions(passwordEncoder);
        assertTrue(logs.list.isEmpty(), "an existing installation must not print a first-run banner");
    }

    @Test
    void shouldOnlyRunOutsideTheDevAndTestProfiles() {
        Profile profile = FirstRunInitializer.class.getAnnotation(Profile.class);
        assertNotNull(profile, "FirstRunInitializer must be profile-restricted");
        Profiles expression = Profiles.of(profile.value());

        assertTrue(active(expression), "default profile");
        assertTrue(active(expression, "prod"));
        assertFalse(active(expression, "dev"));
        assertFalse(active(expression, "test"));
        assertFalse(active(expression, "dev", "prod"));
    }

    private static boolean active(Profiles expression, String... activeProfiles) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(activeProfiles);
        return environment.acceptsProfiles(expression);
    }
}

package com.samjhana.seed;

import ch.qos.logback.classic.Level;
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
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Profiles;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Method;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Staging and production must not keep a login whose password is published in this public repository
 * (finding P1BX-01). The check uses a real BCrypt encoder, like the app does, and a mocked repository.
 */
@ExtendWith(MockitoExtension.class)
class PublishedCredentialGuardTest {

    @Mock UserRepository userRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private final Logger logger = (Logger) LoggerFactory.getLogger(PublishedCredentialGuard.class);
    private PublishedCredentialGuard guard;

    @BeforeEach
    void setUp() {
        guard = new PublishedCredentialGuard(userRepository, passwordEncoder);
        // the guard looks up every listed name; a test only stubs the accounts that exist in its scenario
        lenient().when(userRepository.findByUsername(anyString())).thenReturn(Optional.empty());
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void releaseLogs() {
        logger.detachAppender(logs);
    }

    private User account(String username, String password, boolean active) {
        return User.builder().username(username).passwordHash(passwordEncoder.encode(password))
                .fullName(username).role(User.UserRole.STAFF).isActive(active).build();
    }

    private User existing(String username, String password, boolean active) {
        User user = account(username, password, active);
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));
        return user;
    }

    private long logLinesContaining(String text) {
        return logs.list.stream().filter(e -> e.getFormattedMessage().contains(text)).count();
    }

    @Test
    void shouldSwitchOffAnActiveAccount_whenItsPasswordIsItsUsername() {
        User admin = existing("admin", "admin", true);

        int switchedOff = guard.disablePublishedLogins();

        assertEquals(1, switchedOff);
        assertFalse(admin.isEnabled(), "the account must no longer be able to sign in");
        verify(userRepository).save(admin);
    }

    @ParameterizedTest
    @ValueSource(strings = {"manager", "staff"})
    void shouldSwitchOffAnActiveAccount_whenItsPasswordIsTheUsernameFollowedBy123(String username) {
        User user = existing(username, username + "123", true);

        assertEquals(1, guard.disablePublishedLogins());

        assertFalse(user.isEnabled());
        verify(userRepository).save(user);
    }

    @ParameterizedTest
    @ValueSource(strings = {"admin", "manager", "staff", "demo", "ram_mgr", "sita_staff", "hari_staff"})
    void shouldCheckEveryAccountNameThatASeederOrAnOldResetCreated(String username) {
        User user = existing(username, username, true);

        assertEquals(1, guard.disablePublishedLogins());

        assertFalse(user.isEnabled(), username + " must be switched off");
    }

    @Test
    void shouldLeaveAnAccountAlone_whenItsPasswordIsNotPublished() {
        User admin = existing("admin", "Vx9!kqLw2#Rt7pZe", true);

        assertEquals(0, guard.disablePublishedLogins());

        assertTrue(admin.isEnabled());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void shouldSkipAnInactiveAccount_andAccountsThatDoNotExist() {
        User demo = existing("demo", "demo", false);

        assertEquals(0, guard.disablePublishedLogins());

        assertFalse(demo.isEnabled());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void shouldAlsoSwitchOffAnAccount_whenItsPasswordIsAConfiguredPublishedValue() {
        ReflectionTestUtils.setField(guard, "extraPublishedPasswords", "x1-legacy, ,x2-legacy");
        User legacy = existing("ram_mgr", "x2-legacy", true);

        assertEquals(1, guard.disablePublishedLogins());

        assertFalse(legacy.isEnabled());
        verify(userRepository).save(legacy);
    }

    @Test
    void shouldNameTheAccountInTheLog_butNeverAPassword() {
        ReflectionTestUtils.setField(guard, "extraPublishedPasswords", "x2-legacy");
        existing("ram_mgr", "x2-legacy", true);

        guard.disablePublishedLogins();

        assertEquals(0, logLinesContaining("x2-legacy"), "a password must never be written to the log");
        assertTrue(logs.list.stream().anyMatch(e -> e.getLevel() == Level.ERROR
                        && e.getFormattedMessage().contains("ram_mgr")
                        && e.getFormattedMessage().contains("switched OFF")),
                "an operator must see an ERROR line naming the account");
    }

    @Test
    void shouldReportAQuietCheck_whenNoAccountAcceptsAPublishedPassword() {
        assertEquals(0, guard.disablePublishedLogins());

        assertTrue(logLinesContaining("no active account accepts a published password") > 0);
        assertTrue(logs.list.stream().noneMatch(e -> e.getLevel() == Level.ERROR));
    }

    @Test
    void shouldKeepCheckingTheOtherAccounts_whenOneCannotBeRead() {
        when(userRepository.findByUsername("admin")).thenThrow(new IllegalStateException("database hiccup"));
        User staff = existing("staff", "staff123", true);

        int switchedOff = guard.disablePublishedLogins();

        assertEquals(1, switchedOff);
        assertFalse(staff.isEnabled());
        assertTrue(logs.list.stream().anyMatch(e -> e.getLevel() == Level.ERROR
                && e.getFormattedMessage().contains("admin")), "the account that could not be checked is named");
    }

    @Test
    void shouldRunWhenTheApplicationIsReady() throws Exception {
        Method listener = PublishedCredentialGuard.class.getMethod("onApplicationReady");
        EventListener annotation = listener.getAnnotation(EventListener.class);
        assertNotNull(annotation, "the check must be wired to a startup event");
        assertArrayEquals(new Class<?>[] {ApplicationReadyEvent.class}, annotation.value());

        User admin = existing("admin", "admin", true);
        guard.onApplicationReady();

        assertFalse(admin.isEnabled());
    }

    @Test
    void shouldOnlyRunOutsideTheDevAndTestProfiles() {
        Profile profile = PublishedCredentialGuard.class.getAnnotation(Profile.class);
        assertNotNull(profile, "PublishedCredentialGuard must be profile-restricted");
        Profiles expression = Profiles.of(profile.value());

        assertTrue(active(expression), "default profile");
        assertTrue(active(expression, "staging"));
        assertTrue(active(expression, "prod"));
        assertFalse(active(expression, "dev"), "dev keeps its documented logins");
        assertFalse(active(expression, "test"));
        assertFalse(active(expression, "dev", "prod"));
    }

    private static boolean active(Profiles expression, String... activeProfiles) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(activeProfiles);
        return environment.acceptsProfiles(expression);
    }
}

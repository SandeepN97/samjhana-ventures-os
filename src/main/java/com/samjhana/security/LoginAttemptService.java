package com.samjhana.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Slows down password guessing. Wrong passwords are counted for {@link #WINDOW}, then forgotten.
 *
 * <p>With the address limits OFF (the default) one counter applies: {@link #MAX_FAILURES} wrong passwords for
 * one username and further attempts for that username are refused until the oldest failure ages out.
 *
 * <p>With the address limits ON, and the visitor's address known, three counters apply:
 * <ul>
 *   <li>{@link #MAX_PAIR_FAILURES} wrong passwords for one username from one address blocks that address for
 *       that username, so someone guessing at "admin" no longer locks the real admin out on another address;</li>
 *   <li>{@link #MAX_ADDRESS_FAILURES} wrong passwords from one address, for any usernames, blocks that address
 *       (password spraying), kept generous because many people in Nepal share one internet address;</li>
 *   <li>{@link #MAX_FAILURES_WITH_ADDRESS_LIMITS} wrong passwords for one username from anywhere is a last resort.</li>
 * </ul>
 * A correct login clears the username and the username+address counters, not the address total.
 *
 * <p>Everything is held in memory only: no address is saved to the database or written to a log, and a
 * restart forgets it all. In memory is fine for a single instance. Every table is capped at
 * {@link #MAX_TRACKED_KEYS} entries so invented usernames and addresses cannot grow memory without limit: the address
 * tables stop recording new keys when full, and the username table drops the name used least recently (so a name that
 * is being guessed at stays in it, while a flood of made-up names pushes out only each other). A username is cut to
 * {@link #MAX_USERNAME_LENGTH} characters, the length of a real one, before it is used as a key.
 */
@Component
public class LoginAttemptService {

    static final int MAX_FAILURES = 10;
    static final int MAX_FAILURES_WITH_ADDRESS_LIMITS = 50;
    static final int MAX_PAIR_FAILURES = 5;
    static final int MAX_ADDRESS_FAILURES = 30;
    static final int MAX_TRACKED_KEYS = 20_000;
    static final int MAX_USERNAME_LENGTH = 50;
    static final Duration WINDOW = Duration.ofMinutes(15);

    /** Least recently used first; once it holds {@link #MAX_TRACKED_KEYS} names the least recently used one is dropped. */
    private final Map<String, Deque<Instant>> failures = Collections.synchronizedMap(
            new LinkedHashMap<String, Deque<Instant>>(256, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Deque<Instant>> eldest) {
                    return size() > MAX_TRACKED_KEYS;
                }
            });
    private final Map<String, Deque<Instant>> pairFailures = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> addressFailures = new ConcurrentHashMap<>();
    private final Clock clock;
    private final boolean addressLimits;
    /** The most login attempts the whole endpoint admits in a minute, or 0 for no ceiling. */
    private final int globalPerMinute;
    private final Deque<Instant> recentAttempts = new ArrayDeque<>();

    @Autowired
    public LoginAttemptService(@Value("${samjhana.security.login.ip-limits-enabled:false}") boolean addressLimits,
                               @Value("${samjhana.security.login.global-per-minute:120}") int globalPerMinute) {
        this(Clock.systemUTC(), addressLimits, globalPerMinute);
    }

    /** No ceiling on the whole endpoint. */
    public LoginAttemptService(boolean addressLimits) {
        this(Clock.systemUTC(), addressLimits, 0);
    }

    LoginAttemptService(Clock clock) {
        this(clock, false);
    }

    LoginAttemptService(Clock clock, boolean addressLimits) {
        this(clock, addressLimits, 0);
    }

    LoginAttemptService(Clock clock, boolean addressLimits, int globalPerMinute) {
        this.clock = clock;
        this.addressLimits = addressLimits;
        this.globalPerMinute = globalPerMinute;
    }

    /** What {@link #tryBegin} decided about one login attempt. */
    public enum Decision {
        /** Go on and check the password. The attempt is already counted. */
        ALLOWED,
        /** Too many wrong passwords for this username (or from this address): refuse without checking the password. */
        TOO_MANY_WRONG_PASSWORDS,
        /** The whole login endpoint is over its ceiling for this minute: refuse without checking the password. */
        BUSY
    }

    public boolean addressLimitsEnabled() {
        return addressLimits;
    }

    /**
     * Decides, in one atomic step, whether this login attempt may go on to the (slow) password check, and if it may,
     * counts it right now as a wrong password. A burst of guesses that arrive together can therefore not all be
     * admitted before the first failure is written down (finding P1B2-01). Afterwards the caller reports
     * {@link #attemptSucceeded} when the password was right, or {@link #attemptNotCounted} when the attempt failed for a
     * reason that is not the password; a wrong password needs nothing more, it is already counted.
     *
     * <p>The username and, when the address limits are on, the username+address and address counters are looked at
     * first; an attempt they refuse leaves nothing behind. Only attempts they admit use up the endpoint-wide ceiling
     * ({@code samjhana.security.login.global-per-minute}, finding A-01), which stops a stream of made-up usernames, each
     * of which would cost a full BCrypt comparison, from keeping every processor busy.
     */
    public Decision tryBegin(String username, String address) {
        return tryBegin(username, address, true);
    }

    /**
     * As {@link #tryBegin(String, String)}; {@code endpointWide} says whether an admitted attempt also uses up the
     * ceiling on the whole login endpoint. Changing a password (which needs a signed-in user already) does not.
     */
    public Decision tryBegin(String username, String address, boolean endpointWide) {
        boolean byAddress = usesAddress(address);
        String name = key(username);
        String pair = byAddress ? pairKey(username, address) : null;
        int userMax = byAddress ? MAX_FAILURES_WITH_ADDRESS_LIMITS : MAX_FAILURES;

        if (!reserve(failures, name, userMax, false)) return Decision.TOO_MANY_WRONG_PASSWORDS;
        if (byAddress) {
            if (!reserve(pairFailures, pair, MAX_PAIR_FAILURES, true)) {
                giveBack(failures, name);
                return Decision.TOO_MANY_WRONG_PASSWORDS;
            }
            if (!reserve(addressFailures, address, MAX_ADDRESS_FAILURES, true)) {
                giveBack(failures, name);
                giveBack(pairFailures, pair);
                return Decision.TOO_MANY_WRONG_PASSWORDS;
            }
        }
        if (endpointWide && !withinCeiling()) {
            giveBack(failures, name);
            if (byAddress) {
                giveBack(pairFailures, pair);
                giveBack(addressFailures, address);
            }
            return Decision.BUSY;
        }
        return Decision.ALLOWED;
    }

    /** The password was right: forget the username's (and username+address) count. Many people share one internet address, so the address total is given back too. */
    public void attemptSucceeded(String username, String address) {
        recordSuccess(username, address);
        if (usesAddress(address)) giveBack(addressFailures, address);
    }

    /** The attempt failed for a reason other than the password (for example the database was down): do not hold it against anyone. */
    public void attemptNotCounted(String username, String address) {
        giveBack(failures, key(username));
        if (usesAddress(address)) {
            giveBack(pairFailures, pairKey(username, address));
            giveBack(addressFailures, address);
        }
    }

    /** Username-only check, with the original limit. */
    public boolean isBlocked(String username) {
        return isOver(failures, key(username), MAX_FAILURES);
    }

    /** True when this username, or this address, has made too many wrong passwords. The address may be null. */
    public boolean isBlocked(String username, String address) {
        boolean byAddress = usesAddress(address);
        if (isOver(failures, key(username), byAddress ? MAX_FAILURES_WITH_ADDRESS_LIMITS : MAX_FAILURES)) {
            return true;
        }
        return byAddress
                && (isOver(pairFailures, pairKey(username, address), MAX_PAIR_FAILURES)
                    || isOver(addressFailures, address, MAX_ADDRESS_FAILURES));
    }

    public void recordFailure(String username) {
        record(failures, key(username), MAX_FAILURES_WITH_ADDRESS_LIMITS, false);
    }

    public void recordFailure(String username, String address) {
        recordFailure(username);
        if (usesAddress(address)) {
            record(pairFailures, pairKey(username, address), MAX_PAIR_FAILURES, true);
            record(addressFailures, address, MAX_ADDRESS_FAILURES, true);
        }
    }

    public void recordSuccess(String username) {
        failures.remove(key(username));
    }

    public void recordSuccess(String username, String address) {
        recordSuccess(username);
        if (usesAddress(address)) {
            pairFailures.remove(pairKey(username, address));
        }
    }

    /**
     * Forgets entries whose failures have all aged out. Without this, every made-up username or address
     * someone tried would be kept for as long as the server runs; with it, memory is bounded by what was
     * tried in the last {@link #WINDOW}.
     */
    @Scheduled(fixedDelayString = "PT5M")
    public void forgetExpired() {
        forgetExpired(failures);
        forgetExpired(pairFailures);
        forgetExpired(addressFailures);
    }

    /** How many usernames currently have failures on record. */
    int trackedUsernames() {
        return failures.size();
    }

    int trackedAddresses() {
        return addressFailures.size();
    }

    int trackedPairs() {
        return pairFailures.size();
    }

    /**
     * Counts one attempt for the key unless it already holds {@code max}; true when the attempt was admitted. A capped
     * table that is full cannot track a new key, so nothing can be refused for it and the attempt is admitted.
     */
    private boolean reserve(Map<String, Deque<Instant>> map, String key, int max, boolean capped) {
        if (capped && map.size() >= MAX_TRACKED_KEYS && !map.containsKey(key)) {
            return true;
        }
        boolean[] admitted = {true};
        map.compute(key, (name, recent) -> {
            Deque<Instant> updated = recent != null ? recent : new ArrayDeque<>();
            dropExpired(updated);
            if (updated.size() >= max) {
                admitted[0] = false;
            } else {
                updated.addLast(clock.instant());
            }
            return updated.isEmpty() ? null : updated;
        });
        return admitted[0];
    }

    /** Takes back the most recent attempt counted for the key. */
    private void giveBack(Map<String, Deque<Instant>> map, String key) {
        map.computeIfPresent(key, (name, recent) -> {
            recent.pollLast();
            return recent.isEmpty() ? null : recent;
        });
    }

    /** True, and counts the attempt, while fewer than the ceiling were admitted in the last minute (always true when there is no ceiling). */
    private boolean withinCeiling() {
        if (globalPerMinute <= 0) return true;
        synchronized (recentAttempts) {
            Instant cutoff = clock.instant().minus(Duration.ofMinutes(1));
            while (!recentAttempts.isEmpty() && recentAttempts.peekFirst().isBefore(cutoff)) recentAttempts.pollFirst();
            if (recentAttempts.size() >= globalPerMinute) return false;
            recentAttempts.addLast(clock.instant());
            return true;
        }
    }

    private boolean usesAddress(String address) {
        return addressLimits && address != null && !address.isBlank();
    }

    private boolean isOver(Map<String, Deque<Instant>> map, String key, int max) {
        boolean[] blocked = {false};
        map.computeIfPresent(key, (name, recent) -> {
            dropExpired(recent);
            blocked[0] = recent.size() >= max;
            return recent.isEmpty() ? null : recent;
        });
        return blocked[0];
    }

    /**
     * Notes one wrong password. Only the latest {@code keep} matter for the limit, so one key can't hold more.
     * Address-based tables are capped: when full, new keys are not recorded (the username counter still is).
     */
    private void record(Map<String, Deque<Instant>> map, String key, int keep, boolean capped) {
        if (capped && map.size() >= MAX_TRACKED_KEYS && !map.containsKey(key)) {
            return;
        }
        map.compute(key, (name, recent) -> {
            Deque<Instant> updated = recent != null ? recent : new ArrayDeque<>();
            dropExpired(updated);
            updated.addLast(clock.instant());
            while (updated.size() > keep) updated.pollFirst();
            return updated;
        });
    }

    private void forgetExpired(Map<String, Deque<Instant>> map) {
        // A copy of the names: looking at an entry of the username table moves it to the "most recently used" end,
        // which must not happen while walking the table itself.
        List<String> names;
        synchronized (map) {
            names = new ArrayList<>(map.keySet());
        }
        for (String name : names) {
            map.computeIfPresent(name, (key, recent) -> {
                dropExpired(recent);
                return recent.isEmpty() ? null : recent;
            });
        }
    }

    // Every read or change of a key's failures happens inside the map's per-key compute, so a
    // clean-up running at the same time as a login attempt can never lose a recorded failure.
    private void dropExpired(Deque<Instant> recent) {
        Instant cutoff = clock.instant().minus(WINDOW);
        while (!recent.isEmpty() && recent.peekFirst().isBefore(cutoff)) {
            recent.pollFirst();
        }
    }

    private static String key(String username) {
        if (username == null) return "";
        String name = username.trim().toLowerCase(Locale.ROOT);
        return name.length() > MAX_USERNAME_LENGTH ? name.substring(0, MAX_USERNAME_LENGTH) : name;
    }

    private static String pairKey(String username, String address) {
        return key(username) + "|" + address;
    }
}

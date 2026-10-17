package com.samjhana.ocpp.diag;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

/**
 * Finding D-04: how many messages one charger connection may send. A steady rate plus a short burst, counted with a clock the
 * test moves by hand.
 */
class FrameRateLimiterTest {

    private static final long SECOND = 1_000_000_000L;
    private static final long MILLI = 1_000_000L;

    private final AtomicLong clock = new AtomicLong(5 * SECOND);

    private FrameRateLimiter limiter(double perSecond, int burst) {
        return new FrameRateLimiter(perSecond, burst, clock::get);
    }

    private int take(FrameRateLimiter limiter, int attempts) {
        int accepted = 0;
        for (int i = 0; i < attempts; i++) {
            if (limiter.tryAcquire()) accepted++;
        }
        return accepted;
    }

    @Test
    void shouldAllowTheWholeBurstAtOnce_andRefuseTheNextFrame() {
        FrameRateLimiter limiter = limiter(20, 60);

        assertThat(take(limiter, 60)).isEqualTo(60);
        assertThat(limiter.tryAcquire()).isFalse();
        assertThat(limiter.tryAcquire()).isFalse();
    }

    @Test
    void shouldRefillAtTheConfiguredRate() {
        FrameRateLimiter limiter = limiter(20, 60);
        take(limiter, 60);

        clock.addAndGet(100 * MILLI); // 20 per second -> 2 frames

        assertThat(take(limiter, 10)).isEqualTo(2);
    }

    @Test
    void shouldNotAddAFrameBeforeAWholeFrameHasAccrued() {
        FrameRateLimiter limiter = limiter(20, 60);
        take(limiter, 60);

        clock.addAndGet(49 * MILLI); // 0.98 of a frame

        assertThat(limiter.tryAcquire()).isFalse();
        clock.addAndGet(2 * MILLI);  // now 1.02
        assertThat(limiter.tryAcquire()).isTrue();
    }

    @Test
    void shouldNeverHoldMoreThanTheBurst_afterALongQuietSpell() {
        FrameRateLimiter limiter = limiter(20, 60);
        take(limiter, 60);

        clock.addAndGet(3600 * SECOND); // an hour of silence

        assertThat(take(limiter, 500)).isEqualTo(60);
    }

    @Test
    void shouldNeverRefuseAChargerThatStaysUnderTheRate() {
        FrameRateLimiter limiter = limiter(20, 60);

        int refused = 0;
        for (int i = 0; i < 6000; i++) { // 10 frames a second for ten minutes
            clock.addAndGet(100 * MILLI);
            if (!limiter.tryAcquire()) refused++;
        }

        assertThat(refused).isZero();
    }

    @Test
    void shouldNeverRefuseTheStartUpBurstOfARealCharger() {
        FrameRateLimiter limiter = limiter(20, 60);

        // boot, a status per connector and a few reports, all within a second or two of connecting
        int refused = 0;
        for (int i = 0; i < 40; i++) {
            clock.addAndGet(20 * MILLI);
            if (!limiter.tryAcquire()) refused++;
        }

        assertThat(refused).isZero();
    }

    @Test
    void shouldHoldASustainedFloodToTheBurstPlusTheRate() {
        FrameRateLimiter limiter = limiter(20, 60);

        int accepted = 0;
        for (int i = 0; i < 400; i++) { // 40 frames a second for ten seconds
            clock.addAndGet(25 * MILLI);
            if (limiter.tryAcquire()) accepted++;
        }

        // the burst of 60 plus 20 a second for 10 seconds (one frame either way for rounding)
        assertThat(accepted).isBetween(259, 261);
    }

    @Test
    void shouldCarryAFractionalRateAcrossCalls() {
        FrameRateLimiter limiter = limiter(0.5, 1); // one frame every two seconds
        assertThat(limiter.tryAcquire()).isTrue();

        clock.addAndGet(1 * SECOND);
        assertThat(limiter.tryAcquire()).isFalse();
        clock.addAndGet(1 * SECOND);
        assertThat(limiter.tryAcquire()).isTrue();
    }

    @Test
    void shouldNotLimitAtAll_whenTheRateIsZeroOrNegative() {
        assertThat(take(limiter(0, 60), 100_000)).isEqualTo(100_000);
        assertThat(take(limiter(-5, 60), 100_000)).isEqualTo(100_000);
    }

    @Test
    void shouldTreatABurstBelowOneAsOne() {
        FrameRateLimiter limiter = limiter(20, 0);

        assertThat(limiter.tryAcquire()).isTrue();
        assertThat(limiter.tryAcquire()).isFalse();
        clock.addAndGet(60 * MILLI);
        assertThat(limiter.tryAcquire()).isTrue();
    }

    @Test
    void shouldAddNothing_whenTheClockGoesBackwards() {
        FrameRateLimiter limiter = limiter(20, 60);
        take(limiter, 60);

        clock.addAndGet(-10 * SECOND);
        assertThat(limiter.tryAcquire()).isFalse();

        clock.addAndGet(10 * SECOND); // back where it was: still nothing accrued
        assertThat(limiter.tryAcquire()).isFalse();
        clock.addAndGet(100 * MILLI);
        assertThat(take(limiter, 10)).isEqualTo(2);
    }

    @Test
    void shouldNotTakeAllowanceAway_whenTheClockGoesBackwardsAndForwardsAgain() {
        FrameRateLimiter limiter = limiter(20, 60); // a full allowance

        clock.addAndGet(-1 * SECOND);
        assertThat(limiter.tryAcquire()).isTrue();    // one frame used; the backward step costs nothing
        clock.addAndGet(500 * MILLI);                 // forwards again, but still behind where it started
        assertThat(limiter.tryAcquire()).isTrue();    // a second frame used

        assertThat(take(limiter, 100)).as("60 less the two frames used").isEqualTo(58);
    }

    @Test
    void shouldMakeAskersTakeTurns_soTwoThreadsNeverUseTheSameFrameShare() throws Exception {
        FrameRateLimiter limiter = limiter(20, 60);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            synchronized (limiter) { // another thread is in the middle of its turn
                Future<Boolean> asked = pool.submit(limiter::tryAcquire);

                assertThatThrownBy(() -> asked.get(300, TimeUnit.MILLISECONDS))
                        .as("a second asker waits for the first to finish").isInstanceOf(TimeoutException.class);
            }
            // once the first is done the waiting asker gets its turn
            assertThat(pool.submit(limiter::tryAcquire).get(5, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void shouldStayWithinItsBudget_whenSeveralThreadsShareIt() throws Exception {
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            for (int round = 0; round < 400; round++) {
                FrameRateLimiter limiter = limiter(20, 60); // the clock never moves: exactly the burst may pass
                CyclicBarrier start = new CyclicBarrier(threads); // every thread asks at the same moment
                AtomicInteger accepted = new AtomicInteger();
                List<Future<?>> done = new ArrayList<>();
                for (int t = 0; t < threads; t++) {
                    done.add(pool.submit(() -> {
                        start.await();
                        for (int i = 0; i < 20; i++) {
                            if (limiter.tryAcquire()) accepted.incrementAndGet();
                        }
                        return null;
                    }));
                }
                for (Future<?> one : done) one.get(30, TimeUnit.SECONDS);

                assertThat(accepted.get()).as("round %d: 160 asked, 60 may pass", round).isEqualTo(60);
            }
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void shouldRefillWithTheRealClock_whenNoClockIsGiven() {
        FrameRateLimiter limiter = new FrameRateLimiter(1000, 1); // one frame a millisecond
        assertThat(limiter.tryAcquire()).isTrue();

        await().atMost(2, TimeUnit.SECONDS).until(limiter::tryAcquire);
    }
}

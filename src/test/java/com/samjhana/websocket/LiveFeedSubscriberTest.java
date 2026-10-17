package com.samjhana.websocket;

import com.samjhana.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Finding D-02: the small queue in front of each live-feed socket. Publishing only ever puts an event here, it never
 * waits for the network; one sender at a time writes the queue out, in order; a socket with too many events waiting
 * is not keeping up.
 */
class LiveFeedSubscriberTest {

    private static final int MAX_WAITING = 3;

    private final WebSocketSession session = mock(WebSocketSession.class);
    private final LiveFeedSubscriber subscriber;

    LiveFeedSubscriberTest() {
        when(session.getId()).thenReturn("socket-1");
        subscriber = new LiveFeedSubscriber(session, "sita", new AccountStamp(User.UserRole.STAFF, "digest"),
                Instant.parse("2026-10-16T08:00:00Z"), 7, MAX_WAITING);
    }

    @Test
    void shouldAskForASender_onlyForTheFirstEventWhileNoneIsRunning() {
        assertThat(subscriber.offer("one")).isEqualTo(LiveFeedSubscriber.Offered.QUEUED_START_SENDER);
        assertThat(subscriber.offer("two")).isEqualTo(LiveFeedSubscriber.Offered.QUEUED);
        assertThat(subscriber.offer("three")).isEqualTo(LiveFeedSubscriber.Offered.QUEUED);
    }

    @Test
    void shouldHandOutEventsInTheOrderTheyWereOffered_thenSayThereIsNothingLeft() {
        subscriber.offer("one");
        subscriber.offer("two");

        assertThat(subscriber.nextToSend()).isEqualTo("one");
        assertThat(subscriber.nextToSend()).isEqualTo("two");
        assertThat(subscriber.nextToSend()).isNull();
    }

    @Test
    void shouldAskForANewSender_whenTheLastOneHasFinishedAndAnotherEventArrives() {
        subscriber.offer("one");
        subscriber.nextToSend();
        subscriber.nextToSend();   // empty: the sender ends

        assertThat(subscriber.offer("two")).isEqualTo(LiveFeedSubscriber.Offered.QUEUED_START_SENDER);
    }

    @Test
    void shouldAcceptExactlyAsManyWaitingEventsAsTheLimit_andRefuseTheNext() {
        assertThat(subscriber.offer("1")).isNotEqualTo(LiveFeedSubscriber.Offered.TOO_SLOW);
        assertThat(subscriber.offer("2")).isNotEqualTo(LiveFeedSubscriber.Offered.TOO_SLOW);
        assertThat(subscriber.offer("3")).isNotEqualTo(LiveFeedSubscriber.Offered.TOO_SLOW);

        assertThat(subscriber.offer("4")).isEqualTo(LiveFeedSubscriber.Offered.TOO_SLOW);
    }

    @Test
    void shouldHaveRoomAgain_onceWaitingEventsHaveBeenSent() {
        subscriber.offer("1");
        subscriber.offer("2");
        subscriber.offer("3");
        subscriber.nextToSend();

        assertThat(subscriber.offer("4")).isEqualTo(LiveFeedSubscriber.Offered.QUEUED);
    }

    @Test
    void shouldRefuseEventsOnceClosed_andSendNothingThatWasWaiting() {
        subscriber.offer("one");
        subscriber.offer("two");

        assertThat(subscriber.markClosed()).isTrue();

        assertThat(subscriber.offer("three")).isEqualTo(LiveFeedSubscriber.Offered.CLOSED);
        assertThat(subscriber.nextToSend()).isNull();
    }

    @Test
    void shouldReportClosingOnlyTheFirstTime() {
        assertThat(subscriber.markClosed()).isTrue();
        assertThat(subscriber.markClosed()).isFalse();
    }

    @Test
    void shouldKeepWhatItWasGiven() {
        assertThat(subscriber.id()).isEqualTo("socket-1");
        assertThat(subscriber.username()).isEqualTo("sita");
        assertThat(subscriber.sequence()).isEqualTo(7);
        assertThat(subscriber.openedAt()).isEqualTo(Instant.parse("2026-10-16T08:00:00Z"));
        assertThat(subscriber.stamp()).isEqualTo(new AccountStamp(User.UserRole.STAFF, "digest"));
        assertThat(subscriber.session()).isSameAs(session);
    }
}

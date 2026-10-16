package com.samjhana.websocket;

import com.samjhana.exception.TooManyRequestsException;
import com.samjhana.security.RequestThrottle;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LiveTicketServiceTest {

    private static final class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-09-27T10:00:00Z");
        @Override public Instant instant() { return now; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
    }

    private final MovableClock clock = new MovableClock();
    private final LiveTicketService tickets = new LiveTicketService(clock, new RequestThrottle());

    @Test
    void shouldRedeemAFreshTicket_forTheUserItWasIssuedTo() {
        assertThat(tickets.redeem(tickets.issue("sita"))).contains("sita");
    }

    @Test
    void shouldOnlyWorkOnce() {
        String ticket = tickets.issue("sita");
        tickets.redeem(ticket);
        assertThat(tickets.redeem(ticket)).isEmpty();
    }

    @Test
    void shouldExpireAfterThirtySeconds() {
        String ticket = tickets.issue("sita");
        clock.now = clock.now.plus(LiveTicketService.TICKET_LIFETIME).plusSeconds(1);
        assertThat(tickets.redeem(ticket)).isEmpty();
    }

    @Test
    void shouldRefuseUnknownOrMissingTickets() {
        assertThat(tickets.redeem("made-up")).isEmpty();
        assertThat(tickets.redeem(null)).isEmpty();
    }

    @Test
    void shouldIssueUnguessableDistinctTickets() {
        String a = tickets.issue("sita");
        String b = tickets.issue("sita");
        assertThat(a).isNotEqualTo(b).hasSizeGreaterThanOrEqualTo(40);
    }

    // ---- finding D-02: asking for tickets is limited ----

    @Test
    void shouldRefuseTheNextTicketWithinAMinute_afterOnePersonHasUsedTheirAllowance() {
        for (int n = 1; n <= LiveTicketService.MAX_TICKETS_PER_PERSON; n++) tickets.issue("sita");

        assertThatThrownBy(() -> tickets.issue("sita")).isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void shouldNotRefuseAPersonWhoReloadsTheLiveScreenEveryTwoSecondsForAMinute() {
        // The browser tests load the screen about this often as one account, and a development build asks twice per load.
        for (int load = 1; load <= 30; load++) {
            assertThat(tickets.redeem(tickets.issue("sita"))).as("ticket %d", load).contains("sita");
        }
    }

    @Test
    void shouldNotLetOnePersonUseUpAnotherPersonsAllowance() {
        for (int n = 1; n <= LiveTicketService.MAX_TICKETS_PER_PERSON; n++) tickets.issue("sita");

        assertThat(tickets.redeem(tickets.issue("ram"))).contains("ram");
    }

    @Test
    void shouldRefuseNewTickets_whenAThousandAreAlreadyWaiting() {
        for (int person = 0; person < 100; person++) {
            for (int n = 0; n < 10; n++) tickets.issue("person-" + person);
        }

        assertThatThrownBy(() -> tickets.issue("one-more-person")).isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void shouldIssueAgain_whenTheWaitingTicketsHaveExpired() {
        for (int person = 0; person < 100; person++) {
            for (int n = 0; n < 10; n++) tickets.issue("person-" + person);
        }
        clock.now = clock.now.plus(LiveTicketService.TICKET_LIFETIME).plusSeconds(1);

        assertThat(tickets.redeem(tickets.issue("one-more-person"))).contains("one-more-person");
    }

    @Test
    void shouldForgetExpiredTickets_whenTheSweepRuns_andKeepTheOnesStillGood() {
        tickets.issue("sita");
        tickets.issue("sita");
        clock.now = clock.now.plus(LiveTicketService.TICKET_LIFETIME).plusSeconds(1);
        String fresh = tickets.issue("ram");

        tickets.forgetExpired();

        assertThat(tickets.waiting()).isEqualTo(1);
        assertThat(tickets.redeem(fresh)).contains("ram");
    }

    @Test
    void shouldNotScanForExpiredTicketsOnEveryRequest() {
        tickets.issue("sita");
        clock.now = clock.now.plus(LiveTicketService.TICKET_LIFETIME).plusSeconds(1);

        tickets.issue("ram");

        assertThat(tickets.waiting()).as("the expired ticket is left for the sweep").isEqualTo(2);
    }
}

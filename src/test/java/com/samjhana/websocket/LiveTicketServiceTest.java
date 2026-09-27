package com.samjhana.websocket;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class LiveTicketServiceTest {

    private static final class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-09-27T10:00:00Z");
        @Override public Instant instant() { return now; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
    }

    private final MovableClock clock = new MovableClock();
    private final LiveTicketService tickets = new LiveTicketService(clock);

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
}

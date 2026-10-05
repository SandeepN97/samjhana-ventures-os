package com.samjhana.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class ClientAddressResolverTest {

    private MockHttpServletRequest request(String forwardedFor, String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) request.addHeader("X-Forwarded-For", forwardedFor);
        return request;
    }

    @Test
    void shouldUseTheConnectingAddress_whenThereIsNoForwardingHeader() {
        ClientAddressResolver resolver = new ClientAddressResolver(0);
        assertThat(resolver.resolve(request(null, "203.0.113.7"))).contains("203.0.113.7");
    }

    @Test
    void shouldUseTheRightmostEntry_soAFakedLeftEntryDoesNotCount() {
        ClientAddressResolver resolver = new ClientAddressResolver(0);
        assertThat(resolver.resolve(request("9.9.9.9, 198.51.100.4", "10.0.0.1"))).contains("198.51.100.4");
    }

    @Test
    void shouldSkipTrustedProxyEntries_fromTheRight() {
        ClientAddressResolver resolver = new ClientAddressResolver(1);
        assertThat(resolver.resolve(request("198.51.100.4, 172.70.1.1", "10.0.0.1"))).contains("198.51.100.4");
    }

    @Test
    void shouldGiveNoAddress_whenMoreHopsAreTrustedThanEntriesExist() {
        ClientAddressResolver resolver = new ClientAddressResolver(3);
        assertThat(resolver.resolve(request("198.51.100.4", "10.0.0.1"))).isEmpty();
    }

    @Test
    void shouldGiveNoAddress_whenTheEntryIsNotAnAddress() {
        ClientAddressResolver resolver = new ClientAddressResolver(0);
        assertThat(resolver.resolve(request("not-an-address", "10.0.0.1"))).isEmpty();
        assertThat(resolver.resolve(request("999.1.1.1", "10.0.0.1"))).isEmpty();
        assertThat(resolver.resolve(request("1.2.3.4; DROP TABLE users", "10.0.0.1"))).isEmpty();
    }

    @Test
    void shouldGiveNoAddress_whenTheHeaderIsBlank() {
        ClientAddressResolver resolver = new ClientAddressResolver(0);
        assertThat(resolver.resolve(request("  ,  ", "10.0.0.1"))).isEmpty();
    }

    @Test
    void shouldAcceptIpv6_inLowerCase() {
        ClientAddressResolver resolver = new ClientAddressResolver(0);
        assertThat(resolver.resolve(request("2001:DB8::1", "10.0.0.1"))).contains("2001:db8::1");
    }

    @Test
    void shouldDropAPortFromAnIpv4Entry() {
        ClientAddressResolver resolver = new ClientAddressResolver(0);
        assertThat(resolver.resolve(request("198.51.100.4:51234", "10.0.0.1"))).contains("198.51.100.4");
    }

    @Test
    void shouldRefuseAnAbsurdlyLongEntry() {
        ClientAddressResolver resolver = new ClientAddressResolver(0);
        assertThat(resolver.resolve(request("1".repeat(500), "10.0.0.1"))).isEmpty();
    }

    @Test
    void shouldTreatANegativeHopSettingAsZero() {
        ClientAddressResolver resolver = new ClientAddressResolver(-5);
        assertThat(resolver.trustedProxyHops()).isZero();
    }
}

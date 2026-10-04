package com.samjhana.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ShopOrderServiceHelpersTest {

    @Test
    void shouldCleanUpAPhoneNumber() {
        assertThat(ShopOrderService.normalizePhone(" +977 98-1234 5678 ")).isEqualTo("+977981234" + "5678");
        assertThat(ShopOrderService.normalizePhone("(01) 4222333")).isEqualTo("014222333");
    }

    @Test
    void shouldRefuseAnUnusablePhoneNumber() {
        for (String bad : new String[]{null, "", "12", "abc", "98+1234567", "1".repeat(16)}) {
            assertThatThrownBy(() -> ShopOrderService.normalizePhone(bad)).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void shouldTreatTheSameNumberInDifferentFormatsAsEqual() {
        assertThat(ShopOrderService.samePhone("9812345678", "+977 981-2345678")).isTrue();
        assertThat(ShopOrderService.samePhone("+9779812345678", "9812345678")).isTrue();
    }

    @Test
    void shouldNotMatchADifferentOrTooShortNumber() {
        assertThat(ShopOrderService.samePhone("9812345678", "9812345679")).isFalse();
        assertThat(ShopOrderService.samePhone("9812345678", "345678")).isFalse();
        assertThat(ShopOrderService.samePhone("123", "123")).isFalse();
    }

    @Test
    void shouldShowOnlyTheLastThreeDigits() {
        assertThat(ShopOrderService.maskPhone("9812345678")).isEqualTo("*******678");
        assertThat(ShopOrderService.maskPhone("981")).isEqualTo("****");
        assertThat(ShopOrderService.maskPhone("+977 98")).isEqualTo("**798");
    }
}

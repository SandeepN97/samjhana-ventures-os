package com.samjhana.service;

import com.samjhana.entity.User;
import com.samjhana.exception.TooManyRequestsException;
import com.samjhana.repository.LoanReceiptRepository;
import com.samjhana.repository.MediaAssetRepository;
import com.samjhana.security.RequestThrottle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Finding F-03: one manager login must not be able to fill the shared business database with pictures or receipt
 * photos. Each kind has a limit on uploads per hour (for everyone, then for the person) and a cap on what is kept.
 */
@ExtendWith(MockitoExtension.class)
class UploadQuotaTest {

    private static final long MB = 1024L * 1024L;

    @Mock MediaAssetRepository mediaRepository;
    @Mock LoanReceiptRepository receiptRepository;
    @Mock RequestThrottle throttle;
    UploadQuota quota;
    final User manager = User.builder().username("mgr").role(User.UserRole.MANAGER).build();

    @BeforeEach
    void setUp() {
        quota = new UploadQuota(mediaRepository, receiptRepository, throttle, 150, 150);
    }

    private void limitsNotReached() {
        when(throttle.tryAcquire(any(), anyInt(), any(Duration.class))).thenReturn(true);
    }

    // ---- pictures ----

    @Test
    void shouldAllowAPictureUpload_whenThereIsRoomAndTheLimitsAreNotReached() {
        limitsNotReached();
        when(mediaRepository.sumLiveBytes()).thenReturn(100 * MB);
        assertThatCode(() -> quota.checkMediaUpload(manager, 3 * MB)).doesNotThrowAnyException();
    }

    @Test
    void shouldAllowAPictureUpload_thatFillsTheStorageExactly() {
        limitsNotReached();
        when(mediaRepository.sumLiveBytes()).thenReturn(147 * MB);
        assertThatCode(() -> quota.checkMediaUpload(manager, 3 * MB)).doesNotThrowAnyException();
    }

    @Test
    void shouldRefuseAPictureUpload_whenItWouldPassTheStorageCap() {
        limitsNotReached();
        when(mediaRepository.sumLiveBytes()).thenReturn(148 * MB);
        assertThatThrownBy(() -> quota.checkMediaUpload(manager, 3 * MB))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Picture storage is full").hasMessageContaining("150 MB");
    }

    @Test
    void shouldRefuseAPictureUpload_andNotLookAtTheDatabase_whenThisPersonHasUploadedTooMuchThisHour() {
        when(throttle.tryAcquire(eq("upload:media:all"), anyInt(), any(Duration.class))).thenReturn(true);
        when(throttle.tryAcquire(eq("upload:media:mgr"), anyInt(), any(Duration.class))).thenReturn(false);
        assertThatThrownBy(() -> quota.checkMediaUpload(manager, MB)).isInstanceOf(TooManyRequestsException.class);
        verifyNoInteractions(mediaRepository);
    }

    @Test
    void shouldAskAboutNoPersonalKey_whenTheSharedPictureLimitIsReached() {
        // the throttle mock refuses everything by default
        assertThatThrownBy(() -> quota.checkMediaUpload(manager, MB)).isInstanceOf(TooManyRequestsException.class);
        verify(throttle).tryAcquire(eq("upload:media:all"), anyInt(), any(Duration.class));
        verify(throttle, never()).tryAcquire(eq("upload:media:mgr"), anyInt(), any(Duration.class));
    }

    // ---- receipt photos ----

    @Test
    void shouldAllowAReceiptUpload_whenThereIsRoom() {
        limitsNotReached();
        when(receiptRepository.sumLiveBytes()).thenReturn(10 * MB);
        assertThatCode(() -> quota.checkReceiptUpload(manager, MB)).doesNotThrowAnyException();
    }

    @Test
    void shouldAllowAReceiptUpload_thatFillsTheStorageExactly() {
        limitsNotReached();
        when(receiptRepository.sumLiveBytes()).thenReturn(149 * MB);
        assertThatCode(() -> quota.checkReceiptUpload(manager, MB)).doesNotThrowAnyException();
    }

    @Test
    void shouldRefuseAReceiptUpload_whenItWouldPassTheStorageCap() {
        limitsNotReached();
        when(receiptRepository.sumLiveBytes()).thenReturn(150 * MB);
        assertThatThrownBy(() -> quota.checkReceiptUpload(manager, 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Receipt storage is full");
    }

    @Test
    void shouldRefuseAReceiptUpload_whenThisPersonHasUploadedTooMuchThisHour() {
        when(throttle.tryAcquire(eq("upload:receipt:all"), anyInt(), any(Duration.class))).thenReturn(true);
        when(throttle.tryAcquire(eq("upload:receipt:mgr"), anyInt(), any(Duration.class))).thenReturn(false);
        assertThatThrownBy(() -> quota.checkReceiptUpload(manager, MB)).isInstanceOf(TooManyRequestsException.class);
        verifyNoInteractions(receiptRepository);
    }

    @Test
    void shouldKeepThePictureAndReceiptStoresApart() {
        limitsNotReached();
        when(mediaRepository.sumLiveBytes()).thenReturn(150 * MB);
        when(receiptRepository.sumLiveBytes()).thenReturn(0L);
        assertThatThrownBy(() -> quota.checkMediaUpload(manager, MB)).isInstanceOf(IllegalArgumentException.class);
        assertThatCode(() -> quota.checkReceiptUpload(manager, MB)).doesNotThrowAnyException();
    }
}

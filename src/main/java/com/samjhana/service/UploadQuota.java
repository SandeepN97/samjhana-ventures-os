package com.samjhana.service;

import com.samjhana.entity.User;
import com.samjhana.exception.TooManyRequestsException;
import com.samjhana.repository.LoanReceiptRepository;
import com.samjhana.repository.MediaAssetRepository;
import com.samjhana.security.RequestThrottle;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Keeps one login from filling the shared business database with pictures or receipt photos (finding F-03).
 * The files live in the same PostgreSQL database as every sale, charging session and loan, so a full database
 * would stop all data entry. Each kind has two limits:
 * <ul>
 *   <li>how many uploads are accepted per hour, for everyone together and then for the one person; and</li>
 *   <li>a cap on the bytes kept (pictures that have not been removed), set in megabytes by
 *       {@code samjhana.storage.media-max-total-mb} and {@code samjhana.storage.receipt-max-total-mb}.</li>
 * </ul>
 * Admins and managers upload a handful of files a day, so the hourly limits only ever stop a script.
 */
@Component
public class UploadQuota {

    static final int MAX_PER_PERSON_PER_HOUR = 60;
    static final int MAX_ALL_PER_HOUR = 300;
    private static final Duration WINDOW = Duration.ofHours(1);
    private static final long MB = 1024L * 1024L;

    private final MediaAssetRepository mediaRepository;
    private final LoanReceiptRepository receiptRepository;
    private final RequestThrottle throttle;
    private final long mediaMaxMb;
    private final long receiptMaxMb;

    public UploadQuota(MediaAssetRepository mediaRepository, LoanReceiptRepository receiptRepository, RequestThrottle throttle,
                       @Value("${samjhana.storage.media-max-total-mb:150}") long mediaMaxMb,
                       @Value("${samjhana.storage.receipt-max-total-mb:150}") long receiptMaxMb) {
        this.mediaRepository = mediaRepository;
        this.receiptRepository = receiptRepository;
        this.throttle = throttle;
        this.mediaMaxMb = mediaMaxMb;
        this.receiptMaxMb = receiptMaxMb;
    }

    /** Refuses a picture upload when this person has uploaded too much this hour or the kept pictures would pass the cap. */
    public void checkMediaUpload(User user, long incomingBytes) {
        requireWithinRate("media", user);
        if (mediaRepository.sumLiveBytes() + incomingBytes > mediaMaxMb * MB) {
            throw new IllegalArgumentException("Picture storage is full (" + mediaMaxMb + " MB). "
                    + "Remove pictures you no longer use, or ask the admin to raise the limit.");
        }
    }

    /** The same for a receipt photo. */
    public void checkReceiptUpload(User user, long incomingBytes) {
        requireWithinRate("receipt", user);
        if (receiptRepository.sumLiveBytes() + incomingBytes > receiptMaxMb * MB) {
            throw new IllegalArgumentException("Receipt storage is full (" + receiptMaxMb + " MB). "
                    + "Please ask the admin to raise the limit.");
        }
    }

    private void requireWithinRate(String kind, User user) {
        // The shared limit first, so a request it refuses leaves no per-person entry in the throttle behind.
        if (!throttle.tryAcquire("upload:" + kind + ":all", MAX_ALL_PER_HOUR, WINDOW)
                || !throttle.tryAcquire("upload:" + kind + ":" + user.getUsername(), MAX_PER_PERSON_PER_HOUR, WINDOW)) {
            throw new TooManyRequestsException("Too many uploads just now. Please wait a little and try again.");
        }
    }
}

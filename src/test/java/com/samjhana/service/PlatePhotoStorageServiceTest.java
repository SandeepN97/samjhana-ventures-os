package com.samjhana.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Finding F-01: the plate photo used to be decoded in full before its size was checked, so a text of tens of
 * megabytes cost several copies of itself in memory before being refused. The size is now judged from the length of
 * the text, before anything is decoded.
 */
class PlatePhotoStorageServiceTest {

    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final String PNG = "data:image/png;base64,";

    @TempDir Path folder;

    private PlatePhotoStorageService service() {
        return new PlatePhotoStorageService(folder.toString());
    }

    private static String dataUrl(int photoBytes) {
        byte[] photo = new byte[photoBytes];
        new Random(7).nextBytes(photo);
        return PNG + Base64.getEncoder().encodeToString(photo);
    }

    @Test
    void shouldRefuseWithTheSizeMessage_withoutDecoding_whenTheTextCannotHoldAPhotoUnder5MB() {
        // "!" is not Base64, so decoding it would fail with a different message: seeing the size message proves nothing was decoded
        String tooLong = PNG + "!".repeat(6_990_512);

        assertThatThrownBy(() -> service().store(tooLong, "BA1PA1234"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Plate photo must be between 1 byte and 5 MB");
    }

    @Test
    void shouldStillDecodeAndCheck_whenTheTextIsJustUnderTheEarlyLimit() {
        String borderline = PNG + "!".repeat(6_990_508);   // could still be a 5 MB photo, so it is decoded (and found not to be Base64)

        assertThatThrownBy(() -> service().store(borderline, "BA1PA1234"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Plate photo is not valid Base64 data");
    }

    @Test
    void shouldStoreAPhotoOfExactly5MB() throws Exception {
        String photo = dataUrl((int) MAX_BYTES);

        String stored = service().store(photo, "BA1PA1234");

        assertThat(Files.size(folder.resolve(stored))).isEqualTo(MAX_BYTES);
    }

    @Test
    void shouldRefuseAPhotoOneByteOver5MB_afterDecoding() {
        String photo = dataUrl((int) MAX_BYTES + 1);

        assertThatThrownBy(() -> service().store(photo, "BA1PA1234"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Plate photo must be between 1 byte and 5 MB");
    }

    @Test
    void shouldStoreASmallPhoto() throws Exception {
        String stored = service().store(dataUrl(1_000), "BA 1 PA 1234");

        assertThat(stored).startsWith("ev/plates/").endsWith(".png").contains("BA-1-PA-1234");
        assertThat(Files.size(folder.resolve(stored))).isEqualTo(1_000);
    }

    @Test
    void shouldRefuseAnEmptyPhoto() {
        assertThatThrownBy(() -> service().store(PNG, "BA1PA1234"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Plate photo must be between 1 byte and 5 MB");
    }

    @Test
    void shouldReturnNothing_whenThereIsNoPhoto() {
        assertThat(service().store(null, "BA1PA1234")).isNull();
        assertThat(service().store("  ", "BA1PA1234")).isNull();
    }
}

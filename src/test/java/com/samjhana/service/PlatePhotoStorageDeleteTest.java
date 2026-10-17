package com.samjhana.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Finding F-02: a plate photo written for a start that is then refused or rolled back has to be removable, and only
 * from inside the photo folder.
 */
class PlatePhotoStorageDeleteTest {

    @TempDir Path folder;
    @TempDir Path outside;

    private PlatePhotoStorageService service() {
        return new PlatePhotoStorageService(folder.toString());
    }

    @Test
    void shouldRemoveAPhotoItStored() throws Exception {
        PlatePhotoStorageService service = service();
        String stored = service.store("data:image/png;base64," + Base64.getEncoder().encodeToString(new byte[] {1, 2, 3}), "BA1PA1234");
        assertThat(Files.exists(folder.resolve(stored))).isTrue();

        service.delete(stored);

        assertThat(Files.exists(folder.resolve(stored))).isFalse();
        assertThat(service.load(stored)).isNull();
    }

    @Test
    void shouldDoNothing_whenThePhotoIsAlreadyGoneOrNoPathIsGiven() {
        assertThatCode(() -> service().delete("ev/plates/2026/10/not-there.jpg")).doesNotThrowAnyException();
        assertThatCode(() -> service().delete(null)).doesNotThrowAnyException();
        assertThatCode(() -> service().delete("  ")).doesNotThrowAnyException();
    }

    @Test
    void shouldNeverRemoveAFileOutsideThePhotoFolder() throws Exception {
        Path other = Files.write(outside.resolve("precious.txt"), new byte[] {9});
        String escape = folder.relativize(other).toString();   // something like ../../tmp/.../precious.txt

        service().delete(escape);
        service().delete("../" + other.getFileName());

        assertThat(Files.exists(other)).isTrue();
    }

    @Test
    void shouldNeverRemoveAFolder() throws Exception {
        Path inner = Files.createDirectories(folder.resolve("ev/plates/2026/10"));

        service().delete("ev/plates/2026/10");

        assertThat(Files.isDirectory(inner)).isTrue();
    }

    @Test
    void shouldNotFail_whenThePathIsNotEvenAValidPath() {
        assertThatCode(() -> service().delete("bad\0name.jpg")).doesNotThrowAnyException();
    }
}

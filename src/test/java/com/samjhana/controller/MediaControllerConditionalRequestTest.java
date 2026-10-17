package com.samjhana.controller;

import com.samjhana.entity.MediaAsset;
import com.samjhana.service.MediaService;
import com.samjhana.service.UploadQuota;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Finding P0-13: a browser asking "has this picture changed?" (If-None-Match) made the server read the whole picture
 * out of the database just to answer "no". Now only a check that the picture is still there is made.
 */
class MediaControllerConditionalRequestTest {

    private final MediaService mediaService = mock(MediaService.class);
    private final MediaController controller = new MediaController(mediaService, mock(UploadQuota.class));
    private final UUID id = UUID.randomUUID();
    private final String etag = "\"" + id + "\"";

    private MediaAsset asset;

    @BeforeEach
    void setUp() {
        asset = MediaAsset.builder().id(id).contentType("image/png").sizeBytes(3L).data(new byte[]{1, 2, 3}).build();
    }

    @Test
    void shouldAnswer304WithoutReadingThePicture_whenTheBrowserAlreadyHasIt() {
        when(mediaService.exists(id)).thenReturn(true);

        ResponseEntity<byte[]> response = controller.view(id.toString(), etag);

        assertThat(response.getStatusCode().value()).isEqualTo(304);
        assertThat(response.getHeaders().getETag()).isEqualTo(etag);
        verify(mediaService, never()).find(any());
    }

    @Test
    void shouldAnswer404_whenThePictureWasRemoved_evenIfTheBrowserHoldsAnOldCopy() {
        when(mediaService.exists(id)).thenReturn(false);

        ResponseEntity<byte[]> response = controller.view(id.toString(), etag);

        assertThat(response.getStatusCode().value()).isEqualTo(404);
        verify(mediaService, never()).find(any());
    }

    @Test
    void shouldSendThePicture_whenTheBrowserHasNoCopy() {
        when(mediaService.find(id)).thenReturn(Optional.of(asset));

        ResponseEntity<byte[]> response = controller.view(id.toString(), null);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsExactly(1, 2, 3);
        assertThat(response.getHeaders().getETag()).isEqualTo(etag);
        assertThat(response.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        verify(mediaService, never()).exists(any());
    }

    @Test
    void shouldSendThePicture_whenTheBrowserHoldsADifferentVersion() {
        when(mediaService.find(id)).thenReturn(Optional.of(asset));

        ResponseEntity<byte[]> response = controller.view(id.toString(), "\"somebody-else\"");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void shouldAnswer404_forAnIdThatIsNotAUuid_withoutAskingTheService() {
        ResponseEntity<byte[]> response = controller.view("not-a-uuid", etag);

        assertThat(response.getStatusCode().value()).isEqualTo(404);
        verify(mediaService, never()).exists(any());
        verify(mediaService, never()).find(any());
    }
}

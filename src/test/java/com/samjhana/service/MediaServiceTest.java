package com.samjhana.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.MediaAsset;
import com.samjhana.repository.MediaAssetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MediaServiceTest {

    @Mock MediaAssetRepository mediaRepository;
    private MediaService service;

    @BeforeEach
    void setUp() {
        service = new MediaService(mediaRepository, new ObjectMapper());
        lenient().when(mediaRepository.save(any(MediaAsset.class))).thenAnswer(inv -> {
            MediaAsset a = inv.getArgument(0);
            a.setId(UUID.randomUUID());
            return a;
        });
    }

    static byte[] image(String format) {
        return com.samjhana.testsupport.TestImages.image(format);
    }

    @Test
    void shouldAcceptAJpegAndAPng_andWorkTheTypeOutFromTheBytes() {
        MediaAsset jpeg = service.store(image("jpg"), "photo.png", "admin");   // name lies, bytes decide
        MediaAsset png = service.store(image("png"), "photo.jpg", "admin");

        assertThat(jpeg.getContentType()).isEqualTo("image/jpeg");
        assertThat(png.getContentType()).isEqualTo("image/png");
        assertThat(jpeg.getUploadedBy()).isEqualTo("admin");
    }

    @Test
    void shouldAcceptAWebpByItsHeader() {
        byte[] webp = new byte[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '};
        assertThat(service.store(webp, "x.webp", "admin").getContentType()).isEqualTo("image/webp");
    }

    @Test
    void shouldRefuseSvgGifAndOtherFiles_evenIfTheNameSaysImage() {
        byte[] svg = "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>".getBytes();
        byte[] gif = "GIF89a....".getBytes();
        byte[] exe = new byte[]{'M', 'Z', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
        for (byte[] bad : List.of(svg, gif, exe)) {
            assertThatThrownBy(() -> service.store(bad, "pic.jpg", "admin"))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("JPEG, PNG or WebP");
        }
        verify(mediaRepository, never()).save(any());
    }

    @Test
    void shouldRefuseAFileThatHasAPngHeaderButIsNotAPicture() {
        byte[] fake = new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4};
        assertThatThrownBy(() -> service.store(fake, "x.png", "admin"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
    }

    @Test
    void shouldRefuseEmptyAndOversizedUploads() {
        assertThatThrownBy(() -> service.store(new MockMultipartFile("file", new byte[0]), "admin"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Choose a picture");
        byte[] big = new byte[MediaService.MAX_BYTES + 1];
        big[0] = (byte) 0xFF; big[1] = (byte) 0xD8; big[2] = (byte) 0xFF;
        assertThatThrownBy(() -> service.store(big, "big.jpg", "admin"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("3 MB");
    }

    @Test
    void shouldStripLineBreaksFromTheStoredFileName() {
        MediaAsset asset = service.store(image("png"), "a\r\nb.png", "admin");
        assertThat(asset.getOriginalName()).doesNotContain("\n").doesNotContain("\r");
    }

    @Test
    void shouldSoftDeleteAPicture() {
        MediaAsset asset = MediaAsset.builder().id(UUID.randomUUID()).contentType("image/png").sizeBytes(1L).data(new byte[1]).build();
        when(mediaRepository.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(java.util.Optional.of(asset));
        service.delete(asset.getId());
        assertThat(asset.getDeletedAt()).isNotNull();
        verify(mediaRepository, never()).delete(any());
    }

    // ---- picture lists ----------------------------------------------------------------------------

    @Test
    void shouldReturnCleanIdsInOrder_withoutDuplicates_whenAllPicturesExist() {
        UUID a = UUID.randomUUID(), b = UUID.randomUUID();
        when(mediaRepository.findLiveIds(List.of(a, b))).thenReturn(List.of(a, b));
        assertThat(service.requireLiveIds(List.of(a.toString(), b.toString(), a.toString()))).containsExactly(a, b);
    }

    @Test
    void shouldRefuseAnUnknownRemovedOrTooManyPictures() {
        assertThatThrownBy(() -> service.requireLiveIds(List.of("not-a-uuid"))).isInstanceOf(IllegalArgumentException.class);
        UUID gone = UUID.randomUUID();
        when(mediaRepository.findLiveIds(List.of(gone))).thenReturn(List.of());
        assertThatThrownBy(() -> service.requireLiveIds(List.of(gone.toString()))).hasMessageContaining("removed");
        List<String> eleven = java.util.stream.IntStream.range(0, 11).mapToObj(i -> UUID.randomUUID().toString()).toList();
        assertThatThrownBy(() -> service.requireLiveIds(eleven)).hasMessageContaining("at most 10");
        assertThatThrownBy(() -> service.requireLiveIds("a string")).hasMessageContaining("list");
    }

    @Test
    void shouldTreatNullAsNoPictures_andRoundTripJson() {
        assertThat(service.requireLiveIds(null)).isEmpty();
        UUID a = UUID.randomUUID();
        assertThat(service.fromJson(service.toJson(List.of(a)))).containsExactly(a);
        assertThat(service.fromJson(null)).isEmpty();
        assertThat(service.fromJson("garbage")).isEmpty();
        assertThat(MediaService.urlOf(a)).isEqualTo("/api/public/media/" + a);
    }
}

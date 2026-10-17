package com.samjhana.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.MediaAsset;
import com.samjhana.repository.MediaAssetRepository;
import com.samjhana.service.MediaService;
import com.samjhana.testsupport.PictureFixtures;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The starter pictures ship inside the app and are loaded at start-up ({@link SeedImages}). The new hidden-details clean-up
 * (finding P0-05) must accept every one of them and leave the same picture, or a fresh install would start without its photos.
 */
class StarterPicturesStillLoadTest {

    @Test
    void shouldAcceptEveryStarterPicture_andKeepItLookingTheSame() throws IOException {
        MediaAssetRepository repository = mock(MediaAssetRepository.class);
        when(repository.save(any(MediaAsset.class))).thenAnswer(invocation -> {
            MediaAsset asset = invocation.getArgument(0);
            asset.setId(UUID.randomUUID());
            return asset;
        });
        MediaService service = new MediaService(repository, new ObjectMapper());

        Resource[] pictures = new PathMatchingResourcePatternResolver().getResources("classpath:seed/images/*");

        assertThat(pictures.length).as("the starter pictures are found").isGreaterThanOrEqualTo(30);
        for (Resource picture : pictures) {
            byte[] original;
            try (InputStream in = picture.getInputStream()) {
                original = in.readAllBytes();
            }
            String name = picture.getFilename();

            MediaAsset stored = service.store(original, "seed:" + name, "seed");

            assertThat(stored.getContentType()).as(name).isEqualTo(name.endsWith(".png") ? "image/png" : "image/jpeg");
            assertThat(stored.getData().length).as(name).isLessThanOrEqualTo(original.length);
            assertThat(PictureFixtures.samePixels(original, stored.getData())).as(name + " looks the same").isTrue();
        }
    }
}

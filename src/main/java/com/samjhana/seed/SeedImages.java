package com.samjhana.seed;

import com.samjhana.entity.MediaAsset;
import com.samjhana.repository.MediaAssetRepository;
import com.samjhana.service.MediaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;
import java.util.UUID;

/**
 * Loads the starter pictures that ship with the app ({@code seed/images}) into the database, once each, so
 * a fresh install looks like the finished site. After that they are ordinary pictures that staff can replace.
 */
@Component
@Profile("!test")
@RequiredArgsConstructor
@Slf4j
public class SeedImages {

    private static final String[] EXTENSIONS = {".jpg", ".png", ".webp"};

    private final MediaAssetRepository mediaRepository;
    private final MediaService mediaService;

    /** The id of the starter picture called {@code name}, creating it on first use; empty when there is no such file. */
    @Transactional
    public Optional<UUID> idFor(String name) {
        String tag = "seed:" + name;
        Optional<MediaAsset> existing = mediaRepository.findFirstByOriginalNameAndDeletedAtIsNull(tag);
        if (existing.isPresent()) return Optional.of(existing.get().getId());
        for (String ext : EXTENSIONS) {
            ClassPathResource resource = new ClassPathResource("seed/images/" + name + ext);
            if (!resource.exists()) continue;
            try (InputStream in = resource.getInputStream()) {
                return Optional.of(mediaService.store(in.readAllBytes(), tag, "seed").getId());
            } catch (IOException e) {
                log.warn("Could not read starter picture {}", name, e);
            }
        }
        log.warn("No starter picture named {}", name);
        return Optional.empty();
    }
}

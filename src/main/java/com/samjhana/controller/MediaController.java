package com.samjhana.controller;

import com.samjhana.entity.MediaAsset;
import com.samjhana.entity.User;
import com.samjhana.service.MediaService;
import com.samjhana.service.UploadQuota;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Pictures. Staff upload from the admin app; the public website only ever reads.
 * A picture's id never changes what it shows, so the public copy can be cached, but only for a day: a removed
 * picture has to disappear from browsers and shared caches soon, and the check that it is still there is cheap.
 */
@RestController
@RequiredArgsConstructor
public class MediaController {

    /** Browsers and shared caches ask again after a day (finding P0-05); an unchanged picture is then answered with a 304. */
    private static final CacheControl PICTURE_CACHE = CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic();

    /**
     * Nothing in this response may run as a page, load anything, or reach the app's own storage, even if a browser were
     * tricked into treating the file as a document. The inline-style allowance is only for the page browsers build around
     * a picture opened on its own.
     */
    private static final String PICTURE_ONLY_POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

    private final MediaService mediaService;
    private final UploadQuota uploadQuota;

    @GetMapping("/api/public/media/{id}")
    public ResponseEntity<byte[]> view(@PathVariable String id,
                                       @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        UUID uuid;
        try {
            uuid = UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
        String etag = "\"" + uuid + "\"";
        if (etag.equals(ifNoneMatch)) {
            // The browser only asks whether its copy is still good: confirm the picture is there without reading it
            // (finding P0-13). A removed picture is still a 404, whatever copy the browser holds.
            // A browser updates its stored copy with the headers of a 304, so the 304 repeats the picture's own rules.
            return mediaService.exists(uuid)
                    ? ResponseEntity.status(304).cacheControl(PICTURE_CACHE).eTag(etag)
                            .header("Content-Security-Policy", PICTURE_ONLY_POLICY).build()
                    : ResponseEntity.notFound().build();
        }
        Optional<MediaAsset> found = mediaService.find(uuid);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        MediaAsset asset = found.get();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(asset.getContentType()))
                .cacheControl(PICTURE_CACHE)
                .eTag(etag)
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", PICTURE_ONLY_POLICY)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(asset.getData());
    }

    @PostMapping("/api/media")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file, @AuthenticationPrincipal User user) {
        uploadQuota.checkMediaUpload(user, file.getSize());
        MediaAsset asset = mediaService.store(file, user.getUsername());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", asset.getId().toString());
        body.put("url", MediaService.urlOf(asset.getId()));
        body.put("contentType", asset.getContentType());
        body.put("sizeBytes", asset.getSizeBytes());
        return ResponseEntity.ok(body);
    }

    @DeleteMapping("/api/media/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable String id) {
        mediaService.delete(UUID.fromString(id));
        return ResponseEntity.ok(Map.of("message", "Picture removed"));
    }
}

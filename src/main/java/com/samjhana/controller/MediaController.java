package com.samjhana.controller;

import com.samjhana.entity.MediaAsset;
import com.samjhana.entity.User;
import com.samjhana.service.MediaService;
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
 * A picture's id never changes what it shows, so the public copy can be cached for a long time.
 */
@RestController
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

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
        Optional<MediaAsset> found = mediaService.find(uuid);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        if (etag.equals(ifNoneMatch)) return ResponseEntity.status(304).eTag(etag).build();
        MediaAsset asset = found.get();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(asset.getContentType()))
                .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                .eTag(etag)
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(asset.getData());
    }

    @PostMapping("/api/media")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file, @AuthenticationPrincipal User user) {
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

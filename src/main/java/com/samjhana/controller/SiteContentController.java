package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.service.SiteContentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** The public website's editable text, read by the public site and edited from the admin app. */
@RestController
@RequiredArgsConstructor
public class SiteContentController {

    private final SiteContentService siteContentService;

    @GetMapping("/api/public/site")
    public ResponseEntity<?> publicSite() {
        return ResponseEntity.ok(siteContentService.getAll());
    }

    @GetMapping("/api/site-content")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> all() {
        return ResponseEntity.ok(siteContentService.getAll());
    }

    @PutMapping("/api/site-content/{key}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> save(@PathVariable String key, @RequestBody Map<String, Object> body,
                                  @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("message", "Saved", "key", key,
                "value", siteContentService.put(key, body, user.getUsername())));
    }
}

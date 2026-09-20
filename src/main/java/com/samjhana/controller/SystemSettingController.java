package com.samjhana.controller;

import com.samjhana.entity.SystemSetting;
import com.samjhana.entity.User;
import com.samjhana.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SystemSettingController {

    /**
     * Settings that are business-sensitive (what the station pays for electricity) and must not
     * be readable by staff — hiding them in the UI is not enough, the API has to refuse too.
     */
    private static final Set<String> MANAGER_ONLY_KEYS = Set.of("nea_rate");

    private final SystemSettingRepository settingRepository;

    @GetMapping("/{key}")
    public ResponseEntity<?> getSetting(@PathVariable String key, @AuthenticationPrincipal User user) {
        if (MANAGER_ONLY_KEYS.contains(key) && (user == null || !user.canManage())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }
        return settingRepository.findById(key)
                .map(s -> ResponseEntity.ok(Map.of("key", s.getSettingKey(), "value", s.getSettingValue())))
                .orElse(ResponseEntity.ok(Map.of("key", key, "value", "")));
    }

    @PutMapping("/{key}")
    public ResponseEntity<?> updateSetting(
            @PathVariable String key,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {

        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }

        String value = body.get("value");
        if (value == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "value is required"));
        }

        SystemSetting setting = settingRepository.findById(key)
                .orElse(SystemSetting.builder().settingKey(key).build());
        setting.setSettingValue(value);
        setting.setUpdatedBy(user.getUsername());
        settingRepository.save(setting);

        return ResponseEntity.ok(Map.of("key", key, "value", value));
    }
}

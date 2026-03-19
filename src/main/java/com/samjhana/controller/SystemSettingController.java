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

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SystemSettingController {

    private final SystemSettingRepository settingRepository;

    @GetMapping("/{key}")
    public ResponseEntity<?> getSetting(@PathVariable String key) {
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

package com.samjhana.controller;

import com.samjhana.dto.CreateUserRequest;
import com.samjhana.dto.UserDto;
import com.samjhana.entity.AuditLog;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.security.LoginAttemptService;
import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.service.DemoDataSeederService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogRepository auditLogRepository;
    private final LoginAttemptService loginAttempts;
    /** Empty in staging and prod: the demo reset bean only exists in dev. */
    private final ObjectProvider<DemoDataSeederService> demoDataSeederService;

    /**
     * Which admin-only tools this environment offers, so the UI can hide what isn't there
     * (e.g. the demo reset button in prod).
     */
    @GetMapping("/features")
    public ResponseEntity<?> features(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        return ResponseEntity.ok(Map.of("demoReset", demoDataSeederService.getIfAvailable() != null));
    }

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        List<UserDto> users = userRepository.findAll().stream()
                .map(UserDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    @PostMapping("/users")
    public ResponseEntity<?> createUser(
            @RequestBody CreateUserRequest request,
            @AuthenticationPrincipal User currentUser) {

        // Check admin access
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        // Validate username
        if (request.getUsername() == null || request.getUsername().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Username is required"));
        }

        // Check if username already exists
        if (userRepository.findByUsername(request.getUsername().trim().toLowerCase()).isPresent()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Username already exists"));
        }

        // Validate password
        if (request.getPassword() == null || request.getPassword().length() < 8) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Password must be at least 8 characters"));
        }

        // Validate role
        String role = request.getRole();
        if (role == null || role.trim().isEmpty()) {
            role = "STAFF";
        }
        role = role.toUpperCase();
        if (!List.of("ADMIN", "MANAGER", "STAFF").contains(role)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Invalid role. Must be ADMIN, MANAGER, or STAFF"));
        }

        // Create user
        User user = User.builder()
                .username(request.getUsername().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName() != null ? request.getFullName() : request.getUsername())
                .fullNameNepali(request.getFullNameNepali())
                .role(User.UserRole.valueOf(role))
                .isActive(true)
                .locale("en")
                .build();

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "message", "User created successfully",
                "user", UserDto.from(user)
        ));
    }

    /** Letters and digits without the look-alikes (0/O, 1/l/I), so a temporary password is easy to read out. */
    private static final String TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final int TEMP_PASSWORD_LENGTH = 16;
    private static final SecureRandom RANDOM = new SecureRandom();

    private User findUser(String username) {
        String trimmed = username == null ? "" : username.trim();
        return userRepository.findByUsername(trimmed)
                .or(() -> userRepository.findByUsername(trimmed.toLowerCase(Locale.ROOT)))
                .orElse(null);
    }

    /**
     * Admin resets someone's forgotten password. The server makes a random temporary password and returns it
     * once; the person must choose their own at their next login (enforced in JwtAuthFilter). Their old
     * sessions end because the password changed. The password itself is never stored or logged.
     */
    @PostMapping("/users/{username}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable String username,
                                           @AuthenticationPrincipal User currentUser) {
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin access required"));
        }
        User target = findUser(username);
        if (target == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User not found"));
        }
        if (target.getId().equals(currentUser.getId())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Use Change Password to change your own password"));
        }
        if (!Boolean.TRUE.equals(target.getIsActive())) {
            return ResponseEntity.badRequest().body(Map.of("message", "This user is deactivated"));
        }

        StringBuilder temporary = new StringBuilder();
        for (int i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
            temporary.append(TEMP_PASSWORD_ALPHABET.charAt(RANDOM.nextInt(TEMP_PASSWORD_ALPHABET.length())));
        }
        target.setPasswordHash(passwordEncoder.encode(temporary.toString()));
        target.setMustChangePassword(true);
        userRepository.save(target);
        loginAttempts.recordSuccess(target.getUsername());   // they may have been blocked for too many wrong tries

        AuditLog entry = AuditLog.updateEvent(currentUser, AuditLog.EntityType.USER, target.getId(),
                null, "{\"passwordReset\":true,\"mustChangePassword\":true}");
        entry.setDescription("Password reset for " + target.getUsername() + " by " + currentUser.getUsername());
        auditLogRepository.save(entry);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Password reset. Give this temporary password to the user. It is shown only once.");
        body.put("username", target.getUsername());
        body.put("temporaryPassword", temporary.toString());
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(body);
    }

    /** Admin changes another user's role. Takes effect on that user's next request (roles are read per request). */
    @PutMapping("/users/{username}/role")
    public ResponseEntity<?> changeRole(@PathVariable String username,
                                        @RequestBody Map<String, String> body,
                                        @AuthenticationPrincipal User currentUser) {
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin access required"));
        }
        User target = findUser(username);
        if (target == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User not found"));
        }
        if (target.getId().equals(currentUser.getId())) {
            return ResponseEntity.badRequest().body(Map.of("message", "You cannot change your own role"));
        }
        String requested = body == null || body.get("role") == null ? "" : body.get("role").trim().toUpperCase(Locale.ROOT);
        User.UserRole newRole;
        try {
            newRole = User.UserRole.valueOf(requested);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid role. Must be ADMIN, MANAGER, or STAFF"));
        }
        User.UserRole oldRole = target.getRole();
        if (oldRole == newRole) {
            return ResponseEntity.badRequest().body(Map.of("message", "That user already has this role"));
        }
        target.setRole(newRole);
        userRepository.save(target);

        AuditLog entry = AuditLog.updateEvent(currentUser, AuditLog.EntityType.USER, target.getId(),
                "{\"role\":\"" + oldRole + "\"}", "{\"role\":\"" + newRole + "\"}");
        entry.setDescription("Role of " + target.getUsername() + " changed from " + oldRole + " to " + newRole
                + " by " + currentUser.getUsername());
        auditLogRepository.save(entry);

        return ResponseEntity.ok(Map.of("message", "Role updated", "user", UserDto.from(target)));
    }

    @DeleteMapping("/users/{username}")
    public ResponseEntity<?> deleteUser(
            @PathVariable String username,
            @AuthenticationPrincipal User currentUser) {

        // Check admin access
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }

        User user = userRepository.findByUsername(username).orElse(null);

        if (user == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "User not found"));
        }

        // Prevent deleting admin
        if (user.getRole() == User.UserRole.ADMIN) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Cannot delete admin user"));
        }

        user.setIsActive(false);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "User deactivated successfully"));
    }

    @PostMapping("/demo-reset")
    public ResponseEntity<?> resetDemoData(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin access required"));
        }
        DemoDataSeederService seeder = demoDataSeederService.getIfAvailable();
        if (seeder == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Demo reset is not available in this environment"));
        }
        try {
            seeder.resetAndSeed(currentUser);
            return ResponseEntity.ok(Map.of("message", "Demo data reset. Your login is unchanged."));
        } catch (Exception e) {
            log.error("Demo data reset failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Demo data reset failed"));
        }
    }
}

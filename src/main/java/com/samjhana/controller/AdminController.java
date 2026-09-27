package com.samjhana.controller;

import com.samjhana.dto.CreateUserRequest;
import com.samjhana.dto.UserDto;
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
    /** Empty in prod: the demo reset bean only exists in dev and staging. */
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

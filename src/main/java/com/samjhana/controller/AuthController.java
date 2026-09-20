package com.samjhana.controller;

import com.samjhana.dto.ChangePasswordRequest;
import com.samjhana.dto.LoginRequest;
import com.samjhana.dto.LoginResponse;
import com.samjhana.dto.UserDto;
import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));

        User user = (User) auth.getPrincipal();
        String token = jwtUtil.generateToken(user.getUsername());

        return ResponseEntity.ok(LoginResponse.builder()
                .token(token)
                .user(UserDto.from(user))
                .build());
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(UserDto.from(user));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {

        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Not authenticated"));
        }

        String fullName = body.get("fullName");
        if (fullName == null || fullName.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Full name is required"));
        }

        user.setFullName(fullName.trim());
        String fullNameNepali = body.get("fullNameNepali");
        if (fullNameNepali != null && !fullNameNepali.trim().isEmpty()) {
            user.setFullNameNepali(fullNameNepali.trim());
        }

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "message", "Profile updated successfully",
                "user", UserDto.from(user)
        ));
    }

    /**
     * Change the authenticated user's own password.
     *
     * Requires a valid JWT — the endpoint is NOT in permitAll.
     * Admins may change any user's password by providing the target username;
     * non-admins may only change their own.
     *
     * Minimum password length: 8 characters.
     */
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal User currentUser) {

        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Authentication required"));
        }

        // Determine the target user (admin may change others; everyone else changes themselves)
        User targetUser;
        if (request.getUsername() != null
                && !request.getUsername().trim().equalsIgnoreCase(currentUser.getUsername())
                && currentUser.isAdmin()) {
            targetUser = userRepository.findByUsername(request.getUsername().trim())
                    .orElse(null);
            if (targetUser == null) {
                // Return the same message for not-found and wrong-password to prevent enumeration
                return ResponseEntity.badRequest()
                        .body(Map.of("message", "Invalid request"));
            }
        } else {
            targetUser = currentUser;
        }

        // Verify the current password
        if (!passwordEncoder.matches(request.getCurrentPassword(), targetUser.getPassword())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Current password is incorrect"));
        }

        // Validate new password strength
        if (request.getNewPassword() == null || request.getNewPassword().length() < 8) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "New password must be at least 8 characters"));
        }

        targetUser.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(targetUser);

        return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
    }
}
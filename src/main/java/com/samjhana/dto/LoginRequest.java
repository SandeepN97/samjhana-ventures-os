package com.samjhana.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * The longest real username is 50 characters (the users table) and no password is set longer than 128. Anything longer
 * is refused before the login checks or the wrong-password counter see it (finding P0-17).
 */
@Data
public class LoginRequest {
    @NotBlank
    @Size(max = 50)
    private String username;
    @NotBlank
    @Size(max = 128)
    private String password;
}

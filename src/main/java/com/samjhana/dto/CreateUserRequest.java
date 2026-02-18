package com.samjhana.dto;

import lombok.Data;

@Data
public class CreateUserRequest {
    private String username;
    private String password;
    private String fullName;
    private String fullNameNepali;
    private String role; // ADMIN, DAD, SON, STAFF
}

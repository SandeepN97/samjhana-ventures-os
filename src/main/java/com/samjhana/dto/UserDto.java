package com.samjhana.dto;

import com.samjhana.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class UserDto {
    private String id;
    private String username;
    private String fullName;
    private String fullNameNepali;
    private String role;
    private String locale;

    public static UserDto from(User user) {
        return UserDto.builder()
                .id(user.getId().toString())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .fullNameNepali(user.getFullNameNepali() != null ? user.getFullNameNepali() : "")
                .role(user.getRole().name())
                .locale(user.getLocale())
                .build();
    }
}

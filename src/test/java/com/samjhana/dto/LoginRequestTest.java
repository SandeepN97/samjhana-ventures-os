package com.samjhana.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Finding P0-17: a login request is refused when the username or password is longer than any real one. */
class LoginRequestTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private static LoginRequest request(String username, String password) {
        LoginRequest request = new LoginRequest();
        request.setUsername(username);
        request.setPassword(password);
        return request;
    }

    private Set<String> badFields(LoginRequest request) {
        return validator.validate(request).stream().map(ConstraintViolation::getPropertyPath).map(Object::toString)
                .collect(java.util.stream.Collectors.toSet());
    }

    @Test
    void shouldAcceptTheLongestRealUsernameAndPassword() {
        assertThat(badFields(request("u".repeat(50), "p".repeat(128)))).isEmpty();
    }

    @Test
    void shouldRefuseAUsernameLongerThan50Characters() {
        assertThat(badFields(request("u".repeat(51), "secret"))).containsExactly("username");
    }

    @Test
    void shouldRefuseAPasswordLongerThan128Characters() {
        assertThat(badFields(request("dad", "p".repeat(129)))).containsExactly("password");
    }

    @Test
    void shouldStillRefuseBlankFields() {
        assertThat(badFields(request(" ", ""))).containsExactlyInAnyOrder("username", "password");
    }
}

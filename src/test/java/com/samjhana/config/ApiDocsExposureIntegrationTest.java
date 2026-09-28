package com.samjhana.config;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The OpenAPI docs list every endpoint and its fields. They are only switched on by the dev
 * profile; staging and prod keep the default (off), which is what the test profile runs with.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ApiDocsExposureIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private String adminBearer() {
        User admin = userRepository.findByUsername("docs-admin").orElseGet(() -> userRepository.save(User.builder()
                .username("docs-admin").passwordHash(passwordEncoder.encode("x"))
                .fullName("docs-admin").fullNameNepali("docs-admin").role(User.UserRole.ADMIN).build()));
        return "Bearer " + jwtUtil.generateToken(admin);
    }

    @Test
    void shouldNotServeTheApiDocs_evenToASignedInAdmin() throws Exception {
        mockMvc.perform(get("/api-docs").header("Authorization", adminBearer())).andExpect(status().isNotFound());
    }

    @Test
    void shouldNotServeSwaggerUi_evenToASignedInAdmin() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html").header("Authorization", adminBearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldAnswerNotFound_forAMistypedApiEndpoint() throws Exception {
        mockMvc.perform(get("/api/no-such-endpoint").header("Authorization", adminBearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldRequireLogin_beforeSayingAnythingAboutTheApiDocs() throws Exception {
        mockMvc.perform(get("/api-docs")).andExpect(status().isUnauthorized());
    }
}

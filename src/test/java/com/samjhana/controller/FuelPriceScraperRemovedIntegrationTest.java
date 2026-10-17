package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The automatic fetch of fuel prices from the NOC web page was removed at the owner's request: prices are entered by
 * hand on the Fuel Price page. Nothing may fetch them, schedule a fetch, or be set up to.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FuelPriceScraperRemovedIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ApplicationContext context;
    @Autowired Environment environment;
    @Autowired ScheduledAnnotationBeanPostProcessor scheduler;

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    @Test
    void shouldHaveNoRouteToFetchPricesFromNoc_forAnAdminOrAManager() throws Exception {
        mockMvc.perform(post("/api/fuel-prices/fetch-noc").header("Authorization", bearer("noc-admin", User.UserRole.ADMIN)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/fuel-prices/fetch-noc").header("Authorization", bearer("noc-manager", User.UserRole.MANAGER)))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldHaveNoScraperInTheApplication() {
        assertThat(context.containsBean("nocPriceScraperService")).isFalse();
        assertThat(context.getBeanNamesForType(Object.class))
                .noneMatch(name -> name.toLowerCase().contains("scraper"));
    }

    @Test
    void shouldScheduleNothingToDoWithNoc() {
        // Each scheduled job describes itself as "<class>.<method>".
        List<String> scheduledJobs = scheduler.getScheduledTasks().stream()
                .map(task -> String.valueOf(task.getTask().getRunnable()))
                .toList();

        assertThat(scheduledJobs).as("the other jobs are still scheduled, so this really looks at the list")
                .anyMatch(job -> job.contains("RequestThrottle"));
        assertThat(scheduledJobs).noneMatch(job -> job.toLowerCase().contains("noc") || job.toLowerCase().contains("scraper"));
    }

    @Test
    void shouldHaveNoSettingsForTheScraper() {
        assertThat(environment.containsProperty("samjhana.fuel-price-scraper.enabled")).isFalse();
        assertThat(environment.containsProperty("samjhana.fuel-price-scraper.url")).isFalse();
        assertThat(environment.containsProperty("samjhana.fuel-price-scraper.depot")).isFalse();
    }
}

package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RestaurantIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private String staff, manager, admin;

    private String bearer(String username, User.UserRole role) {
        User user = userRepository.findByUsername(username).orElseGet(() -> userRepository.save(
                User.builder().username(username).passwordHash(passwordEncoder.encode("x"))
                        .fullName(username).fullNameNepali(username).role(role).build()));
        return "Bearer " + jwtUtil.generateToken(user);
    }

    @BeforeEach
    void setUp() {
        staff = bearer("rs-staff", User.UserRole.STAFF);
        manager = bearer("rs-manager", User.UserRole.MANAGER);
        admin = bearer("rs-admin", User.UserRole.ADMIN);
    }

    private String createDish(String json) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/restaurant/dishes").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isOk()).andReturn();
        return com.jayway.jsonpath.JsonPath.read(r.getResponse().getContentAsString(), "$.dish.id");
    }

    @Test
    void shouldLetOnlyAdminsAddEditOrRemoveDishes() throws Exception {
        String json = "{\"name\":\"Thukpa\",\"veg\":false,\"course\":\"MAIN\"}";
        for (String who : new String[]{staff, manager}) {
            mockMvc.perform(post("/api/restaurant/dishes").header("Authorization", who)
                    .contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isForbidden());
        }
        String id = createDish(json);
        mockMvc.perform(put("/api/restaurant/dishes/" + id).header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"price\":250}")).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/restaurant/dishes/" + id).header("Authorization", manager)).andExpect(status().isForbidden());
        mockMvc.perform(put("/api/restaurant/dishes/" + id).header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"price\":250}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.dish.price").value(250));
    }

    @Test
    void shouldRequireLoginForTheStaffListButNotForThePublicMenu() throws Exception {
        mockMvc.perform(get("/api/restaurant/dishes")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/restaurant/dishes").header("Authorization", staff)).andExpect(status().isOk());
        mockMvc.perform(get("/api/public/restaurant")).andExpect(status().isOk()).andExpect(jsonPath("$.dishes").isArray());
    }

    @Test
    void shouldShowOnlySwitchedOnDishesOnThePublicMenu_withoutStaffFields() throws Exception {
        createDish("{\"name\":\"Visible Dish\",\"course\":\"SNACK\",\"mealPeriods\":[\"LUNCH\",\"BREAKFAST\"]}");
        createDish("{\"name\":\"Hidden Dish\",\"course\":\"SNACK\",\"showOnWebsite\":false}");

        mockMvc.perform(get("/api/public/restaurant"))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    java.util.List<java.util.List<String>> periods = com.jayway.jsonpath.JsonPath.read(
                            result.getResponse().getContentAsString(), "$.dishes[?(@.name=='Visible Dish')].mealPeriods");
                    org.assertj.core.api.Assertions.assertThat(periods).hasSize(1);
                    org.assertj.core.api.Assertions.assertThat(periods.get(0)).containsExactly("BREAKFAST", "LUNCH");   // kept in day order
                })
                .andExpect(jsonPath("$.dishes[?(@.name=='Hidden Dish')]").isEmpty())
                .andExpect(content().string(org.hamcrest.Matchers.not(containsString("showOnWebsite"))))
                .andExpect(content().string(org.hamcrest.Matchers.not(containsString("sortOrder"))));
    }

    @Test
    void shouldLetManagersSwitchADishOffForToday_andKeepItOnTheMenuAsUnavailable() throws Exception {
        String id = createDish("{\"name\":\"Sold Out Soon\",\"course\":\"MAIN\"}");
        mockMvc.perform(patch("/api/restaurant/dishes/" + id + "/available").header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content("{\"available\":false}")).andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/restaurant/dishes/" + id + "/available").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content("{\"available\":false}")).andExpect(status().isOk());
        mockMvc.perform(get("/api/public/restaurant"))
                .andExpect(jsonPath("$.dishes[?(@.name=='Sold Out Soon')].available").value(org.hamcrest.Matchers.hasItem(false)));
    }

    @Test
    void shouldRejectBadDishes_withAMessage() throws Exception {
        for (String bad : new String[]{"{\"name\":\" \"}", "{\"name\":\"X\",\"course\":\"STARTER\"}",
                "{\"name\":\"X\",\"price\":-1}", "{\"name\":\"X\",\"price\":\"lots\"}",
                "{\"name\":\"X\",\"mealPeriods\":[\"BRUNCH\"]}", "{\"name\":\"X\",\"mealPeriods\":[]}",
                "{\"name\":\"X\",\"imageId\":\"" + java.util.UUID.randomUUID() + "\"}"}) {
            mockMvc.perform(post("/api/restaurant/dishes").header("Authorization", admin)
                    .contentType(MediaType.APPLICATION_JSON).content(bad)).andExpect(status().isBadRequest());
        }
    }

    @Test
    void shouldSoftDeleteADish_soItLeavesBothMenus() throws Exception {
        String id = createDish("{\"name\":\"Gone Soon\",\"course\":\"DRINK\"}");
        mockMvc.perform(delete("/api/restaurant/dishes/" + id).header("Authorization", admin)).andExpect(status().isOk());
        mockMvc.perform(get("/api/restaurant/dishes").header("Authorization", admin))
                .andExpect(jsonPath("$[?(@.name=='Gone Soon')]").isEmpty());
        mockMvc.perform(get("/api/public/restaurant")).andExpect(jsonPath("$.dishes[?(@.name=='Gone Soon')]").isEmpty());
        mockMvc.perform(put("/api/restaurant/dishes/" + id).header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Back\"}")).andExpect(status().isBadRequest());
    }
}

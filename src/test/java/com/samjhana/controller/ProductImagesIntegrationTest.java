package com.samjhana.controller;

import com.jayway.jsonpath.JsonPath;
import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BeekeepingProduct.BeekeepingCategory;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.FurnitureItem.FurnitureCategory;
import com.samjhana.entity.User;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import com.samjhana.testsupport.TestImages;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Product pictures end to end: upload, attach in the admin, see them (cover first) on the public shop. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ProductImagesIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired FurnitureItemRepository furnitureRepository;
    @Autowired BeekeepingProductRepository beekeepingRepository;

    private String admin;
    private FurnitureItem table;
    private BeekeepingProduct jar;

    @BeforeEach
    void setUp() {
        admin = "Bearer " + jwtUtil.generateToken(userRepository.findByUsername("pi-admin").orElseGet(() -> userRepository.save(
                User.builder().username("pi-admin").passwordHash(passwordEncoder.encode("x")).fullName("a").fullNameNepali("a")
                        .role(User.UserRole.ADMIN).build())));
        table = furnitureRepository.save(FurnitureItem.builder().name("Pine Table").sku("PI-TBL").slug("pi-tbl")
                .category(FurnitureCategory.TABLE).sellingPrice(new BigDecimal("9000")).stockQty(2).build());
        jar = beekeepingRepository.save(BeekeepingProduct.builder().name("Pine Honey").sku("PI-HNY").slug("pi-hny")
                .category(BeekeepingCategory.HONEY).sellingPrice(new BigDecimal("700")).stockQty(4).showOnWebsite(true).build());
    }

    private String upload() throws Exception {
        String body = mockMvc.perform(multipart("/api/media").file(new MockMultipartFile("file", "p.png", "image/png", TestImages.png()))
                .header("Authorization", admin)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    @Test
    void shouldAttachPicturesToABeekeepingProduct_coverFirst_andShowThemInTheShop() throws Exception {
        String first = upload(), second = upload();
        mockMvc.perform(put("/api/beekeeping/items/" + jar.getId()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"imageIds\":[\"" + second + "\",\"" + first + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.item.imageIds[0]").value(second))
                .andExpect(jsonPath("$.item.imageUrls[1]").value("/api/public/media/" + first));

        mockMvc.perform(get("/api/public/shop/products/pi-hny"))
                .andExpect(jsonPath("$.image").value("/api/public/media/" + second))
                .andExpect(jsonPath("$.images.length()").value(2));
        mockMvc.perform(get("/api/public/media/" + second)).andExpect(status().isOk());
    }

    @Test
    void shouldAttachPicturesToFurniture_andGiveNewFurnitureAWebSlug() throws Exception {
        String id = upload();
        mockMvc.perform(put("/api/furniture/items/" + table.getId()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"imageIds\":[\"" + id + "\"],\"badge\":\"New\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.item.imageUrls[0]").value("/api/public/media/" + id));
        mockMvc.perform(get("/api/public/shop/products/pi-tbl"))
                .andExpect(jsonPath("$.image").value("/api/public/media/" + id)).andExpect(jsonPath("$.badge").value("New"));

        mockMvc.perform(post("/api/furniture/items").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Oak Stool\",\"sku\":\"PI-STL\",\"category\":\"CHAIR\",\"sellingPrice\":1200,\"stockQty\":1}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/public/shop/products").param("q", "oak stool"))
                .andExpect(jsonPath("$.items[0].id").value("pi-stl"));    // shown on the website by default
    }

    @Test
    void shouldHideAProductFromTheShop_whenSwitchedOffForTheWebsite() throws Exception {
        mockMvc.perform(put("/api/furniture/items/" + table.getId()).header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"showOnWebsite\":false}")).andExpect(status().isOk());
        mockMvc.perform(get("/api/public/shop/products/pi-tbl")).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/furniture/items/" + table.getId()).header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"showOnWebsite\":true}")).andExpect(status().isOk());
        mockMvc.perform(get("/api/public/shop/products/pi-tbl")).andExpect(status().isOk());
    }

    @Test
    void shouldRefuseUnknownRemovedOrTooManyPictures_andChangeNothing() throws Exception {
        mockMvc.perform(put("/api/beekeeping/items/" + jar.getId()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"imageIds\":[\"" + UUID.randomUUID() + "\"]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(containsString("removed")));
        mockMvc.perform(put("/api/furniture/items/" + table.getId()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"imageIds\":[\"not-an-id\"]}"))
                .andExpect(status().isBadRequest());
        StringBuilder many = new StringBuilder();
        for (int i = 0; i < 11; i++) many.append(i > 0 ? "," : "").append('"').append(UUID.randomUUID()).append('"');
        mockMvc.perform(put("/api/beekeeping/items/" + jar.getId()).header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"imageIds\":[" + many + "]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(containsString("at most 10")));
    }

    @Test
    void shouldReturnThePicturesInTheAdminItemList() throws Exception {
        String id = upload();
        mockMvc.perform(put("/api/beekeeping/items/" + jar.getId()).header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"imageIds\":[\"" + id + "\"]}")).andExpect(status().isOk());
        mockMvc.perform(get("/api/beekeeping/items").header("Authorization", admin))
                .andExpect(jsonPath("$[?(@.sku=='PI-HNY')].imageIds[0]").value(hasItem(id)));
    }
}

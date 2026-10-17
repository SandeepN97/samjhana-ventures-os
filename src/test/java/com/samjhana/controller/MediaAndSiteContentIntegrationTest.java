package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.UserRepository;
import com.samjhana.security.JwtUtil;
import com.samjhana.testsupport.PictureFixtures;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Pictures and the website's editable text, through the real security filter chain. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MediaAndSiteContentIntegrationTest {

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
        staff = bearer("ms-staff", User.UserRole.STAFF);
        manager = bearer("ms-manager", User.UserRole.MANAGER);
        admin = bearer("ms-admin", User.UserRole.ADMIN);
    }

    private String upload(String who, byte[] bytes, String name) throws Exception {
        MvcResult result = mockMvc.perform(multipart("/api/media")
                        .file(new MockMultipartFile("file", name, "image/png", bytes)).header("Authorization", who))
                .andExpect(status().isOk()).andReturn();
        return com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }

    // ---- pictures ---------------------------------------------------------------------------------

    @Test
    void shouldLetAdminsAndManagersUpload_butNotStaffOrStrangers() throws Exception {
        byte[] png = TestImages.png();
        mockMvc.perform(multipart("/api/media").file(new MockMultipartFile("file", "a.png", "image/png", png)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(multipart("/api/media").file(new MockMultipartFile("file", "a.png", "image/png", png))
                .header("Authorization", staff)).andExpect(status().isForbidden());
        mockMvc.perform(multipart("/api/media").file(new MockMultipartFile("file", "a.png", "image/png", png))
                .header("Authorization", manager)).andExpect(status().isOk());
        mockMvc.perform(multipart("/api/media").file(new MockMultipartFile("file", "a.png", "image/png", png))
                .header("Authorization", admin)).andExpect(status().isOk());
    }

    @Test
    void shouldServeAnUploadedPictureToAnyone_withTheRightTypeAndOneDayCaching() throws Exception {
        byte[] png = TestImages.png();
        String id = upload(admin, png, "x.png");

        MvcResult result = mockMvc.perform(get("/api/public/media/" + id))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", containsString("max-age=86400")))
                .andExpect(header().string("Cache-Control", containsString("public")))
                .andExpect(header().string("Cache-Control", not(containsString("immutable"))))
                .andReturn();
        assertThat(result.getResponse().getContentAsByteArray()).isEqualTo(png);   // nothing hidden in it, so nothing removed
        assertThat(result.getResponse().getHeaders("Content-Security-Policy"))
                .as("the picture's own policy replaces the site-wide one, it is not added to it")
                .containsExactly("default-src 'none'; style-src 'unsafe-inline'; sandbox");
        MvcResult notModified = mockMvc.perform(get("/api/public/media/" + id).header("If-None-Match", "\"" + id + "\""))
                .andExpect(status().isNotModified())
                .andExpect(header().string("Cache-Control", containsString("max-age=86400")))
                .andReturn();
        assertThat(notModified.getResponse().getHeaders("Content-Security-Policy"))
                .containsExactly("default-src 'none'; style-src 'unsafe-inline'; sandbox");
    }

    @Test
    void shouldServeAnUploadedJpegWithoutItsHiddenDetails() throws Exception {
        byte[] withDetails = PictureFixtures.jpegPlanting(TestImages.jpeg(), PictureFixtures.ascii("TRAILER-" + PictureFixtures.SECRET),
                PictureFixtures.exifSegment(1, false), PictureFixtures.xmpSegment(), PictureFixtures.commentSegment());
        MvcResult uploaded = mockMvc.perform(multipart("/api/media")
                        .file(new MockMultipartFile("file", "holiday.jpg", "image/jpeg", withDetails)).header("Authorization", manager))
                .andExpect(status().isOk()).andReturn();
        String id = com.jayway.jsonpath.JsonPath.read(uploaded.getResponse().getContentAsString(), "$.id");
        Integer reportedSize = com.jayway.jsonpath.JsonPath.read(uploaded.getResponse().getContentAsString(), "$.sizeBytes");

        byte[] served = mockMvc.perform(get("/api/public/media/" + id)).andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg")).andReturn().getResponse().getContentAsByteArray();

        assertThat(PictureFixtures.contains(served, PictureFixtures.SECRET)).as("nothing hidden is handed to the public").isFalse();
        assertThat(served.length).isLessThan(withDetails.length).isEqualTo(reportedSize);
        assertThat(PictureFixtures.samePixels(TestImages.jpeg(), served)).isTrue();
    }

    @Test
    void shouldAcceptTheOnePixelPictureTheBrowserTestUploads() throws Exception {
        // its picture-data checksum is wrong, but browsers show it, so the upload has to keep working (it failed with 400 once)
        String id = upload(admin, PictureFixtures.PNG_WITH_WRONG_PICTURE_CHECKSUM, "chair.png");

        byte[] served = mockMvc.perform(get("/api/public/media/" + id)).andExpect(status().isOk())
                .andExpect(content().contentType("image/png")).andReturn().getResponse().getContentAsByteArray();
        assertThat(served).isEqualTo(PictureFixtures.PNG_WITH_WRONG_PICTURE_CHECKSUM);
    }

    @Test
    void shouldRefuseAFileThatOnlyStartsLikeAWebp() throws Exception {
        byte[] junkBehindAWebpHeader = PictureFixtures.riff(new byte[100]);
        mockMvc.perform(multipart("/api/media")
                        .file(new MockMultipartFile("file", "x.webp", "image/webp", junkBehindAWebpHeader))
                        .header("Authorization", admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("not a valid picture")));
        mockMvc.perform(multipart("/api/media")
                        .file(new MockMultipartFile("file", "x.webp", "image/webp", PictureFixtures.WEBP_LOSSY))
                        .header("Authorization", admin))
                .andExpect(status().isOk());
    }

    @Test
    void shouldRefuseNonPictureUploads_withAMessage() throws Exception {
        mockMvc.perform(multipart("/api/media")
                        .file(new MockMultipartFile("file", "x.png", "image/png", "<svg></svg>".getBytes()))
                        .header("Authorization", admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("JPEG, PNG or WebP")));
        mockMvc.perform(multipart("/api/media").header("Authorization", admin))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldAnswer404_forAnUnknownOrRemovedPicture_andLetOnlyAdminsRemove() throws Exception {
        mockMvc.perform(get("/api/public/media/not-an-id")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/media/" + java.util.UUID.randomUUID())).andExpect(status().isNotFound());

        String id = upload(admin, TestImages.png(), "x.png");
        mockMvc.perform(delete("/api/media/" + id).header("Authorization", manager)).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/media/" + id).header("Authorization", admin)).andExpect(status().isOk());
        mockMvc.perform(get("/api/public/media/" + id)).andExpect(status().isNotFound());
    }

    // ---- site content -----------------------------------------------------------------------------

    @Test
    void shouldGiveThePublicSiteEverySection_withDefaultsBeforeAnythingIsSaved() throws Exception {
        mockMvc.perform(get("/api/public/site"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contact.phone").value("+977 9363147818"))
                .andExpect(jsonPath("$.hours.fuelEv").value("6am – 9pm"))
                .andExpect(jsonPath("$.hub.visit.title").value("Come for the journey."))
                .andExpect(jsonPath("$.restaurant.meals.length()").value(3))
                .andExpect(jsonPath("$.shop.deliveryFee").value(150))
                .andExpect(result -> assertThat(result.getResponse().getContentAsString())
                        // picture placeholders ("@name") never leak; only the two link tokens may start with @
                        .doesNotContainPattern("\"@(?!whatsapp\"|phone\")"));
    }

    @Test
    void shouldLetAdminsAndManagersSaveASection_butNotStaff() throws Exception {
        String body = "{\"phone\":\"+977 9800000000\",\"whatsapp\":\"9779800000000\",\"mapsUrl\":\"https://maps.example/x\"}";
        mockMvc.perform(put("/api/site-content/contact").header("Authorization", staff)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mockMvc.perform(put("/api/site-content/contact")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/site-content/contact").header("Authorization", manager)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());

        mockMvc.perform(get("/api/public/site"))
                .andExpect(jsonPath("$.contact.phone").value("+977 9800000000"))
                .andExpect(jsonPath("$.hours.fuelEv").value("6am – 9pm"));   // other sections untouched
    }

    @Test
    void shouldRefuseUnsafeLinks_badKeys_andUnknownPictures() throws Exception {
        mockMvc.perform(put("/api/site-content/contact").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"mapsUrl\":\"javascript:alert(1)\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(containsString("safe link")));
        mockMvc.perform(put("/api/site-content/contact").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"whatsapp\":\"call me\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/site-content/nothing").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/site-content/bike").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"image\":\"" + java.util.UUID.randomUUID() + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(containsString("removed")));
        mockMvc.perform(put("/api/site-content/bike").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"image\":\"hello\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/site-content/hours").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"fuelEv\":\"" + "x".repeat(3001) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldAcceptARealPictureOnASection() throws Exception {
        String id = upload(admin, TestImages.png(), "bike.png");
        mockMvc.perform(put("/api/site-content/bike").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"titleLine1\":\"Back on\",\"image\":\"" + id + "\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/public/site")).andExpect(jsonPath("$.bike.image").value(id));
    }
}

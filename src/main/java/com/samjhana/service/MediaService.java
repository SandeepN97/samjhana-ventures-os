package com.samjhana.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.MediaAsset;
import com.samjhana.repository.MediaAssetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Stores and serves pictures. A file is accepted only when its own first bytes say it is a JPEG, PNG or
 * WebP: the browser's claimed type, the file name and the extension are never trusted, and SVG is refused
 * because it can carry script.
 */
@Service
@RequiredArgsConstructor
public class MediaService {

    public static final int MAX_BYTES = 3 * 1024 * 1024;
    static final int MAX_PIXELS_PER_SIDE = 8000;
    public static final int MAX_IMAGES_PER_PRODUCT = 10;
    public static final String PUBLIC_PATH = "/api/public/media/";

    private final MediaAssetRepository mediaRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public MediaAsset store(MultipartFile file, String uploadedBy) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Choose a picture to upload");
        if (file.getSize() > MAX_BYTES) throw new IllegalArgumentException("The picture is larger than 3 MB");
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("The picture could not be read");
        }
        return store(bytes, file.getOriginalFilename(), uploadedBy);
    }

    @Transactional
    public MediaAsset store(byte[] bytes, String originalName, String uploadedBy) {
        if (bytes == null || bytes.length == 0) throw new IllegalArgumentException("Choose a picture to upload");
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("The picture is larger than 3 MB");
        String type = detectType(bytes);
        if (type == null) throw new IllegalArgumentException("Only JPEG, PNG or WebP pictures can be uploaded");
        verifyDecodable(bytes, type);
        String name = originalName == null ? null : originalName.replaceAll("[\\r\\n]", " ");
        if (name != null && name.length() > 200) name = name.substring(0, 200);
        return mediaRepository.save(MediaAsset.builder()
                .contentType(type).sizeBytes((long) bytes.length).originalName(name)
                .uploadedBy(uploadedBy).data(bytes).build());
    }

    /** The picture to show, or empty when it is missing or removed. */
    public Optional<MediaAsset> find(UUID id) {
        return mediaRepository.findByIdAndDeletedAtIsNull(id);
    }

    @Transactional
    public void delete(UUID id) {
        MediaAsset asset = mediaRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new IllegalArgumentException("Picture not found"));
        asset.setDeletedAt(LocalDateTime.now());
        mediaRepository.save(asset);
    }

    // ===================== picture lists on products =====================

    /** Checks a list of picture ids from a form and returns them as clean UUIDs in the same order. */
    public List<UUID> requireLiveIds(Object raw) {
        if (raw == null) return List.of();
        if (!(raw instanceof Collection<?> values)) throw new IllegalArgumentException("Pictures must be a list");
        if (values.size() > MAX_IMAGES_PER_PRODUCT) {
            throw new IllegalArgumentException("A product can have at most " + MAX_IMAGES_PER_PRODUCT + " pictures");
        }
        List<UUID> ids = new ArrayList<>();
        for (Object v : values) {
            UUID id = parseId(v);
            if (id == null) throw new IllegalArgumentException("Unknown picture");
            if (!ids.contains(id)) ids.add(id);
        }
        if (!ids.isEmpty() && mediaRepository.findLiveIds(ids).size() != ids.size()) {
            throw new IllegalArgumentException("One of the pictures was removed; upload it again");
        }
        return ids;
    }

    public String toJson(List<UUID> ids) {
        try {
            return objectMapper.writeValueAsString(ids.stream().map(UUID::toString).toList());
        } catch (IOException e) {
            return "[]";
        }
    }

    public List<UUID> fromJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<String> raw = objectMapper.readValue(json, new TypeReference<List<String>>() {});
            List<UUID> ids = new ArrayList<>();
            for (String s : raw) {
                UUID id = parseId(s);
                if (id != null) ids.add(id);
            }
            return ids;
        } catch (IOException e) {
            return List.of();
        }
    }

    public static String urlOf(UUID id) {
        return PUBLIC_PATH + id;
    }

    public static List<String> urlsOf(List<UUID> ids) {
        return ids.stream().map(MediaService::urlOf).toList();
    }

    static UUID parseId(Object value) {
        if (value == null) return null;
        try {
            return UUID.fromString(value.toString().trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    // ===================== file checks =====================

    static String detectType(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return "image/png";
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        return null;
    }

    /** JPEG and PNG are opened (not decoded) to confirm they are real pictures of a sane size. */
    private static void verifyDecodable(byte[] bytes, String type) {
        if ("image/webp".equals(type)) return;
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) throw new IllegalArgumentException("That file is not a valid picture");
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                if (reader.getWidth(0) > MAX_PIXELS_PER_SIDE || reader.getHeight(0) > MAX_PIXELS_PER_SIDE) {
                    throw new IllegalArgumentException("The picture is too large; use one under 8000 pixels wide");
                }
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("That file is not a valid picture");
        }
    }
}

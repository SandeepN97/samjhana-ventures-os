package com.samjhana.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;

@Service
public class PlatePhotoStorageService {

    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private final Path storageRoot;

    public PlatePhotoStorageService(@Value("${samjhana.storage.images.path:./data/images}") String basePath) {
        this.storageRoot = Paths.get(basePath).toAbsolutePath().normalize();
    }

    public String store(String dataUrl, String plateNumber) {
        if (dataUrl == null || dataUrl.isBlank()) return null;
        int comma = dataUrl.indexOf(',');
        if (comma < 0 || !dataUrl.startsWith("data:image/")) {
            throw new IllegalArgumentException("Plate photo must be an image data URL");
        }
        String header = dataUrl.substring(0, comma).toLowerCase(Locale.ROOT);
        String extension = extensionFor(header);
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(dataUrl.substring(comma + 1));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Plate photo is not valid Base64 data");
        }
        if (bytes.length == 0 || bytes.length > MAX_BYTES) {
            throw new IllegalArgumentException("Plate photo must be between 1 byte and 5 MB");
        }

        LocalDate today = LocalDate.now();
        String safePlate = plateNumber.replaceAll("[^A-Z0-9]", "-");
        Path relative = Paths.get("ev", "plates", String.valueOf(today.getYear()),
                String.format("%02d", today.getMonthValue()),
                safePlate + "-" + UUID.randomUUID() + extension);
        Path target = storageRoot.resolve(relative).normalize();
        if (!target.startsWith(storageRoot)) {
            throw new IllegalArgumentException("Invalid plate photo path");
        }
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
            return relative.toString().replace('\\', '/');
        } catch (IOException ex) {
            throw new IllegalStateException("Could not store plate photo", ex);
        }
    }

    public Resource load(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) return null;
        try {
            Path target = storageRoot.resolve(relativePath).normalize();
            if (!target.startsWith(storageRoot) || !Files.isRegularFile(target)) return null;
            return new UrlResource(target.toUri());
        } catch (Exception ex) {
            return null;
        }
    }

    private String extensionFor(String header) {
        if (header.startsWith("data:image/jpeg;") || header.startsWith("data:image/jpg;")) return ".jpg";
        if (header.startsWith("data:image/png;")) return ".png";
        if (header.startsWith("data:image/webp;")) return ".webp";
        throw new IllegalArgumentException("Plate photo must be JPEG, PNG, or WebP");
    }
}

package com.samjhana.service;

import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.FurnitureItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Locale;

/** Web-safe product ids for the public shop. Furniture and beekeeping share one namespace so a slug names exactly one product. */
@Service
@RequiredArgsConstructor
public class SlugService {

    private final FurnitureItemRepository furnitureItemRepository;
    private final BeekeepingProductRepository beekeepingProductRepository;

    public static String slugify(String text) {
        String ascii = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (ascii.length() > 70) ascii = ascii.substring(0, 70).replaceAll("-$", "");
        return ascii.isEmpty() ? "product" : ascii;
    }

    /** A slug starting from {@code base} that no other product uses. */
    public String uniqueSlug(String base) {
        String root = slugify(base);
        String slug = root;
        int n = 2;
        while (furnitureItemRepository.existsBySlug(slug) || beekeepingProductRepository.existsBySlug(slug)) {
            slug = root + "-" + n++;
        }
        return slug;
    }
}

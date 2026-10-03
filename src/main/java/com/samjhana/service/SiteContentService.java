package com.samjhana.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.SiteContent;
import com.samjhana.repository.MediaAssetRepository;
import com.samjhana.repository.SiteContentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.regex.Pattern;

/**
 * The editable text and picture choices behind the public website. Only the fixed keys below exist, each
 * holds one JSON object, and every value is checked on save: sizes are capped, links must be safe
 * (no {@code javascript:}), and a picture field may only name a picture that exists.
 *
 * <p>A key that has never been saved falls back to the built-in defaults, so the site is never blank.
 */
@Service
@RequiredArgsConstructor
public class SiteContentService {

    public static final Set<String> KEYS = new LinkedHashSet<>(List.of(
            "identity", "contact", "hours", "hub", "trust", "featured", "fuelEv", "bike", "restaurant", "shop"));

    static final int MAX_JSON_CHARS = 60_000;
    static final int MAX_STRING = 3_000;
    static final int MAX_LIST = 60;
    static final int MAX_DEPTH = 6;
    private static final Pattern FIELD = Pattern.compile("[A-Za-z][A-Za-z0-9]{0,39}");
    private static final Pattern PHONE_DIGITS = Pattern.compile("\\+?[0-9]{8,15}");
    /** Links the site may use: its own pages, in-page anchors, web, phone, email, and two tokens it fills in itself. */
    private static final Pattern SAFE_LINK = Pattern.compile("^(/(?!/).*|#.*|https?://.+|tel:.+|mailto:.+|@whatsapp|@phone)$");
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    private final SiteContentRepository contentRepository;
    private final MediaAssetRepository mediaRepository;
    private final ObjectMapper objectMapper;

    private volatile Map<String, Map<String, Object>> defaults;

    /** Everything the public site needs, in one object: each saved key, or its default. */
    public Map<String, Object> getAll() {
        Map<String, SiteContent> saved = new HashMap<>();
        contentRepository.findAll().forEach(c -> saved.put(c.getContentKey(), c));
        Map<String, Object> all = new LinkedHashMap<>();
        for (String key : KEYS) {
            SiteContent row = saved.get(key);
            all.put(key, row != null ? parse(row.getContentValue()) : withoutPlaceholders(defaultsFor(key)));
        }
        return all;
    }

    public Map<String, Object> get(String key) {
        requireKey(key);
        return contentRepository.findById(key)
                .map(row -> parse(row.getContentValue()))
                .orElseGet(() -> withoutPlaceholders(defaultsFor(key)));
    }

    @Transactional
    public Map<String, Object> put(String key, Map<String, Object> value, String username) {
        requireKey(key);
        if (value == null) throw new IllegalArgumentException("Content is required");
        List<UUID> pictures = new ArrayList<>();
        validate(value, "", 0, pictures);
        if (!pictures.isEmpty() && mediaRepository.findLiveIds(pictures).size() != new HashSet<>(pictures).size()) {
            throw new IllegalArgumentException("A picture you chose was removed; upload it again");
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Content could not be saved");
        }
        if (json.length() > MAX_JSON_CHARS) throw new IllegalArgumentException("That section is too long");
        contentRepository.save(SiteContent.builder().contentKey(key).contentValue(json).updatedBy(username).build());
        return value;
    }

    /** The built-in default for a key; picture fields hold "@name" placeholders the seeder swaps for real ids. */
    public Map<String, Object> defaultsFor(String key) {
        Map<String, Map<String, Object>> all = defaults;
        if (all == null) {
            try (InputStream in = new ClassPathResource("seed/site-content-defaults.json").getInputStream()) {
                all = objectMapper.readValue(in, new TypeReference<Map<String, Map<String, Object>>>() {});
            } catch (IOException e) {
                throw new IllegalStateException("Could not read the default site content", e);
            }
            defaults = all;
        }
        return all.getOrDefault(key, new LinkedHashMap<>());
    }

    public boolean isSaved(String key) {
        return contentRepository.existsById(key);
    }

    // ===================== checks =====================

    private static void requireKey(String key) {
        if (!KEYS.contains(key)) throw new IllegalArgumentException("Unknown section: " + key);
    }

    @SuppressWarnings("unchecked")
    private void validate(Object node, String field, int depth, List<UUID> pictures) {
        if (depth > MAX_DEPTH) throw new IllegalArgumentException("That section is nested too deeply");
        if (node == null || node instanceof Boolean) return;
        if (node instanceof Number n) {
            if (!Double.isFinite(n.doubleValue()) || Math.abs(n.doubleValue()) > 1e9) {
                throw new IllegalArgumentException("A number is out of range");
            }
            return;
        }
        if (node instanceof String s) {
            checkString(s, field, pictures);
            return;
        }
        if (node instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> e : map.entrySet()) {
                String k = String.valueOf(e.getKey());
                if (!FIELD.matcher(k).matches()) throw new IllegalArgumentException("Unknown field name: " + k);
                validate(e.getValue(), k, depth + 1, pictures);
            }
            return;
        }
        if (node instanceof List<?> list) {
            if (list.size() > MAX_LIST) throw new IllegalArgumentException("A list has too many entries");
            for (Object item : list) validate(item, field, depth + 1, pictures);
            return;
        }
        throw new IllegalArgumentException("Unsupported value in " + field);
    }

    private static void checkString(String s, String field, List<UUID> pictures) {
        if (s.length() > MAX_STRING) throw new IllegalArgumentException("Text in '" + field + "' is too long");
        if (s.isEmpty()) return;
        String lower = field.toLowerCase(Locale.ROOT);
        if (lower.equals("image") || lower.endsWith("image")) {
            if (!UUID_PATTERN.matcher(s).matches()) throw new IllegalArgumentException("Choose a picture by uploading it");
            pictures.add(UUID.fromString(s));
        } else if (lower.equals("href") || lower.endsWith("url") || lower.endsWith("href")) {
            if (!SAFE_LINK.matcher(s.trim()).matches()) throw new IllegalArgumentException("'" + field + "' is not a safe link");
        } else if (lower.equals("whatsapp")) {
            if (!PHONE_DIGITS.matcher(s).matches()) {
                throw new IllegalArgumentException("WhatsApp must be a phone number in digits, e.g. 9779812345678");
            }
        }
    }

    private Map<String, Object> parse(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return new LinkedHashMap<>();
        }
    }

    /** A default shown before anything is saved: "@name" picture placeholders become empty. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> withoutPlaceholders(Map<String, Object> node) {
        return (Map<String, Object>) strip(node);
    }

    @SuppressWarnings("unchecked")
    private Object strip(Object node) {
        if (node instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            map.forEach((k, v) -> out.put(String.valueOf(k), strip(v)));
            return out;
        }
        if (node instanceof List<?> list) return list.stream().map(this::strip).toList();
        if (node instanceof String s && s.startsWith("@") && !s.equals("@whatsapp") && !s.equals("@phone")) return "";
        return node;
    }
}

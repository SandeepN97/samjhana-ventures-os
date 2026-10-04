package com.samjhana.seed;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.SiteContent;
import com.samjhana.repository.SiteContentRepository;
import com.samjhana.service.SiteContentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fills in the public website's text and pictures with today's content the first time the app starts, so
 * nothing on the site lives in its source code. Reference data like {@link BusinessUnitSeeder}: it only
 * adds a section that has never been saved and never touches one staff have edited.
 */
@Component
@Profile("!test")
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
@RequiredArgsConstructor
@Slf4j
public class SiteContentSeeder implements CommandLineRunner {

    private final SiteContentService siteContentService;
    private final SiteContentRepository contentRepository;
    private final SeedImages seedImages;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public void run(String... args) throws JsonProcessingException {
        int added = 0;
        for (String key : SiteContentService.KEYS) {
            if (siteContentService.isSaved(key)) continue;
            Object resolved = resolve(siteContentService.defaultsFor(key));
            contentRepository.save(SiteContent.builder().contentKey(key)
                    .contentValue(objectMapper.writeValueAsString(resolved)).updatedBy("seed").build());
            added++;
        }
        if (added > 0) log.info("Added {} default website section(s).", added);
    }

    /** "@name" picture placeholders become picture ids; "@whatsapp" and "@phone" stay as the site's own link tokens. */
    private Object resolve(Object node) {
        if (node instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            map.forEach((k, v) -> out.put(String.valueOf(k), resolve(v)));
            return out;
        }
        if (node instanceof List<?> list) return list.stream().map(this::resolve).toList();
        if (node instanceof String s && s.startsWith("@") && !s.equals("@whatsapp") && !s.equals("@phone")) {
            return seedImages.idFor(s.substring(1)).map(Object::toString).orElse("");
        }
        return node;
    }
}

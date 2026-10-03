package com.samjhana.seed;

import com.samjhana.entity.FurnitureItem;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.service.SlugService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Gives furniture added before the online shop existed a web-safe slug, so it can be linked from the public site. */
@Component
@Profile("!test")
@Order(Ordered.HIGHEST_PRECEDENCE + 15)
@RequiredArgsConstructor
@Slf4j
public class FurnitureSlugBackfill implements CommandLineRunner {

    private final FurnitureItemRepository furnitureItemRepository;
    private final SlugService slugService;

    @Override
    @Transactional
    public void run(String... args) {
        List<FurnitureItem> missing = furnitureItemRepository.findBySlugIsNull();
        for (FurnitureItem item : missing) {
            item.setSlug(slugService.uniqueSlug(item.getSku() != null ? item.getSku() : item.getName()));
            furnitureItemRepository.save(item);
        }
        if (!missing.isEmpty()) log.info("Gave {} furniture item(s) a website slug.", missing.size());
    }
}

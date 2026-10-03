package com.samjhana.seed;

import com.samjhana.entity.RestaurantDish;
import com.samjhana.entity.RestaurantDish.Course;
import com.samjhana.repository.RestaurantDishRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * The menu the public site used to carry in its code. Added once, only when the restaurant has no dishes at
 * all, so dishes staff later remove are not brought back. Dishes start with no price or picture; staff add them.
 */
@Component
@Profile("!test")
@Order(Ordered.HIGHEST_PRECEDENCE + 30)
@RequiredArgsConstructor
@Slf4j
public class RestaurantDishSeeder implements CommandLineRunner {

    private static final String ALL = "BREAKFAST,LUNCH,DINNER";
    private static final String MAIN_MEALS = "LUNCH,DINNER";

    private final RestaurantDishRepository dishRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (dishRepository.count() > 0) return;
        List<RestaurantDish> dishes = new ArrayList<>();
        int order = 0;
        for (Object[] d : new Object[][]{
                {"Dal Bhat Set", true, Course.MAIN, MAIN_MEALS}, {"Khasi ko Masu", false, Course.MAIN, MAIN_MEALS},
                {"Dhido Set", true, Course.MAIN, MAIN_MEALS}, {"Kukhura ko Masu", false, Course.MAIN, MAIN_MEALS},
                {"Buff Momo (8 pcs)", false, Course.SNACK, ALL}, {"Sel Roti", true, Course.SNACK, ALL},
                {"Mushroom Chyau", true, Course.SNACK, ALL},
                {"Masala Chiya", true, Course.DRINK, ALL}, {"Plain Tea", true, Course.DRINK, ALL},
                {"Lassi", true, Course.DRINK, ALL}, {"Fruit Juice", true, Course.DRINK, ALL},
                {"Sel Roti Set", true, Course.BREAKFAST, "BREAKFAST"}, {"Chiura Dahi", true, Course.BREAKFAST, "BREAKFAST"},
                {"Egg Roti", false, Course.BREAKFAST, "BREAKFAST"}}) {
            dishes.add(RestaurantDish.builder().name((String) d[0]).veg((Boolean) d[1]).course((Course) d[2])
                    .mealPeriods((String) d[3]).sortOrder(++order).build());
        }
        dishRepository.saveAll(dishes);
        log.info("Added {} starter menu dishes.", dishes.size());
    }
}

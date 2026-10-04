package com.samjhana.service;

import com.samjhana.entity.RestaurantDish;
import com.samjhana.entity.RestaurantDish.Course;
import com.samjhana.repository.MediaAssetRepository;
import com.samjhana.repository.RestaurantDishRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/** The restaurant menu: staff manage dishes, the public site lists the ones switched on. */
@Service
@RequiredArgsConstructor
public class RestaurantService {

    public static final List<String> MEAL_PERIODS = List.of("BREAKFAST", "LUNCH", "DINNER");

    private final RestaurantDishRepository dishRepository;
    private final MediaAssetRepository mediaRepository;

    public List<Map<String, Object>> listForAdmin() {
        return dishRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAsc().stream().map(d -> toMap(d, true)).toList();
    }

    /** What the public menu shows: switched-on dishes only, with a dish the kitchen is out of marked unavailable. */
    public List<Map<String, Object>> listForPublic() {
        return dishRepository.findByDeletedAtIsNullAndShowOnWebsiteTrueOrderBySortOrderAscNameAsc().stream()
                .map(d -> toMap(d, false)).toList();
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> request) {
        RestaurantDish dish = RestaurantDish.builder().build();
        apply(dish, request, true);
        if (request.get("sortOrder") == null) dish.setSortOrder((int) dishRepository.countByDeletedAtIsNull() + 1);
        return toMap(dishRepository.save(dish), true);
    }

    @Transactional
    public Map<String, Object> update(UUID id, Map<String, Object> request) {
        RestaurantDish dish = find(id);
        apply(dish, request, false);
        return toMap(dishRepository.save(dish), true);
    }

    /** Switch a dish on or off for today without editing it. */
    @Transactional
    public Map<String, Object> setAvailable(UUID id, boolean available) {
        RestaurantDish dish = find(id);
        dish.setAvailable(available);
        return toMap(dishRepository.save(dish), true);
    }

    @Transactional
    public void delete(UUID id) {
        RestaurantDish dish = find(id);
        dish.setDeletedAt(LocalDateTime.now());
        dish.setShowOnWebsite(false);
        dishRepository.save(dish);
    }

    private RestaurantDish find(UUID id) {
        return dishRepository.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> new IllegalArgumentException("Dish not found"));
    }

    private void apply(RestaurantDish dish, Map<String, Object> r, boolean creating) {
        if (creating || r.containsKey("name")) {
            String name = text(r.get("name"));
            if (name == null) throw new IllegalArgumentException("Dish name is required");
            if (name.length() > 150) throw new IllegalArgumentException("Dish name is too long");
            dish.setName(name);
        }
        if (r.containsKey("nameNepali")) dish.setNameNepali(text(r.get("nameNepali")));
        if (r.containsKey("description")) dish.setDescription(text(r.get("description")));
        if (r.containsKey("price")) dish.setPrice(price(r.get("price")));
        if (r.containsKey("veg")) dish.setVeg(!Boolean.FALSE.equals(r.get("veg")));
        if (creating || r.containsKey("course")) {
            Object raw = r.get("course");
            try {
                dish.setCourse(raw == null ? Course.MAIN : Course.valueOf(raw.toString().toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Unknown course: " + raw);
            }
        }
        if (creating || r.containsKey("mealPeriods")) dish.setMealPeriods(periods(r.get("mealPeriods"), creating));
        if (r.containsKey("available")) dish.setAvailable(!Boolean.FALSE.equals(r.get("available")));
        if (r.containsKey("showOnWebsite")) dish.setShowOnWebsite(!Boolean.FALSE.equals(r.get("showOnWebsite")));
        if (r.get("sortOrder") instanceof Number n) dish.setSortOrder(n.intValue());
        if (r.containsKey("imageId")) {
            UUID image = MediaService.parseId(r.get("imageId"));
            if (r.get("imageId") != null && !r.get("imageId").toString().isBlank()) {
                if (image == null || mediaRepository.findLiveIds(List.of(image)).isEmpty()) {
                    throw new IllegalArgumentException("That picture was removed; upload it again");
                }
            }
            dish.setImageId(image);
        }
    }

    private static String periods(Object raw, boolean creating) {
        if (raw == null) {
            if (creating) return String.join(",", MEAL_PERIODS);
            throw new IllegalArgumentException("Choose at least one meal");
        }
        Collection<?> values = raw instanceof Collection<?> c ? c : List.of(raw.toString().split(","));
        List<String> out = new ArrayList<>();
        for (Object v : values) {
            String p = v.toString().trim().toUpperCase(Locale.ROOT);
            if (!MEAL_PERIODS.contains(p)) throw new IllegalArgumentException("Unknown meal: " + v);
            if (!out.contains(p)) out.add(p);
        }
        if (out.isEmpty()) throw new IllegalArgumentException("Choose at least one meal");
        out.sort(Comparator.comparingInt(MEAL_PERIODS::indexOf));
        return String.join(",", out);
    }

    private static BigDecimal price(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            BigDecimal p = new BigDecimal(value.toString());
            if (p.signum() < 0) throw new IllegalArgumentException("Price cannot be negative");
            return p;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Price must be a number");
        }
    }

    private static String text(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        return s.isEmpty() ? null : s;
    }

    Map<String, Object> toMap(RestaurantDish d, boolean admin) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.getId().toString());
        m.put("name", d.getName());
        m.put("nameNepali", d.getNameNepali());
        m.put("description", d.getDescription());
        m.put("price", d.getPrice());
        m.put("veg", d.getVeg());
        m.put("course", d.getCourse().name());
        m.put("mealPeriods", Arrays.stream(d.getMealPeriods().split(",")).filter(s -> !s.isBlank()).collect(Collectors.toList()));
        m.put("available", d.getAvailable());
        m.put("imageId", d.getImageId() == null ? null : d.getImageId().toString());
        m.put("imageUrl", d.getImageId() == null ? null : MediaService.urlOf(d.getImageId()));
        if (admin) {
            m.put("showOnWebsite", d.getShowOnWebsite());
            m.put("sortOrder", d.getSortOrder());
        }
        return m;
    }
}

package com.samjhana.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.FurnitureItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The public shop: furniture and beekeeping products seen as one catalogue. Read-only. A product shows only
 * when staff have switched it on for the website, and it never carries cost, profit, SKU, the real stock
 * count or a database id (customers get a slug and a stock <em>status</em>).
 */
@Service
@RequiredArgsConstructor
public class ShopCatalogService {

    public static final String FURNITURE = "FURNITURE";
    public static final String BEEKEEPING = "BEEKEEPING";
    static final int MAX_PAGE_SIZE = 60;

    private static final Map<String, String[]> TYPE_LABELS = Map.of(
            FURNITURE, new String[]{"Furniture", "फर्निचर"},
            BEEKEEPING, new String[]{"Honey & beekeeping", "मह र मौरीपालन"});

    private static final Map<String, String[]> CATEGORY_LABELS = new LinkedHashMap<>();
    static {
        CATEGORY_LABELS.put(FURNITURE + ":SOFA", new String[]{"Sofa", "सोफा"});
        CATEGORY_LABELS.put(FURNITURE + ":TABLE", new String[]{"Table", "टेबल"});
        CATEGORY_LABELS.put(FURNITURE + ":CHAIR", new String[]{"Chair", "कुर्सी"});
        CATEGORY_LABELS.put(FURNITURE + ":BED", new String[]{"Bed", "खाट"});
        CATEGORY_LABELS.put(FURNITURE + ":CABINET", new String[]{"Cabinet", "क्याबिनेट"});
        CATEGORY_LABELS.put(FURNITURE + ":WARDROBE", new String[]{"Wardrobe", "अलमारी"});
        CATEGORY_LABELS.put(FURNITURE + ":SHELF", new String[]{"Shelf", "शेल्फ"});
        CATEGORY_LABELS.put(FURNITURE + ":OTHER", new String[]{"Other", "अन्य"});
        CATEGORY_LABELS.put(BEEKEEPING + ":HIVE", new String[]{"Hives", "मौरी घर"});
        CATEGORY_LABELS.put(BEEKEEPING + ":GEAR", new String[]{"Protective gear", "सुरक्षा सामग्री"});
        CATEGORY_LABELS.put(BEEKEEPING + ":TOOL", new String[]{"Tools", "औजार"});
        CATEGORY_LABELS.put(BEEKEEPING + ":HONEY", new String[]{"Honey & wax", "मह र मैन"});
        CATEGORY_LABELS.put(BEEKEEPING + ":KIT", new String[]{"Starter kits", "शुरुवाती किट"});
        CATEGORY_LABELS.put(BEEKEEPING + ":OTHER", new String[]{"Other", "अन्य"});
    }

    /** A product as the shop sees it, including what the order code needs and the public never gets. */
    public record Entry(String type, UUID id, String slug, String name, String nameNepali, String category,
                        String description, String badge, BigDecimal price, List<UUID> imageIds,
                        int stockQty, int reorderLevel, String details, LocalDateTime createdAt) {
        public BeekeepingService.StockStatus status() {
            return BeekeepingService.stockStatus(stockQty, reorderLevel);
        }
    }

    private final FurnitureItemRepository furnitureItemRepository;
    private final BeekeepingProductRepository beekeepingProductRepository;
    private final MediaService mediaService;
    private final ObjectMapper objectMapper;

    // ===================== lookups =====================

    /** Every product on the website right now. */
    public List<Entry> visible() {
        List<Entry> all = new ArrayList<>();
        for (FurnitureItem f : furnitureItemRepository.findByIsActiveTrueOrderByNameAsc()) {
            if (Boolean.FALSE.equals(f.getShowOnWebsite()) || f.getSlug() == null || f.getSellingPrice() == null) continue;
            all.add(new Entry(FURNITURE, f.getId(), f.getSlug(), f.getName(), f.getNameNepali(), f.getCategory().name(),
                    f.getDescription(), f.getBadge(), f.getSellingPrice(), mediaService.fromJson(f.getImageIds()),
                    f.getStockQty(), f.getReorderLevel(), null, f.getCreatedAt()));
        }
        for (BeekeepingProduct b : beekeepingProductRepository.findByDeletedAtIsNullAndShowOnWebsiteTrueOrderByNameAsc()) {
            if (b.getSellingPrice() == null) continue;
            all.add(new Entry(BEEKEEPING, b.getId(), b.getSlug(), b.getName(), b.getNameNepali(), b.getCategory().name(),
                    b.getDescription(), b.getBadge(), b.getSellingPrice(), mediaService.fromJson(b.getImageIds()),
                    b.getStockQty(), b.getReorderLevel(), b.getDetails(), b.getCreatedAt()));
        }
        return all;
    }

    public Optional<Entry> findVisible(String slug) {
        return visible().stream().filter(e -> e.slug().equals(slug)).findFirst();
    }

    // ===================== listing =====================

    public Map<String, Object> search(String type, String category, String q, BigDecimal minPrice, BigDecimal maxPrice,
                                      boolean inStockOnly, String sort, int page, int size) {
        return search(type, category, q, minPrice, maxPrice, inStockOnly, sort, page, size, null);
    }

    /** @param slugs when given, only these products (the cart asks for the current price and status of what it holds) */
    public Map<String, Object> search(String type, String category, String q, BigDecimal minPrice, BigDecimal maxPrice,
                                      boolean inStockOnly, String sort, int page, int size, Collection<String> slugs) {
        List<Entry> all = visible();
        if (slugs != null && !slugs.isEmpty()) {
            Set<String> wanted = new HashSet<>(slugs);
            all = all.stream().filter(e -> wanted.contains(e.slug())).toList();
        }
        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);

        // Facets count what is left once the search text is applied, so a count never promises an empty page.
        List<Entry> matchingText = all.stream().filter(e -> matchesText(e, query)).toList();

        List<Entry> filtered = matchingText.stream()
                .filter(e -> isBlank(type) || e.type().equalsIgnoreCase(type))
                .filter(e -> isBlank(category) || e.category().equalsIgnoreCase(category))
                .filter(e -> minPrice == null || e.price().compareTo(minPrice) >= 0)
                .filter(e -> maxPrice == null || e.price().compareTo(maxPrice) <= 0)
                .filter(e -> !inStockOnly || e.stockQty() > 0)
                .collect(Collectors.toCollection(ArrayList::new));
        filtered.sort(comparator(sort, query));

        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int total = filtered.size();
        int totalPages = Math.max(1, (int) Math.ceil(total / (double) safeSize));
        int safePage = Math.min(Math.max(page, 1), totalPages);
        List<Map<String, Object>> items = filtered.stream()
                .skip((long) (safePage - 1) * safeSize).limit(safeSize).map(this::toPublic).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("total", total);
        result.put("page", safePage);
        result.put("size", safeSize);
        result.put("totalPages", totalPages);
        result.put("facets", facets(matchingText, type));
        return result;
    }

    public Optional<Map<String, Object>> detail(String slug) {
        List<Entry> all = visible();
        return all.stream().filter(e -> e.slug().equals(slug)).findFirst().map(e -> {
            Map<String, Object> map = toPublic(e);
            List<Map<String, Object>> related = all.stream()
                    .filter(o -> !o.slug().equals(e.slug()) && o.type().equals(e.type()))
                    .sorted(Comparator.comparing((Entry o) -> !o.category().equals(e.category())).thenComparing(Entry::name))
                    .limit(8).map(this::toPublic).toList();
            map.put("related", related);
            return map;
        });
    }

    // ===================== shaping =====================

    Map<String, Object> toPublic(Entry e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.slug());
        m.put("type", e.type());
        m.put("typeLabel", TYPE_LABELS.get(e.type())[0]);
        m.put("category", e.category());
        String[] label = CATEGORY_LABELS.getOrDefault(e.type() + ":" + e.category(), new String[]{e.category(), e.category()});
        m.put("categoryLabel", label[0]);
        m.put("categoryLabelNepali", label[1]);
        m.put("name", e.name());
        m.put("nameNepali", e.nameNepali());
        m.put("description", e.description());
        m.put("price", e.price());
        m.put("badge", e.badge());
        List<String> urls = MediaService.urlsOf(e.imageIds());
        m.put("images", urls);
        m.put("image", urls.isEmpty() ? null : urls.get(0));
        m.put("stockStatus", e.status().name());
        m.put("details", parseDetails(e.details()));
        return m;
    }

    private Map<String, Object> facets(List<Entry> matchingText, String selectedType) {
        Map<String, Integer> typeCounts = new LinkedHashMap<>();
        Map<String, Integer> categoryCounts = new LinkedHashMap<>();
        BigDecimal min = null;
        BigDecimal max = null;
        for (Entry e : matchingText) {
            typeCounts.merge(e.type(), 1, Integer::sum);
            if (isBlank(selectedType) || e.type().equalsIgnoreCase(selectedType)) {
                categoryCounts.merge(e.type() + ":" + e.category(), 1, Integer::sum);
                min = min == null || e.price().compareTo(min) < 0 ? e.price() : min;
                max = max == null || e.price().compareTo(max) > 0 ? e.price() : max;
            }
        }
        List<Map<String, Object>> types = new ArrayList<>();
        for (String t : List.of(FURNITURE, BEEKEEPING)) {
            if (!typeCounts.containsKey(t)) continue;
            types.add(Map.of("value", t, "label", TYPE_LABELS.get(t)[0], "labelNepali", TYPE_LABELS.get(t)[1], "count", typeCounts.get(t)));
        }
        List<Map<String, Object>> categories = new ArrayList<>();
        for (Map.Entry<String, String[]> c : CATEGORY_LABELS.entrySet()) {
            Integer n = categoryCounts.get(c.getKey());
            if (n == null) continue;
            String[] parts = c.getKey().split(":");
            categories.add(Map.of("type", parts[0], "value", parts[1], "label", c.getValue()[0], "labelNepali", c.getValue()[1], "count", n));
        }
        Map<String, Object> price = new LinkedHashMap<>();
        price.put("min", min);
        price.put("max", max);
        Map<String, Object> facets = new LinkedHashMap<>();
        facets.put("types", types);
        facets.put("categories", categories);
        facets.put("price", price);
        return facets;
    }

    private static boolean matchesText(Entry e, String query) {
        if (query.isEmpty()) return true;
        for (String word : query.split("\\s+")) {
            String hay = (e.name() + " " + (e.nameNepali() == null ? "" : e.nameNepali()) + " "
                    + (e.description() == null ? "" : e.description()) + " " + e.category() + " " + e.type()).toLowerCase(Locale.ROOT);
            if (!hay.contains(word)) return false;
        }
        return true;
    }

    private static Comparator<Entry> comparator(String sort, String query) {
        Comparator<Entry> byName = Comparator.comparing(e -> e.name().toLowerCase(Locale.ROOT));
        switch (sort == null ? "" : sort) {
            case "price_asc": return Comparator.comparing(Entry::price).thenComparing(byName);
            case "price_desc": return Comparator.comparing(Entry::price).reversed().thenComparing(byName);
            case "newest": return Comparator.comparing((Entry e) -> e.createdAt() == null ? LocalDateTime.MIN : e.createdAt()).reversed().thenComparing(byName);
            case "name": return byName;
            default:
                // Featured: things you can buy first, name matches before description matches, then by name.
                return Comparator.comparing((Entry e) -> e.stockQty() <= 0)
                        .thenComparing(e -> query.isEmpty() || e.name().toLowerCase(Locale.ROOT).contains(query) ? 0 : 1)
                        .thenComparing(byName);
        }
    }

    private Map<String, Object> parseDetails(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank() || s.equalsIgnoreCase("ALL");
    }
}

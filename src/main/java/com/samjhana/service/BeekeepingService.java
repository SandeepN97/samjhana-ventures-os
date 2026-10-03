package com.samjhana.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BeekeepingProduct;
import com.samjhana.entity.BeekeepingProduct.BeekeepingCategory;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.exception.InsufficientStockException;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The beekeeping shop: products with real stock counts, the dashboard, and sales history.
 *
 * <p>Every change to price, stock or removal writes an audit entry. Stock only moves through the
 * repository's guarded updates, so it can never go below zero or be double-sold.
 */
@Service
@RequiredArgsConstructor
public class BeekeepingService {

    public static final String BUSINESS_CODE = "beekeeping";
    private static final ZoneId KATHMANDU = ZoneId.of("Asia/Kathmandu");

    public enum StockStatus { IN_STOCK, LOW_STOCK, OUT_OF_STOCK }

    private final BeekeepingProductRepository productRepository;
    private final TransactionRepository transactionRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final MediaService mediaService;
    private final SlugService slugService;

    // ===================== DASHBOARD =====================

    /** @param includeCost whether the caller may see purchase (cost) prices: admins and managers only. */
    public Map<String, Object> getDashboard(boolean includeCost) {
        List<BeekeepingProduct> products = productRepository.findByDeletedAtIsNullOrderByNameAsc();

        BigDecimal stockValue = products.stream()
                .filter(p -> p.getSellingPrice() != null)
                .map(p -> p.getSellingPrice().multiply(BigDecimal.valueOf(p.getStockQty())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<BeekeepingProduct> lowStock = products.stream()
                .filter(p -> p.getStockQty() <= p.getReorderLevel())
                .collect(Collectors.toList());

        List<Transaction> all = transactionRepository.findByBusinessCodeOrderByTransactionDateDesc(BUSINESS_CODE);
        LocalDate today = LocalDate.now(KATHMANDU);
        List<Transaction> todaySales = all.stream()
                .filter(t -> today.equals(t.getTransactionDate()))
                .filter(t -> t.getTransactionType() == Transaction.TransactionType.SALE)
                .collect(Collectors.toList());
        BigDecimal todayRevenue = todaySales.stream()
                .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("totalItems", products.size());
        dashboard.put("totalStockValue", stockValue);
        dashboard.put("lowStockCount", lowStock.size());
        dashboard.put("lowStockItems", lowStock.stream().map(p -> productToMap(p, includeCost)).collect(Collectors.toList()));
        dashboard.put("todaySalesCount", todaySales.size());
        dashboard.put("todayRevenue", todayRevenue);
        dashboard.put("recentOrders", all.stream().limit(5).map(this::transactionToOrderMap).collect(Collectors.toList()));
        return dashboard;
    }

    // ===================== PRODUCTS =====================

    public List<Map<String, Object>> listItems(String category, String search, boolean includeCost) {
        List<BeekeepingProduct> products;
        BeekeepingCategory parsed = parseCategory(category);
        products = parsed != null
                ? productRepository.findByCategoryAndDeletedAtIsNullOrderByNameAsc(parsed)
                : productRepository.findByDeletedAtIsNullOrderByNameAsc();
        if (search != null && !search.isBlank()) {
            String s = search.toLowerCase();
            products = products.stream()
                    .filter(p -> p.getName().toLowerCase().contains(s)
                            || (p.getSku() != null && p.getSku().toLowerCase().contains(s)))
                    .collect(Collectors.toList());
        }
        return products.stream().map(p -> productToMap(p, includeCost)).collect(Collectors.toList());
    }

    public Map<String, Object> getItem(UUID id, boolean includeCost) {
        return productToMap(find(id), includeCost);
    }

    @Transactional
    public Map<String, Object> createItem(Map<String, Object> request, User user) {
        String name = text(request.get("name"));
        if (name == null) throw new IllegalArgumentException("Product name is required");

        String sku = text(request.get("sku"));
        if (sku == null) sku = "BEE-" + (System.currentTimeMillis() % 1_000_000);
        if (productRepository.existsBySku(sku)) throw new IllegalArgumentException("SKU already exists: " + sku);

        BeekeepingCategory category = requireCategory(request.get("category"));
        BigDecimal purchase = nonNegativeMoney(request.get("purchasePrice"), "Purchase price");
        BigDecimal selling = nonNegativeMoney(request.get("sellingPrice"), "Selling price");
        int stock = nonNegativeInt(request.get("stockQty"), 0, "Stock");
        int reorder = nonNegativeInt(request.get("reorderLevel"), 2, "Reorder level");

        BeekeepingProduct product = BeekeepingProduct.builder()
                .name(name)
                .nameNepali(text(request.get("nameNepali")))
                .sku(sku)
                .slug(slugService.uniqueSlug(sku))
                .category(category)
                .purchasePrice(purchase)
                .sellingPrice(selling)
                .stockQty(stock)
                .reorderLevel(reorder)
                .description(text(request.get("description")))
                .badge(text(request.get("badge")))
                .imageIds(request.containsKey("imageIds") ? mediaService.toJson(mediaService.requireLiveIds(request.get("imageIds"))) : null)
                .showOnWebsite(!Boolean.FALSE.equals(request.get("showOnWebsite")))
                .build();
        BeekeepingProduct saved = productRepository.save(product);
        audit(AuditLog.createEvent(user, AuditLog.EntityType.RESOURCE, saved.getId(), snapshot(saved)),
                "Beekeeping product added: " + saved.getName());
        return productToMap(saved, true);
    }

    @Transactional
    public Map<String, Object> updateItem(UUID id, Map<String, Object> request, User user) {
        BeekeepingProduct product = find(id);
        String before = snapshot(product);

        if (request.containsKey("name")) {
            String name = text(request.get("name"));
            if (name == null) throw new IllegalArgumentException("Product name is required");
            product.setName(name);
        }
        if (request.containsKey("nameNepali")) product.setNameNepali(text(request.get("nameNepali")));
        if (request.containsKey("category")) product.setCategory(requireCategory(request.get("category")));
        if (request.containsKey("purchasePrice")) product.setPurchasePrice(nonNegativeMoney(request.get("purchasePrice"), "Purchase price"));
        if (request.containsKey("sellingPrice")) product.setSellingPrice(nonNegativeMoney(request.get("sellingPrice"), "Selling price"));
        if (request.containsKey("stockQty")) product.setStockQty(nonNegativeInt(request.get("stockQty"), product.getStockQty(), "Stock"));
        if (request.containsKey("reorderLevel")) product.setReorderLevel(nonNegativeInt(request.get("reorderLevel"), product.getReorderLevel(), "Reorder level"));
        if (request.containsKey("description")) product.setDescription(text(request.get("description")));
        if (request.containsKey("badge")) product.setBadge(text(request.get("badge")));
        if (request.containsKey("imageIds")) product.setImageIds(mediaService.toJson(mediaService.requireLiveIds(request.get("imageIds"))));
        if (request.containsKey("showOnWebsite")) product.setShowOnWebsite(!Boolean.FALSE.equals(request.get("showOnWebsite")));

        BeekeepingProduct saved = productRepository.save(product);
        audit(AuditLog.updateEvent(user, AuditLog.EntityType.RESOURCE, saved.getId(), before, snapshot(saved)),
                "Beekeeping product updated: " + saved.getName());
        return productToMap(saved, true);
    }

    /** Soft delete: the product disappears from the shop and website, its sales history stays. */
    @Transactional
    public void deleteItem(UUID id, User user) {
        BeekeepingProduct product = find(id);
        String before = snapshot(product);
        product.setDeletedAt(LocalDateTime.now());
        product.setShowOnWebsite(false);
        productRepository.save(product);
        AuditLog entry = AuditLog.builder().user(user).entityType(AuditLog.EntityType.RESOURCE)
                .entityId(id).action(AuditLog.AuditAction.DELETE).oldValues(before).build();
        audit(entry, "Beekeeping product removed: " + product.getName());
    }

    /** Adds or removes stock by hand (a recount, a damaged jar). Never lets the count go below zero. */
    @Transactional
    public Map<String, Object> adjustStock(UUID id, int adjustment, User user) {
        BeekeepingProduct before = find(id);
        if (adjustment == 0) return productToMap(before, true);
        int old = before.getStockQty();

        int changed = adjustment > 0
                ? productRepository.addStock(id, adjustment)
                : productRepository.removeStock(id, -adjustment);
        if (changed == 0) throw new InsufficientStockException(before.getName());

        BeekeepingProduct after = find(id);
        AuditLog entry = AuditLog.updateEvent(user, AuditLog.EntityType.RESOURCE, id,
                "{\"stockQty\":" + old + "}", "{\"stockQty\":" + after.getStockQty() + "}");
        audit(entry, "Beekeeping stock adjusted for " + after.getName() + ": " + old + " to " + after.getStockQty());
        return productToMap(after, true);
    }

    // ===================== SALES (called by TransactionService) =====================

    /**
     * Moves stock for the lines of a beekeeping transaction: a sale takes units off, a purchase adds
     * them. Must run inside the transaction that saves the sale, so a refused line undoes the rest.
     */
    @SuppressWarnings("unchecked")
    public void applyStock(Map<String, Object> customFields, String transactionType) {
        boolean sale = "SALE".equalsIgnoreCase(transactionType);
        boolean purchase = "PURCHASE".equalsIgnoreCase(transactionType);
        if (!sale && !purchase) return;
        for (Map<String, Object> line : lines(customFields)) {
            UUID id = lineId(line);
            int qty = lineQuantity(line);
            BeekeepingProduct product = find(id);
            int changed = sale ? productRepository.removeStock(id, qty) : productRepository.addStock(id, qty);
            if (changed == 0) throw new InsufficientStockException(product.getName());
        }
    }

    /**
     * What the goods on a sale cost the shop, or empty when any line has no cost price yet. The server
     * works this out so profit never depends on what a staff device sends.
     */
    public Optional<BigDecimal> costOfLines(Map<String, Object> customFields) {
        BigDecimal total = BigDecimal.ZERO;
        for (Map<String, Object> line : lines(customFields)) {
            // A product removed since the sale was ordered has no cost to look up: record the sale without profit.
            Optional<BeekeepingProduct> found = productRepository.findByIdAndDeletedAtIsNull(lineId(line));
            if (found.isEmpty()) return Optional.empty();
            BeekeepingProduct product = found.get();
            if (product.getPurchasePrice() == null) return Optional.empty();
            total = total.add(product.getPurchasePrice().multiply(BigDecimal.valueOf(lineQuantity(line))));
        }
        return Optional.of(total);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> lines(Map<String, Object> customFields) {
        Object items = customFields == null ? null : customFields.get("items");
        if (!(items instanceof List)) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : (List<Object>) items) {
            if (o instanceof Map) out.add((Map<String, Object>) o);
        }
        return out;
    }

    private UUID lineId(Map<String, Object> line) {
        Object raw = line.get("itemId");
        try {
            return UUID.fromString(String.valueOf(raw));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown product on sale line");
        }
    }

    private int lineQuantity(Map<String, Object> line) {
        Object q = line.get("quantity");
        int qty = q instanceof Number ? ((Number) q).intValue() : 0;
        if (qty < 1) throw new IllegalArgumentException("Quantity must be at least 1");
        return qty;
    }

    // ===================== ORDERS =====================

    public List<Map<String, Object>> listOrders(String search) {
        List<Map<String, Object>> orders = transactionRepository
                .findByBusinessCodeOrderByTransactionDateDesc(BUSINESS_CODE).stream()
                .map(this::transactionToOrderMap).collect(Collectors.toList());
        if (search != null && !search.isBlank()) {
            String s = search.toLowerCase();
            orders = orders.stream().filter(o -> {
                String name = (String) o.get("customerName");
                return name != null && name.toLowerCase().contains(s);
            }).collect(Collectors.toList());
        }
        return orders;
    }

    // ===================== PUBLIC VIEW =====================

    public static StockStatus stockStatus(int stockQty, int reorderLevel) {
        if (stockQty <= 0) return StockStatus.OUT_OF_STOCK;
        if (stockQty <= reorderLevel) return StockStatus.LOW_STOCK;
        return StockStatus.IN_STOCK;
    }

    // ===================== HELPERS =====================

    private BeekeepingProduct find(UUID id) {
        return productRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
    }

    public Map<String, Object> productToMap(BeekeepingProduct p, boolean includeCost) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", p.getId().toString());
        map.put("name", p.getName());
        map.put("nameNepali", p.getNameNepali());
        map.put("sku", p.getSku());
        map.put("category", p.getCategory().name());
        if (includeCost) map.put("purchasePrice", p.getPurchasePrice());
        map.put("sellingPrice", p.getSellingPrice());
        map.put("stockQty", p.getStockQty());
        map.put("reorderLevel", p.getReorderLevel());
        map.put("stockStatus", stockStatus(p.getStockQty(), p.getReorderLevel()).name());
        map.put("description", p.getDescription());
        map.put("badge", p.getBadge());
        map.put("showOnWebsite", p.getShowOnWebsite());
        List<UUID> pictures = mediaService.fromJson(p.getImageIds());
        map.put("imageIds", pictures.stream().map(UUID::toString).toList());
        map.put("imageUrls", MediaService.urlsOf(pictures));
        map.put("createdAt", p.getCreatedAt());
        return map;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> transactionToOrderMap(Transaction t) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", t.getId().toString());
        map.put("transactionType", t.getTransactionType().name());
        map.put("transactionDate", t.getTransactionDate());
        map.put("amount", t.getAmount());
        map.put("status", t.getStatus().name());
        map.put("notes", t.getNotes());
        map.put("enteredByName", t.getEnteredBy() != null ? t.getEnteredBy().getFullName() : null);
        map.put("createdAt", t.getCreatedAt());
        Map<String, Object> cf = parseCustomFields(t.getCustomFields());
        map.put("customerName", cf.get("customerName"));
        map.put("customerPhone", cf.get("customerPhone"));
        map.put("items", cf.get("items"));
        map.put("paymentMethod", cf.get("paymentMethod"));
        return map;
    }

    private Map<String, Object> parseCustomFields(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return new HashMap<>();
        }
    }

    private String snapshot(BeekeepingProduct p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", p.getName());
        m.put("sku", p.getSku());
        m.put("category", p.getCategory());
        m.put("purchasePrice", p.getPurchasePrice());
        m.put("sellingPrice", p.getSellingPrice());
        m.put("stockQty", p.getStockQty());
        m.put("reorderLevel", p.getReorderLevel());
        m.put("showOnWebsite", p.getShowOnWebsite());
        try {
            return objectMapper.writeValueAsString(m);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private void audit(AuditLog entry, String description) {
        entry.setDescription(description.length() > 500 ? description.substring(0, 500) : description);
        auditLogRepository.save(entry);
    }

    private static BeekeepingCategory parseCategory(String category) {
        if (category == null || category.isBlank() || category.equalsIgnoreCase("ALL")) return null;
        try {
            return BeekeepingCategory.valueOf(category.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static BeekeepingCategory requireCategory(Object raw) {
        BeekeepingCategory c = raw == null ? BeekeepingCategory.OTHER : parseCategory(raw.toString());
        if (c == null) throw new IllegalArgumentException("Unknown category: " + raw);
        return c;
    }

    private static String text(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static BigDecimal nonNegativeMoney(Object value, String label) {
        if (value == null || value.toString().isBlank()) return null;
        BigDecimal amount;
        try {
            amount = new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(label + " must be a number");
        }
        if (amount.signum() < 0) throw new IllegalArgumentException(label + " cannot be negative");
        return amount;
    }

    private static int nonNegativeInt(Object value, int defaultValue, String label) {
        if (value == null || value.toString().isBlank()) return defaultValue;
        int n;
        try {
            n = value instanceof Number ? ((Number) value).intValue() : Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(label + " must be a whole number");
        }
        if (n < 0) throw new IllegalArgumentException(label + " cannot be negative");
        return n;
    }
}

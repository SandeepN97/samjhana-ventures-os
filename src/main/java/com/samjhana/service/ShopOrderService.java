package com.samjhana.service;

import com.samjhana.dto.TransactionRequest;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.ShopOrder;
import com.samjhana.entity.ShopOrder.Fulfilment;
import com.samjhana.entity.ShopOrder.PaymentMethod;
import com.samjhana.entity.ShopOrder.Status;
import com.samjhana.entity.ShopOrderLine;
import com.samjhana.entity.User;
import com.samjhana.exception.InsufficientStockException;
import com.samjhana.exception.TooManyRequestsException;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BeekeepingProductRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.ShopOrderRepository;
import com.samjhana.security.RequestThrottle;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Orders from the public website.
 *
 * <ul>
 *   <li>Prices and names always come from the database, never from the browser.</li>
 *   <li>Stock is held back when the order is placed, in guarded updates, so two customers can't buy the
 *       last unit; any line that can't be covered cancels the whole order and nothing is held.</li>
 *   <li>Cancelling gives the stock back. Completing records the sale in the daily books.</li>
 *   <li>Customers can look an order up with its number plus the phone number they gave.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ShopOrderService {

    public record Item(String slug, Integer quantity) {}

    public record PlaceOrderRequest(String customerName, String customerPhone, String customerEmail, String fulfilment,
                                    String addressLine, String city, String landmark, String notes,
                                    List<Item> items, String website) {}

    static final int MAX_LINES = 30;
    static final int MAX_QTY_PER_LINE = 50;
    private static final String ORDER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final Pattern PHONE = Pattern.compile("\\+?[0-9]{7,15}");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final ZoneId KATHMANDU = ZoneId.of("Asia/Kathmandu");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ShopOrderRepository orderRepository;
    private final ShopCatalogService catalogService;
    private final FurnitureItemRepository furnitureItemRepository;
    private final BeekeepingProductRepository beekeepingProductRepository;
    private final SiteContentService siteContentService;
    private final TransactionService transactionService;
    private final AuditLogRepository auditLogRepository;
    private final RequestThrottle throttle;

    // ===================== customers =====================

    @Transactional
    public Map<String, Object> place(PlaceOrderRequest r) {
        if (r == null) throw new IllegalArgumentException("Your order is empty");
        if (r.website() != null && !r.website().isBlank()) throw new IllegalArgumentException("Could not place the order");

        String name = requireText(r.customerName(), 2, 100, "Your name");
        String phone = normalizePhone(r.customerPhone());
        String email = optionalText(r.customerEmail(), 120, "Email");
        if (email != null && !EMAIL.matcher(email).matches()) throw new IllegalArgumentException("Enter a valid email address or leave it empty");
        Fulfilment fulfilment = parseFulfilment(r.fulfilment());
        String address = null, city = null, landmark = null;
        if (fulfilment == Fulfilment.DELIVERY) {
            address = requireText(r.addressLine(), 3, 200, "Delivery address");
            city = requireText(r.city(), 2, 100, "Town or city");
            landmark = optionalText(r.landmark(), 200, "Landmark");
        }
        String notes = optionalText(r.notes(), 1000, "Notes");

        if (!throttle.tryAcquire("order:phone:" + phone, 5, Duration.ofHours(1))
                || !throttle.tryAcquire("order:all", 120, Duration.ofHours(1))) {
            throw new TooManyRequestsException("Too many orders just now. Please call us to place this order.");
        }

        Map<String, Integer> wanted = mergeItems(r.items());

        ShopOrder order = new ShopOrder();
        order.setCustomerName(name);
        order.setCustomerPhone(phone);
        order.setCustomerEmail(email);
        order.setFulfilment(fulfilment);
        order.setAddressLine(address);
        order.setCity(city);
        order.setLandmark(landmark);
        order.setCustomerNotes(notes);
        order.setPaymentMethod(fulfilment == Fulfilment.DELIVERY ? PaymentMethod.CASH_ON_DELIVERY : PaymentMethod.PAY_AT_SHOP);

        BigDecimal subtotal = BigDecimal.ZERO;
        List<String> unavailable = new ArrayList<>();
        for (Map.Entry<String, Integer> w : wanted.entrySet()) {
            Optional<ShopCatalogService.Entry> found = catalogService.findVisible(w.getKey());
            if (found.isEmpty()) {
                throw new IllegalArgumentException("A product in your cart is no longer available. Please check your cart.");
            }
            ShopCatalogService.Entry e = found.get();
            int held = ShopCatalogService.FURNITURE.equals(e.type())
                    ? furnitureItemRepository.removeStock(e.id(), w.getValue())
                    : beekeepingProductRepository.removeStock(e.id(), w.getValue());
            if (held == 0) {
                unavailable.add(e.name());
                continue;
            }
            ShopOrderLine line = new ShopOrderLine();
            line.setProductType(e.type());
            line.setProductId(e.id());
            line.setProductSlug(e.slug());
            line.setProductName(e.name());
            line.setUnitPrice(e.price());
            line.setQuantity(w.getValue());
            line.setLineTotal(e.price().multiply(BigDecimal.valueOf(w.getValue())).setScale(2, RoundingMode.HALF_UP));
            order.addLine(line);
            subtotal = subtotal.add(line.getLineTotal());
        }
        if (!unavailable.isEmpty()) {
            // Throwing rolls back the stock already held for the lines before this one.
            throw new InsufficientStockException(String.join(", ", unavailable));
        }

        BigDecimal fee = fulfilment == Fulfilment.DELIVERY ? deliveryFee(subtotal) : BigDecimal.ZERO;
        order.setSubtotal(subtotal);
        order.setDeliveryFee(fee);
        order.setTotal(subtotal.add(fee));
        order.setOrderNumber(newOrderNumber());
        orderRepository.save(order);
        return toPublic(order);
    }

    /** The order's status for the customer who placed it: needs the order number and the phone number given. */
    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> track(String orderNumber, String phone) {
        String number = orderNumber == null ? "" : orderNumber.trim().toUpperCase(Locale.ROOT);
        if (!throttle.tryAcquire("track:" + number, 10, Duration.ofMinutes(15))
                || !throttle.tryAcquire("track:all", 300, Duration.ofMinutes(1))) {
            throw new TooManyRequestsException("Too many tries. Please wait a few minutes.");
        }
        Optional<ShopOrder> order = orderRepository.findByOrderNumber(number);
        if (order.isEmpty() || phone == null || !samePhone(order.get().getCustomerPhone(), phone)) return Optional.empty();
        return Optional.of(toPublic(order.get()));
    }

    // ===================== staff =====================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(String status, String search) {
        List<ShopOrder> orders;
        if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
            try {
                orders = orderRepository.findByStatusOrderByCreatedAtDesc(Status.valueOf(status.toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Unknown status: " + status);
            }
        } else {
            orders = orderRepository.findAllByOrderByCreatedAtDesc();
        }
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        return orders.stream()
                .filter(o -> q.isEmpty() || o.getOrderNumber().toLowerCase(Locale.ROOT).contains(q)
                        || o.getCustomerName().toLowerCase(Locale.ROOT).contains(q) || o.getCustomerPhone().contains(q))
                .limit(300)
                .map(this::toAdmin).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(UUID id) {
        return toAdmin(find(id));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary() {
        Map<String, Object> counts = new LinkedHashMap<>();
        for (Status s : Status.values()) counts.put(s.name(), 0L);
        for (Object[] row : orderRepository.countByStatus()) counts.put(((Status) row[0]).name(), (Long) row[1]);
        return counts;
    }

    @Transactional
    public Map<String, Object> updateStatus(UUID id, String requested, String reason, User user) {
        ShopOrder order = find(id);
        Status next;
        try {
            next = Status.valueOf(requested == null ? "" : requested.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown status: " + requested);
        }
        Status before = order.getStatus();
        if (!before.canMoveTo(next)) {
            throw new IllegalArgumentException("An order that is " + before.name().toLowerCase(Locale.ROOT)
                    + " can't be changed to " + next.name().toLowerCase(Locale.ROOT));
        }
        if (next == Status.CANCELLED) {
            if (!user.canManage()) throw new AccessDeniedException("Only a manager or admin can cancel an order");
            String why = optionalText(reason, 300, "Reason");
            order.setCancelReason(why);
            restoreStock(order);
        }
        if (next == Status.COMPLETED) {
            recordSale(order, user);
            order.setCompletedAt(LocalDateTime.now());
        }
        order.setStatus(next);
        order.setStatusUpdatedBy(user.getUsername());
        orderRepository.save(order);

        AuditLog entry = AuditLog.updateEvent(user, AuditLog.EntityType.RESOURCE, order.getId(),
                "{\"status\":\"" + before + "\"}", "{\"status\":\"" + next + "\"}");
        entry.setDescription("Online order " + order.getOrderNumber() + ": " + before + " to " + next);
        auditLogRepository.save(entry);
        return toAdmin(order);
    }

    @Transactional
    public Map<String, Object> updateNotes(UUID id, String notes) {
        ShopOrder order = find(id);
        order.setInternalNotes(optionalText(notes, 2000, "Notes"));
        return toAdmin(orderRepository.save(order));
    }

    // ===================== helpers =====================

    private ShopOrder find(UUID id) {
        return orderRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Order not found"));
    }

    private void restoreStock(ShopOrder order) {
        for (ShopOrderLine line : order.getLines()) {
            if (ShopCatalogService.FURNITURE.equals(line.getProductType())) {
                furnitureItemRepository.addStock(line.getProductId(), line.getQuantity());
            } else {
                beekeepingProductRepository.addStock(line.getProductId(), line.getQuantity());
            }
        }
    }

    /** One sale per business unit, so furniture and honey each land in their own books. Stock was already held. */
    private void recordSale(ShopOrder order, User user) {
        Map<String, List<ShopOrderLine>> byBusiness = new LinkedHashMap<>();
        for (ShopOrderLine line : order.getLines()) {
            String business = ShopCatalogService.FURNITURE.equals(line.getProductType())
                    ? BusinessUnit.CODE_FURNITURE : BusinessUnit.CODE_BEEKEEPING;
            byBusiness.computeIfAbsent(business, k -> new ArrayList<>()).add(line);
        }
        boolean feeBooked = false;
        for (Map.Entry<String, List<ShopOrderLine>> group : byBusiness.entrySet()) {
            BigDecimal amount = group.getValue().stream().map(ShopOrderLine::getLineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            Map<String, Object> fields = new LinkedHashMap<>();
            fields.put("customerName", order.getCustomerName());
            fields.put("customerPhone", order.getCustomerPhone());
            fields.put("paymentMethod", "CASH");
            fields.put("items", group.getValue().stream().map(l -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("itemId", l.getProductId().toString());
                item.put("itemName", l.getProductName());
                item.put("quantity", l.getQuantity());
                item.put("unitPrice", l.getUnitPrice());
                item.put("total", l.getLineTotal());
                return item;
            }).collect(Collectors.toList()));
            // The furniture books ask for these two on every entry.
            fields.put("itemName", group.getValue().get(0).getProductName()
                    + (group.getValue().size() > 1 ? " +" + (group.getValue().size() - 1) : ""));
            fields.put("quantity", group.getValue().stream().mapToInt(ShopOrderLine::getQuantity).sum());
            if (!feeBooked && order.getDeliveryFee().signum() > 0) {
                amount = amount.add(order.getDeliveryFee());
                fields.put("deliveryFee", order.getDeliveryFee());
                feeBooked = true;
            }
            TransactionRequest request = new TransactionRequest();
            request.setBusinessCode(group.getKey());
            request.setTransactionType("SALE");
            request.setAmount(amount);
            request.setNotes("Online order " + order.getOrderNumber());
            request.setReferenceNumber(order.getOrderNumber());
            request.setCustomFields(fields);
            transactionService.createForOnlineOrder(request, user, order.getOrderNumber());
        }
    }

    private BigDecimal deliveryFee(BigDecimal subtotal) {
        Map<String, Object> shop = siteContentService.get("shop");
        BigDecimal fee = number(shop.get("deliveryFee"));
        BigDecimal freeOver = number(shop.get("freeDeliveryOver"));
        if (fee == null || fee.signum() <= 0) return BigDecimal.ZERO;
        if (freeOver != null && freeOver.signum() > 0 && subtotal.compareTo(freeOver) >= 0) return BigDecimal.ZERO;
        return fee.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal number(Object v) {
        if (v == null) return null;
        try {
            return new BigDecimal(v.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Map<String, Integer> mergeItems(List<Item> items) {
        if (items == null || items.isEmpty()) throw new IllegalArgumentException("Your cart is empty");
        Map<String, Integer> merged = new LinkedHashMap<>();
        for (Item item : items) {
            if (item == null || item.slug() == null || item.slug().isBlank()) throw new IllegalArgumentException("A product in your cart is not valid");
            int qty = item.quantity() == null ? 0 : item.quantity();
            if (qty < 1) throw new IllegalArgumentException("Quantity must be at least 1");
            merged.merge(item.slug().trim(), qty, Integer::sum);
        }
        if (merged.size() > MAX_LINES) throw new IllegalArgumentException("Too many different products in one order");
        if (merged.values().stream().anyMatch(q -> q > MAX_QTY_PER_LINE)) {
            throw new IllegalArgumentException("For more than " + MAX_QTY_PER_LINE + " of one product, please call us");
        }
        return merged;
    }

    private Fulfilment parseFulfilment(String raw) {
        if (raw == null || raw.isBlank()) return Fulfilment.DELIVERY;
        try {
            return Fulfilment.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Choose delivery or pickup");
        }
    }

    static String normalizePhone(String raw) {
        String cleaned = raw == null ? "" : raw.replaceAll("[\\s\\-().]", "");
        if (!PHONE.matcher(cleaned).matches()) throw new IllegalArgumentException("Enter a valid phone number");
        return cleaned;
    }

    /** Compares the last 9 digits, so "+977 98…" and "98…" count as the same number. */
    static boolean samePhone(String stored, String given) {
        String a = stored.replaceAll("\\D", "");
        String b = given.replaceAll("\\D", "");
        if (a.length() < 7 || b.length() < 7) return false;
        int n = Math.min(9, Math.min(a.length(), b.length()));
        return a.substring(a.length() - n).equals(b.substring(b.length() - n));
    }

    private String newOrderNumber() {
        String date = DateTimeFormatter.ofPattern("yyMMdd").format(LocalDateTime.now(KATHMANDU));
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder("SV-").append(date).append('-');
            for (int i = 0; i < 4; i++) sb.append(ORDER_ALPHABET.charAt(RANDOM.nextInt(ORDER_ALPHABET.length())));
            String candidate = sb.toString();
            if (!orderRepository.existsByOrderNumber(candidate)) return candidate;
        }
        throw new IllegalStateException("Could not create an order number");
    }

    private static String requireText(String value, int min, int max, String label) {
        String s = value == null ? "" : value.trim().replaceAll("[\\p{Cntrl}]", " ");
        if (s.length() < min) throw new IllegalArgumentException(label + " is required");
        if (s.length() > max) throw new IllegalArgumentException(label + " is too long");
        return s;
    }

    private static String optionalText(String value, int max, String label) {
        if (value == null) return null;
        String s = value.trim().replaceAll("[\\p{Cntrl}&&[^\\n]]", " ");
        if (s.isEmpty()) return null;
        if (s.length() > max) throw new IllegalArgumentException(label + " is too long");
        return s;
    }

    // ===================== shaping =====================

    /** What the customer sees: no internal notes, no database ids, phone shown only in part. */
    Map<String, Object> toPublic(ShopOrder o) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("orderNumber", o.getOrderNumber());
        m.put("status", o.getStatus().name());
        m.put("fulfilment", o.getFulfilment().name());
        m.put("paymentMethod", o.getPaymentMethod().name());
        m.put("customerName", o.getCustomerName());
        m.put("customerPhone", maskPhone(o.getCustomerPhone()));
        m.put("subtotal", o.getSubtotal());
        m.put("deliveryFee", o.getDeliveryFee());
        m.put("total", o.getTotal());
        m.put("createdAt", o.getCreatedAt());
        m.put("items", o.getLines().stream().map(l -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("slug", l.getProductSlug());
            item.put("name", l.getProductName());
            item.put("quantity", l.getQuantity());
            item.put("unitPrice", l.getUnitPrice());
            item.put("lineTotal", l.getLineTotal());
            return item;
        }).toList());
        return m;
    }

    Map<String, Object> toAdmin(ShopOrder o) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", o.getId().toString());
        m.put("orderNumber", o.getOrderNumber());
        m.put("status", o.getStatus().name());
        m.put("customerName", o.getCustomerName());
        m.put("customerPhone", o.getCustomerPhone());
        m.put("customerEmail", o.getCustomerEmail());
        m.put("fulfilment", o.getFulfilment().name());
        m.put("addressLine", o.getAddressLine());
        m.put("city", o.getCity());
        m.put("landmark", o.getLandmark());
        m.put("paymentMethod", o.getPaymentMethod().name());
        m.put("customerNotes", o.getCustomerNotes());
        m.put("internalNotes", o.getInternalNotes());
        m.put("subtotal", o.getSubtotal());
        m.put("deliveryFee", o.getDeliveryFee());
        m.put("total", o.getTotal());
        m.put("cancelReason", o.getCancelReason());
        m.put("statusUpdatedBy", o.getStatusUpdatedBy());
        m.put("completedAt", o.getCompletedAt());
        m.put("createdAt", o.getCreatedAt());
        m.put("itemCount", o.getLines().stream().mapToInt(ShopOrderLine::getQuantity).sum());
        m.put("items", o.getLines().stream().map(l -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("productType", l.getProductType());
            item.put("name", l.getProductName());
            item.put("slug", l.getProductSlug());
            item.put("quantity", l.getQuantity());
            item.put("unitPrice", l.getUnitPrice());
            item.put("lineTotal", l.getLineTotal());
            return item;
        }).toList());
        return m;
    }

    static String maskPhone(String phone) {
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() <= 4) return "****";
        return "*".repeat(digits.length() - 3) + digits.substring(digits.length() - 3);
    }
}

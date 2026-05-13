package com.samjhana.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.FurnitureCustomer;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.FurnitureItem.FurnitureCategory;
import com.samjhana.entity.Transaction;
import com.samjhana.exception.ResourceNotFoundException;
import com.samjhana.repository.FurnitureCustomerRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FurnitureService {

    private final FurnitureCustomerRepository customerRepository;
    private final FurnitureItemRepository itemRepository;
    private final TransactionRepository transactionRepository;
    private final ObjectMapper objectMapper;

    // ===================== DASHBOARD =====================

    public Map<String, Object> getDashboard() {
        List<FurnitureItem> allItems = itemRepository.findByIsActiveTrueOrderByNameAsc();

        BigDecimal totalStockValue = allItems.stream()
                .filter(i -> i.getSellingPrice() != null)
                .map(i -> i.getSellingPrice().multiply(BigDecimal.valueOf(i.getStockQty())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<FurnitureItem> lowStockItems = allItems.stream()
                .filter(i -> i.getStockQty() <= i.getReorderLevel())
                .collect(Collectors.toList());

        List<Transaction> allFurnitureTransactions = transactionRepository
                .findByBusinessCodeOrderByTransactionDateDesc("furniture");

        List<Transaction> todayTransactions = allFurnitureTransactions.stream()
                .filter(t -> t.getTransactionDate().equals(LocalDate.now()))
                .filter(t -> t.getTransactionType() == Transaction.TransactionType.SALE)
                .collect(Collectors.toList());

        BigDecimal todayRevenue = todayTransactions.stream()
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long pendingDeliveries = allFurnitureTransactions.stream()
                .filter(t -> {
                    Map<String, Object> cf = parseCustomFields(t.getCustomFields());
                    String status = (String) cf.get("deliveryStatus");
                    return status != null && !status.equals("DELIVERED");
                })
                .count();

        List<Map<String, Object>> recentOrders = allFurnitureTransactions.stream()
                .limit(5)
                .map(this::transactionToOrderMap)
                .collect(Collectors.toList());

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("totalItems", allItems.size());
        dashboard.put("totalStockValue", totalStockValue);
        dashboard.put("lowStockCount", lowStockItems.size());
        dashboard.put("lowStockItems", lowStockItems.stream().map(this::itemToMap).collect(Collectors.toList()));
        dashboard.put("todaySalesCount", todayTransactions.size());
        dashboard.put("todayRevenue", todayRevenue);
        dashboard.put("pendingDeliveries", pendingDeliveries);
        dashboard.put("recentOrders", recentOrders);
        return dashboard;
    }

    // ===================== CUSTOMERS =====================

    public List<Map<String, Object>> listCustomers(String search) {
        List<FurnitureCustomer> customers;
        if (search != null && !search.isBlank()) {
            customers = customerRepository.findByIsActiveTrueOrderByNameAsc().stream()
                    .filter(c -> c.getName().toLowerCase().contains(search.toLowerCase())
                            || (c.getPhone() != null && c.getPhone().contains(search)))
                    .collect(Collectors.toList());
        } else {
            customers = customerRepository.findByIsActiveTrueOrderByNameAsc();
        }

        List<Transaction> furnitureTransactions = transactionRepository
                .findByBusinessCodeOrderByTransactionDateDesc("furniture");

        return customers.stream().map(c -> {
            Map<String, Object> map = customerToMap(c);
            List<Transaction> customerTxns = furnitureTransactions.stream()
                    .filter(t -> {
                        Map<String, Object> cf = parseCustomFields(t.getCustomFields());
                        String custId = cf.get("customerId") != null ? cf.get("customerId").toString() : null;
                        return c.getId().toString().equals(custId);
                    })
                    .collect(Collectors.toList());
            map.put("totalPurchases", customerTxns.size());
            map.put("totalAmount", customerTxns.stream()
                    .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> createCustomer(Map<String, String> request) {
        String name = request.get("name");
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Customer name is required");
        }
        FurnitureCustomer customer = FurnitureCustomer.builder()
                .name(name.trim())
                .nameNepali(request.get("nameNepali"))
                .phone(request.get("phone"))
                .address(request.get("address"))
                .notes(request.get("notes"))
                .isActive(true)
                .build();
        return customerToMap(customerRepository.save(customer));
    }

    @Transactional
    public Map<String, Object> updateCustomer(UUID id, Map<String, String> request) {
        FurnitureCustomer customer = customerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + id));
        if (request.containsKey("name") && request.get("name") != null) customer.setName(request.get("name").trim());
        if (request.containsKey("nameNepali")) customer.setNameNepali(request.get("nameNepali"));
        if (request.containsKey("phone")) customer.setPhone(request.get("phone"));
        if (request.containsKey("address")) customer.setAddress(request.get("address"));
        if (request.containsKey("notes")) customer.setNotes(request.get("notes"));
        return customerToMap(customerRepository.save(customer));
    }

    @Transactional
    public void deleteCustomer(UUID id) {
        FurnitureCustomer customer = customerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + id));
        customer.setIsActive(false);
        customerRepository.save(customer);
    }

    // ===================== INVENTORY =====================

    public List<Map<String, Object>> listItems(String category, String search) {
        List<FurnitureItem> items;
        if (category != null && !category.isBlank() && !category.equalsIgnoreCase("ALL")) {
            try {
                FurnitureCategory cat = FurnitureCategory.valueOf(category.toUpperCase());
                items = itemRepository.findByCategoryAndIsActiveTrue(cat);
            } catch (IllegalArgumentException e) {
                items = itemRepository.findByIsActiveTrueOrderByNameAsc();
            }
        } else {
            items = itemRepository.findByIsActiveTrueOrderByNameAsc();
        }
        if (search != null && !search.isBlank()) {
            String s = search.toLowerCase();
            items = items.stream()
                    .filter(i -> i.getName().toLowerCase().contains(s)
                            || (i.getSku() != null && i.getSku().toLowerCase().contains(s)))
                    .collect(Collectors.toList());
        }
        return items.stream().map(this::itemToMap).collect(Collectors.toList());
    }

    public Map<String, Object> getItem(UUID id) {
        FurnitureItem item = itemRepository.findById(id)
                .filter(FurnitureItem::getIsActive)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + id));
        return itemToMap(item);
    }

    @Transactional
    public Map<String, Object> createItem(Map<String, Object> request) {
        String name = (String) request.get("name");
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Item name is required");
        }
        String sku = (String) request.get("sku");
        if (sku == null || sku.trim().isEmpty()) {
            sku = "FRN-" + System.currentTimeMillis() % 100000;
        }
        FurnitureCategory category;
        try {
            category = FurnitureCategory.valueOf(((String) request.getOrDefault("category", "OTHER")).toUpperCase());
        } catch (IllegalArgumentException e) {
            category = FurnitureCategory.OTHER;
        }
        FurnitureItem item = FurnitureItem.builder()
                .name(name.trim())
                .nameNepali((String) request.get("nameNepali"))
                .sku(sku.trim())
                .category(category)
                .purchasePrice(toBigDecimal(request.get("purchasePrice")))
                .sellingPrice(toBigDecimal(request.get("sellingPrice")))
                .stockQty(toInt(request.get("stockQty"), 0))
                .reorderLevel(toInt(request.get("reorderLevel"), 2))
                .description((String) request.get("description"))
                .isActive(true)
                .build();
        return itemToMap(itemRepository.save(item));
    }

    @Transactional
    public Map<String, Object> updateItem(UUID id, Map<String, Object> request) {
        FurnitureItem item = itemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + id));
        if (request.containsKey("name")) item.setName(((String) request.get("name")).trim());
        if (request.containsKey("nameNepali")) item.setNameNepali((String) request.get("nameNepali"));
        if (request.containsKey("category")) {
            try {
                item.setCategory(FurnitureCategory.valueOf(((String) request.get("category")).toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }
        if (request.containsKey("purchasePrice")) item.setPurchasePrice(toBigDecimal(request.get("purchasePrice")));
        if (request.containsKey("sellingPrice")) item.setSellingPrice(toBigDecimal(request.get("sellingPrice")));
        if (request.containsKey("stockQty")) item.setStockQty(toInt(request.get("stockQty"), item.getStockQty()));
        if (request.containsKey("reorderLevel")) item.setReorderLevel(toInt(request.get("reorderLevel"), item.getReorderLevel()));
        if (request.containsKey("description")) item.setDescription((String) request.get("description"));
        return itemToMap(itemRepository.save(item));
    }

    @Transactional
    public void deleteItem(UUID id) {
        FurnitureItem item = itemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + id));
        item.setIsActive(false);
        itemRepository.save(item);
    }

    @Transactional
    public Map<String, Object> adjustStock(UUID id, int adjustment) {
        FurnitureItem item = itemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + id));
        int newQty = Math.max(0, item.getStockQty() + adjustment);
        item.setStockQty(newQty);
        return itemToMap(itemRepository.save(item));
    }

    // ===================== ORDERS =====================

    public List<Map<String, Object>> listOrders(String status, String search) {
        List<Map<String, Object>> orders = transactionRepository
                .findByBusinessCodeOrderByTransactionDateDesc("furniture")
                .stream()
                .map(this::transactionToOrderMap)
                .collect(Collectors.toList());

        if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
            orders = orders.stream()
                    .filter(o -> status.equalsIgnoreCase((String) o.get("deliveryStatus")))
                    .collect(Collectors.toList());
        }
        if (search != null && !search.isBlank()) {
            String s = search.toLowerCase();
            orders = orders.stream()
                    .filter(o -> {
                        String customerName = (String) o.get("customerName");
                        return customerName != null && customerName.toLowerCase().contains(s);
                    })
                    .collect(Collectors.toList());
        }
        return orders;
    }

    @Transactional
    public Map<String, Object> updateDeliveryStatus(UUID id, String newStatus) {
        Transaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + id));
        if (newStatus == null) throw new IllegalArgumentException("deliveryStatus is required");

        Map<String, Object> customFields = parseCustomFields(transaction.getCustomFields());
        customFields.put("deliveryStatus", newStatus);
        try {
            transaction.setCustomFields(objectMapper.writeValueAsString(customFields));
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to update status");
        }
        return transactionToOrderMap(transactionRepository.save(transaction));
    }

    // ===================== HELPERS =====================

    public Map<String, Object> customerToMap(FurnitureCustomer c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId().toString());
        map.put("name", c.getName());
        map.put("nameNepali", c.getNameNepali());
        map.put("phone", c.getPhone());
        map.put("address", c.getAddress());
        map.put("notes", c.getNotes());
        map.put("isActive", c.getIsActive());
        map.put("createdAt", c.getCreatedAt());
        return map;
    }

    public Map<String, Object> itemToMap(FurnitureItem i) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", i.getId().toString());
        map.put("name", i.getName());
        map.put("nameNepali", i.getNameNepali());
        map.put("sku", i.getSku());
        map.put("category", i.getCategory().name());
        map.put("purchasePrice", i.getPurchasePrice());
        map.put("sellingPrice", i.getSellingPrice());
        map.put("stockQty", i.getStockQty());
        map.put("reorderLevel", i.getReorderLevel());
        map.put("description", i.getDescription());
        map.put("isActive", i.getIsActive());
        map.put("createdAt", i.getCreatedAt());
        return map;
    }

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
        map.put("customerId", cf.get("customerId"));
        map.put("deliveryStatus", cf.getOrDefault("deliveryStatus", "PENDING"));
        map.put("deliveryDate", cf.get("deliveryDate"));
        map.put("deliveryAddress", cf.get("deliveryAddress"));
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

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return null;
        if (value instanceof Number) return BigDecimal.valueOf(((Number) value).doubleValue());
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private int toInt(Object value, int defaultValue) {
        if (value == null) return defaultValue;
        if (value instanceof Number) return ((Number) value).intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}
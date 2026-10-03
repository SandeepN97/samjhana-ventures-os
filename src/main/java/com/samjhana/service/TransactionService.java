package com.samjhana.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionRequest;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.BusinessUnit;
import com.samjhana.entity.FurnitureItem;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.exception.BusinessUnitNotFoundException;
import com.samjhana.exception.DayAlreadyClosedException;
import com.samjhana.exception.TransactionNotFoundException;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.BusinessUnitRepository;
import com.samjhana.repository.DailyReportRepository;
import com.samjhana.repository.FurnitureItemRepository;
import com.samjhana.repository.SystemSettingRepository;
import com.samjhana.repository.TransactionRepository;
import com.samjhana.strategy.BusinessCalculationStrategy.ValidationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final FurnitureItemRepository furnitureItemRepository;
    private final AuditLogRepository auditLogRepository;
    private final CalculationEngine calculationEngine;
    private final ObjectMapper objectMapper;
    private final DailyReportRepository dailyReportRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final BeekeepingService beekeepingService;

    private static final ZoneId KATHMANDU = ZoneId.of("Asia/Kathmandu");

    /**
     * Today in Nepal, or tomorrow once today has been closed: entries made after the day is closed
     * belong to the next day (the same rule as the admin app's business date).
     */
    public LocalDate currentBusinessDate() {
        LocalDate today = LocalDate.now(KATHMANDU);
        return dailyReportRepository.findByReportDate(today).isPresent() ? today.plusDays(1) : today;
    }

    /** Custom field only {@link #createForOnlineOrder} may set: it marks a sale whose stock was already held back at checkout. */
    public static final String ONLINE_ORDER_FIELD = "onlineOrderNumber";

    @Transactional
    public TransactionResponse create(TransactionRequest request, User user) {
        if (request.getCustomFields() != null && request.getCustomFields().containsKey(ONLINE_ORDER_FIELD)) {
            throw new IllegalArgumentException("'" + ONLINE_ORDER_FIELD + "' is reserved for online orders");
        }
        return createInternal(request, user, false);
    }

    /**
     * Records the sale for an online order that staff completed. Stock was already taken when the customer
     * ordered, so it is not taken again here. Only the online-order code calls this; a normal request that
     * tries to claim "already reserved" is refused above.
     */
    @Transactional
    public TransactionResponse createForOnlineOrder(TransactionRequest request, User user, String orderNumber) {
        Map<String, Object> fields = new LinkedHashMap<>(request.getCustomFields() == null ? Map.of() : request.getCustomFields());
        fields.put(ONLINE_ORDER_FIELD, orderNumber);
        request.setCustomFields(fields);
        return createInternal(request, user, true);
    }

    private TransactionResponse createInternal(TransactionRequest request, User user, boolean stockAlreadyHeld) {
        BusinessUnit business = businessUnitRepository.findByCode(request.getBusinessCode())
                .orElseThrow(() -> new BusinessUnitNotFoundException(request.getBusinessCode()));

        if (request.getAmount() == null || request.getAmount().signum() <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }
        LocalDate date = request.getTransactionDate() != null ? request.getTransactionDate() : currentBusinessDate();
        if (date.isAfter(LocalDate.now(KATHMANDU).plusDays(1))) {
            throw new IllegalArgumentException("Transaction date cannot be in the future");
        }
        // Once a day is closed its totals are final. Staff can't add to it afterwards; a manager
        // correcting a closed day still can (and the audit log records who).
        if (!user.canManage() && dailyReportRepository.findByReportDate(date).isPresent()) {
            throw new DayAlreadyClosedException(date.toString());
        }

        Map<String, Object> customFields = null;
        if (request.getCustomFields() != null) {
            ValidationResult validation = calculationEngine.validate(
                    request.getBusinessCode(), request.getCustomFields());
            if (!validation.isValid()) {
                throw new IllegalArgumentException("Validation failed: " + validation.errors());
            }
            customFields = new LinkedHashMap<>(request.getCustomFields());
            // Cost and profit are worked out here, not taken from staff devices.
            if (!user.canManage()) {
                customFields.keySet().removeAll(TransactionVisibility.COST_FIELDS);
            }
            addServerSideCost(business.getCode(), request.getTransactionType(), request.getAmount(), customFields);
        }

        String customFieldsJson;
        try {
            customFieldsJson = objectMapper.writeValueAsString(customFields);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid custom fields");
        }

        // Beekeeping stock moves in this same transaction, before the sale is saved: a line the shop
        // can't cover fails the whole sale and nothing is changed.
        if (!stockAlreadyHeld && BusinessUnit.CODE_BEEKEEPING.equalsIgnoreCase(request.getBusinessCode()) && customFields != null) {
            beekeepingService.applyStock(customFields, request.getTransactionType());
        }

        Transaction transaction = Transaction.builder()
                .business(business)
                .enteredBy(user)
                .transactionType(Transaction.TransactionType.valueOf(request.getTransactionType()))
                .transactionDate(date)
                .amount(request.getAmount())
                .notes(request.getNotes())
                .referenceNumber(request.getReferenceNumber())
                .customFields(customFieldsJson)
                .status(Transaction.TransactionStatus.APPROVED)
                .build();

        Transaction saved = transactionRepository.save(transaction);

        auditLogRepository.save(AuditLog.createEvent(user, AuditLog.EntityType.TRANSACTION,
                saved.getId(), customFieldsJson));

        if (!stockAlreadyHeld && "furniture".equalsIgnoreCase(request.getBusinessCode()) && request.getCustomFields() != null) {
            adjustFurnitureStock(request.getCustomFields(), request.getTransactionType());
        }

        return TransactionVisibility.toResponse(saved, user, objectMapper);
    }

    /**
     * Fills in cost figures the server can work out itself, when they aren't already there:
     * <ul>
     *   <li>petrol/diesel sale: what the pump last paid per litre for that fuel ({@code purchaseRate});</li>
     *   <li>EV sale: the NEA electricity cost of the energy sold, and the profit on it.</li>
     * </ul>
     */
    private void addServerSideCost(String businessCode, String transactionType, BigDecimal amount,
                                   Map<String, Object> fields) {
        if (!Transaction.TransactionType.SALE.name().equals(transactionType)) return;

        if ("petrol".equalsIgnoreCase(businessCode) && fields.get("purchaseRate") == null) {
            Object fuelType = fields.get("fuelType");
            if (fuelType != null) {
                latestPurchaseRate(fuelType.toString()).ifPresent(rate -> fields.put("purchaseRate", rate));
            }
        }

        if (BusinessUnit.CODE_BEEKEEPING.equalsIgnoreCase(businessCode)) {
            // Always the server's figures, never a staff device's: cost is what the goods cost the shop.
            fields.keySet().removeAll(TransactionVisibility.COST_FIELDS);
            beekeepingService.costOfLines(fields).ifPresent(cost -> {
                BigDecimal profit = amount.subtract(cost);
                fields.put("costPrice", cost);
                fields.put("profit", profit);
                fields.put("profitMargin", amount.signum() > 0
                        ? profit.multiply(BigDecimal.valueOf(100)).divide(amount, 1, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO);
            });
        }

        if ("ev".equalsIgnoreCase(businessCode) && fields.get("neaCost") == null) {
            BigDecimal kwh = firstNumber(fields, "estimatedKwh", "energyDeliveredKwh", "kWh", "unitsCharged");
            BigDecimal neaRate = systemSettingRepository.findById("nea_rate")
                    .map(setting -> toNumber(setting.getSettingValue())).orElse(null);
            if (kwh != null && kwh.signum() > 0 && neaRate != null && neaRate.signum() > 0) {
                BigDecimal neaCost = kwh.multiply(neaRate).setScale(2, RoundingMode.HALF_UP);
                BigDecimal profit = amount.subtract(neaCost);
                fields.put("neaRatePerUnit", neaRate);
                fields.put("neaCost", neaCost);
                fields.put("profit", profit);
                fields.put("profitMargin", profit.multiply(BigDecimal.valueOf(100))
                        .divide(amount, 1, RoundingMode.HALF_UP));
            }
        }
    }

    private java.util.Optional<BigDecimal> latestPurchaseRate(String fuelType) {
        return transactionRepository.findByBusinessCodeOrderByTransactionDateDesc("petrol").stream()
                .filter(t -> t.getTransactionType() == Transaction.TransactionType.PURCHASE)
                .filter(t -> t.getStatus() != Transaction.TransactionStatus.REJECTED)
                .map(t -> readFields(t.getCustomFields()))
                .filter(cf -> fuelType.equalsIgnoreCase(String.valueOf(cf.get("fuelType"))))
                .map(cf -> toNumber(cf.get("ratePerLiter")))
                .filter(rate -> rate != null && rate.signum() > 0)
                .findFirst();
    }

    private Map<String, Object> readFields(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            Map<String, Object> fields = objectMapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<>() {});
            return fields == null ? Map.of() : fields;
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    private static BigDecimal firstNumber(Map<String, Object> fields, String... keys) {
        for (String key : keys) {
            BigDecimal value = toNumber(fields.get(key));
            if (value != null) return value;
        }
        return null;
    }

    private static BigDecimal toNumber(Object value) {
        if (value == null) return null;
        try {
            return new BigDecimal(value.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Every transaction the viewer may see, loans hidden from staff and cost stripped for them. */
    public List<TransactionResponse> list(String businessCode, User viewer) {
        List<Transaction> transactions;
        if (businessCode != null && !businessCode.isBlank()) {
            transactions = transactionRepository.findByBusinessCodeOrderByTransactionDateDesc(businessCode);
        } else {
            transactions = transactionRepository.findAllWithDetails();
        }
        return transactions.stream()
                .filter(t -> TransactionVisibility.canSee(t, viewer))
                .map(t -> TransactionVisibility.toResponse(t, viewer, objectMapper))
                .toList();
    }

    public TransactionResponse get(UUID id, User viewer) {
        return transactionRepository.findById(id)
                .filter(t -> TransactionVisibility.canSee(t, viewer))   // 404, not 403: don't confirm it exists
                .map(t -> TransactionVisibility.toResponse(t, viewer, objectMapper))
                .orElseThrow(() -> new TransactionNotFoundException(id.toString()));
    }

    @Transactional
    public TransactionResponse update(UUID id, TransactionRequest request, User user) {
        Transaction t = transactionRepository.findById(id)
                .orElseThrow(() -> new TransactionNotFoundException(id.toString()));

        String oldValues = t.getCustomFields();

        // Server-side validation on updated custom fields
        if (request.getCustomFields() != null) {
            ValidationResult validation = calculationEngine.validate(
                    t.getBusiness().getCode(), request.getCustomFields());
            if (!validation.isValid()) {
                throw new IllegalArgumentException("Validation failed: " + validation.errors());
            }
        }

        if (request.getAmount() != null) t.setAmount(request.getAmount());
        if (request.getTransactionType() != null) {
            t.setTransactionType(Transaction.TransactionType.valueOf(request.getTransactionType()));
        }
        if (request.getNotes() != null) t.setNotes(request.getNotes());
        if (request.getReferenceNumber() != null) t.setReferenceNumber(request.getReferenceNumber());
        if (request.getTransactionDate() != null) t.setTransactionDate(request.getTransactionDate());
        if (request.getCustomFields() != null) {
            try {
                t.setCustomFields(objectMapper.writeValueAsString(request.getCustomFields()));
            } catch (JsonProcessingException ignored) {}
        }
        t.setReviewedBy(user);
        t.setReviewedAt(LocalDateTime.now());

        Transaction saved = transactionRepository.save(t);

        auditLogRepository.save(AuditLog.updateEvent(user, AuditLog.EntityType.TRANSACTION,
                saved.getId(), oldValues, saved.getCustomFields()));

        return TransactionResponse.from(saved);
    }

    @Transactional
    public TransactionResponse approve(UUID id, User user) {
        Transaction t = transactionRepository.findById(id)
                .orElseThrow(() -> new TransactionNotFoundException(id.toString()));
        t.setStatus(Transaction.TransactionStatus.APPROVED);
        t.setReviewedBy(user);
        t.setReviewedAt(LocalDateTime.now());
        Transaction saved = transactionRepository.save(t);

        auditLogRepository.save(AuditLog.approvalEvent(user, saved.getId(), "APPROVED"));

        return TransactionResponse.from(saved);
    }

    @Transactional
    public TransactionResponse reject(UUID id, String reason, User user) {
        Transaction t = transactionRepository.findById(id)
                .orElseThrow(() -> new TransactionNotFoundException(id.toString()));
        t.setStatus(Transaction.TransactionStatus.REJECTED);
        if (reason != null) t.setReviewNotes(reason);
        if (user != null) {
            t.setReviewedBy(user);
            t.setReviewedAt(LocalDateTime.now());
        }
        Transaction saved = transactionRepository.save(t);

        auditLogRepository.save(AuditLog.approvalEvent(user, saved.getId(), "REJECTED"));

        return TransactionResponse.from(saved);
    }

    @SuppressWarnings("unchecked")
    private void adjustFurnitureStock(Map<String, Object> customFields, String transactionType) {
        Object itemsObj = customFields.get("items");
        if (!(itemsObj instanceof List)) return;

        List<Map<String, Object>> items = (List<Map<String, Object>>) itemsObj;
        boolean isSale = "SALE".equalsIgnoreCase(transactionType);

        for (Map<String, Object> lineItem : items) {
            String itemId = lineItem.get("itemId") != null ? lineItem.get("itemId").toString() : null;
            if (itemId == null) continue;

            int qty = 1;
            if (lineItem.get("quantity") instanceof Number) {
                qty = ((Number) lineItem.get("quantity")).intValue();
            }

            try {
                FurnitureItem furnitureItem = furnitureItemRepository.findById(UUID.fromString(itemId)).orElse(null);
                if (furnitureItem != null) {
                    int newStock = isSale
                            ? Math.max(0, furnitureItem.getStockQty() - qty)
                            : furnitureItem.getStockQty() + qty;
                    furnitureItem.setStockQty(newStock);
                    furnitureItemRepository.save(furnitureItem);
                }
            } catch (IllegalArgumentException ignored) {}
        }
    }
}
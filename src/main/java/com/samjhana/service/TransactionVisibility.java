package com.samjhana.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;

import java.util.Map;
import java.util.Set;

/**
 * What a transaction looks like to the person asking. Admins and managers see everything. Staff:
 * <ul>
 *   <li>never see loan transactions (they can't create them either);</li>
 *   <li>never see cost or profit figures inside {@code customFields}: purchase rates and prices,
 *       NEA cost, profit, and the unit cost on purchase entries.</li>
 * </ul>
 * Every read path (list, single, day view) goes through here so a new endpoint can't forget it.
 */
public final class TransactionVisibility {

    static final Set<String> COST_FIELDS = Set.of(
            "purchaseRate", "purchasePrice", "costPrice", "profit", "profitMargin", "margin", "neaCost",
            "neaRatePerUnit", "wac");

    private TransactionVisibility() {}

    public static boolean canSee(Transaction t, User viewer) {
        return viewer != null && (viewer.canManage() || !isLoan(t));
    }

    public static TransactionResponse toResponse(Transaction t, User viewer, ObjectMapper objectMapper) {
        TransactionResponse response = TransactionResponse.from(t);
        if (viewer != null && viewer.canManage()) {
            return response;
        }
        response.setCustomFields(stripCost(response.getCustomFields(), t.getTransactionType(), objectMapper));
        return response;
    }

    static String stripCost(String customFieldsJson, Transaction.TransactionType type, ObjectMapper objectMapper) {
        if (customFieldsJson == null || customFieldsJson.isBlank() || "null".equals(customFieldsJson)) {
            return customFieldsJson;
        }
        try {
            Map<String, Object> fields = objectMapper.readValue(customFieldsJson, new TypeReference<>() {});
            fields.keySet().removeAll(COST_FIELDS);
            if (type == Transaction.TransactionType.PURCHASE) {
                fields.remove("ratePerLiter");   // on a fuel purchase this is what the pump paid per litre
            }
            return objectMapper.writeValueAsString(fields);
        } catch (JsonProcessingException e) {
            return null;   // unreadable: show nothing rather than risk showing cost
        }
    }

    private static boolean isLoan(Transaction t) {
        return t.getBusiness() != null && "loan".equalsIgnoreCase(t.getBusiness().getCode());
    }
}

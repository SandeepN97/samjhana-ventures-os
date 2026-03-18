package com.samjhana.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final TransactionRepository transactionRepository;
    private final ObjectMapper objectMapper;

    @GetMapping("/summary")
    public ResponseEntity<?> summary(
            @RequestParam(defaultValue = "week") String period,
            @AuthenticationPrincipal User user) {

        LocalDate today = LocalDate.now();
        LocalDate dateFrom;
        LocalDate dateTo = today;

        switch (period) {
            case "today":
                dateFrom = today;
                break;
            case "month":
                dateFrom = today.with(TemporalAdjusters.firstDayOfMonth());
                break;
            default: // week
                dateFrom = today.minusDays(6);
                break;
        }

        List<Transaction> allTransactions = transactionRepository.findByDateRangeWithDetails(dateFrom, dateTo);

        // Exclude REJECTED
        List<Transaction> transactions = allTransactions.stream()
                .filter(t -> t.getStatus() != Transaction.TransactionStatus.REJECTED)
                .toList();

        boolean canViewProfit = user != null && user.canManage();

        // Revenue types: SALE, INCOME, PAYMENT
        // Expense types: PURCHASE, EXPENSE, DISBURSEMENT
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalExpenses = BigDecimal.ZERO;
        int transactionCount = transactions.size();

        // Per-business accumulators
        String[] businessCodes = {"petrol", "ev", "furniture", "rental", "loan"};
        Map<String, BigDecimal> bizRevenue = new LinkedHashMap<>();
        Map<String, BigDecimal> bizExpenses = new LinkedHashMap<>();
        Map<String, Integer> bizCount = new LinkedHashMap<>();
        Map<String, BigDecimal> bizProfit = new LinkedHashMap<>();

        for (String code : businessCodes) {
            bizRevenue.put(code, BigDecimal.ZERO);
            bizExpenses.put(code, BigDecimal.ZERO);
            bizCount.put(code, 0);
            bizProfit.put(code, BigDecimal.ZERO);
        }

        // Loan portfolio tracking (ADMIN/SON only)
        BigDecimal loanTotalPrincipal = BigDecimal.ZERO;
        BigDecimal loanTotalAccruedInterest = BigDecimal.ZERO;
        BigDecimal loanTotalRepaid = BigDecimal.ZERO;
        int activeLoanCount = 0;

        for (Transaction t : transactions) {
            String code = t.getBusiness().getCode();
            BigDecimal amount = t.getAmount() != null ? t.getAmount() : BigDecimal.ZERO;
            Transaction.TransactionType type = t.getTransactionType();

            bizCount.merge(code, 1, Integer::sum);

            boolean isRevenue = (type == Transaction.TransactionType.SALE ||
                    type == Transaction.TransactionType.INCOME ||
                    type == Transaction.TransactionType.PAYMENT);
            boolean isExpense = (type == Transaction.TransactionType.PURCHASE ||
                    type == Transaction.TransactionType.EXPENSE ||
                    type == Transaction.TransactionType.DISBURSEMENT);

            if (isRevenue) {
                bizRevenue.merge(code, amount, BigDecimal::add);
                totalRevenue = totalRevenue.add(amount);
            } else if (isExpense) {
                bizExpenses.merge(code, amount, BigDecimal::add);
                totalExpenses = totalExpenses.add(amount);
            }

            // Per-business profit calculation (only computed, aggregated later)
            if (canViewProfit) {
                Map<String, Object> cf = parseCustomFields(t.getCustomFields());
                BigDecimal profit = calculateProfit(code, type, amount, cf);
                if (profit != null) {
                    bizProfit.merge(code, profit, BigDecimal::add);
                }
            }
        }

        // Loan portfolio: query all-time DISBURSEMENT transactions for loans (ADMIN/SON only)
        if (canViewProfit) {
            List<Transaction> allLoanTxns = transactionRepository.findByDateRangeWithDetails(
                    LocalDate.of(2000, 1, 1), today);

            List<Transaction> loanTxns = allLoanTxns.stream()
                    .filter(t -> t.getStatus() != Transaction.TransactionStatus.REJECTED)
                    .filter(t -> "loan".equals(t.getBusiness().getCode()))
                    .toList();

            List<Transaction> disbursements = loanTxns.stream()
                    .filter(t -> t.getTransactionType() == Transaction.TransactionType.DISBURSEMENT)
                    .toList();

            List<Transaction> repayments = loanTxns.stream()
                    .filter(t -> t.getTransactionType() == Transaction.TransactionType.PAYMENT)
                    .toList();

            for (Transaction d : disbursements) {
                Map<String, Object> cf = parseCustomFields(d.getCustomFields());
                BigDecimal principal = toBigDecimal(cf.get("principal"));
                if (principal == null || principal.compareTo(BigDecimal.ZERO) <= 0) {
                    principal = d.getAmount() != null ? d.getAmount() : BigDecimal.ZERO;
                }
                loanTotalPrincipal = loanTotalPrincipal.add(principal);
                activeLoanCount++;

                // Accrued interest: principal * (rate/100/365) * daysSinceStart
                BigDecimal rate = toBigDecimal(cf.get("interestRate"));
                if (rate == null) rate = BigDecimal.ZERO;
                String startDateStr = cf.get("startDate") != null ? cf.get("startDate").toString() : null;
                LocalDate startDate = d.getTransactionDate();
                if (startDateStr != null) {
                    try { startDate = LocalDate.parse(startDateStr); } catch (Exception ignored) {}
                }
                long days = Math.max(0, today.toEpochDay() - startDate.toEpochDay());
                if (rate.compareTo(BigDecimal.ZERO) > 0 && days > 0) {
                    BigDecimal interest = principal
                            .multiply(rate)
                            .divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP)
                            .divide(BigDecimal.valueOf(365), 10, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(days))
                            .setScale(2, RoundingMode.HALF_UP);
                    loanTotalAccruedInterest = loanTotalAccruedInterest.add(interest);
                }

                // Match repayments by borrowerName
                String borrowerName = cf.get("borrowerName") != null ? cf.get("borrowerName").toString() : null;
                for (Transaction r : repayments) {
                    Map<String, Object> rcf = parseCustomFields(r.getCustomFields());
                    String rBorrower = rcf.get("borrowerName") != null ? rcf.get("borrowerName").toString() : null;
                    if (borrowerName != null && borrowerName.equals(rBorrower)) {
                        BigDecimal repaid = r.getAmount() != null ? r.getAmount() : BigDecimal.ZERO;
                        loanTotalRepaid = loanTotalRepaid.add(repaid);
                    }
                }
            }
        }

        // Rental health from PAYMENT transactions (simple: count unique rooms with active status)
        // Since there's no RentalProperty table, derive from transaction customFields
        List<Transaction> rentalPayments = transactions.stream()
                .filter(t -> "rental".equals(t.getBusiness().getCode()))
                .filter(t -> t.getTransactionType() == Transaction.TransactionType.PAYMENT ||
                             t.getTransactionType() == Transaction.TransactionType.SALE ||
                             t.getTransactionType() == Transaction.TransactionType.INCOME)
                .toList();

        // For rental health, look at all rental transactions ever (not just period)
        List<Transaction> allRentalEver = transactionRepository.findByDateRangeWithDetails(
                LocalDate.of(2000, 1, 1), today).stream()
                .filter(t -> t.getStatus() != Transaction.TransactionStatus.REJECTED)
                .filter(t -> "rental".equals(t.getBusiness().getCode()))
                .toList();

        // Count distinct rooms seen
        long totalRoomCount = allRentalEver.stream()
                .map(t -> {
                    Map<String, Object> cf = parseCustomFields(t.getCustomFields());
                    return cf.get("roomNo") != null ? cf.get("roomNo").toString() : null;
                })
                .filter(r -> r != null && !r.isBlank())
                .distinct()
                .count();

        // Occupied = rooms with a payment in the last 35 days (approx 1 month buffer)
        LocalDate cutoff = today.minusDays(35);
        long occupiedCount = allRentalEver.stream()
                .filter(t -> t.getTransactionDate() != null && !t.getTransactionDate().isBefore(cutoff))
                .filter(t -> t.getTransactionType() == Transaction.TransactionType.PAYMENT ||
                             t.getTransactionType() == Transaction.TransactionType.SALE ||
                             t.getTransactionType() == Transaction.TransactionType.INCOME)
                .map(t -> {
                    Map<String, Object> cf = parseCustomFields(t.getCustomFields());
                    return cf.get("roomNo") != null ? cf.get("roomNo").toString() : null;
                })
                .filter(r -> r != null && !r.isBlank())
                .distinct()
                .count();

        // Monthly recurring: sum of monthlyRent for rooms with recent activity
        BigDecimal monthlyRecurring = allRentalEver.stream()
                .filter(t -> t.getTransactionDate() != null && !t.getTransactionDate().isBefore(cutoff))
                .filter(t -> t.getTransactionType() == Transaction.TransactionType.PAYMENT ||
                             t.getTransactionType() == Transaction.TransactionType.SALE ||
                             t.getTransactionType() == Transaction.TransactionType.INCOME)
                .collect(Collectors.toMap(
                        t -> {
                            Map<String, Object> cf = parseCustomFields(t.getCustomFields());
                            return cf.get("roomNo") != null ? cf.get("roomNo").toString() : "";
                        },
                        t -> {
                            Map<String, Object> cf = parseCustomFields(t.getCustomFields());
                            BigDecimal mr = toBigDecimal(cf.get("monthlyRent"));
                            return mr != null ? mr : BigDecimal.ZERO;
                        },
                        (a, b) -> a.compareTo(BigDecimal.ZERO) > 0 ? a : b
                ))
                .values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Build total profit
        BigDecimal totalProfit = canViewProfit
                ? bizProfit.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                : null;

        // Build response
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("period", period);
        response.put("dateFrom", dateFrom.toString());
        response.put("dateTo", dateTo.toString());
        response.put("totalRevenue", totalRevenue);
        response.put("totalExpenses", totalExpenses);
        response.put("transactionCount", transactionCount);

        Map<String, Object> businesses = new LinkedHashMap<>();
        for (String code : businessCodes) {
            Map<String, Object> biz = new LinkedHashMap<>();
            biz.put("revenue", bizRevenue.get(code));
            biz.put("expenses", bizExpenses.get(code));
            biz.put("count", bizCount.get(code));
            if (canViewProfit) {
                biz.put("profit", "loan".equals(code) ? null : bizProfit.get(code));
            } else {
                biz.put("profit", null);
            }
            businesses.put(code, biz);
        }
        response.put("businesses", businesses);

        if (canViewProfit) {
            response.put("totalProfit", totalProfit);
        } else {
            response.put("totalProfit", null);
        }

        if (canViewProfit) {
            Map<String, Object> loanPortfolio = new LinkedHashMap<>();
            loanPortfolio.put("activeLoans", activeLoanCount);
            loanPortfolio.put("totalPrincipal", loanTotalPrincipal);
            loanPortfolio.put("totalAccruedInterest", loanTotalAccruedInterest);
            loanPortfolio.put("totalRepaid", loanTotalRepaid);
            response.put("loanPortfolio", loanPortfolio);
        } else {
            response.put("loanPortfolio", null);
        }

        Map<String, Object> rentalHealth = new LinkedHashMap<>();
        rentalHealth.put("totalProperties", (int) totalRoomCount);
        rentalHealth.put("occupiedCount", (int) occupiedCount);
        rentalHealth.put("monthlyRecurring", monthlyRecurring);
        response.put("rentalHealth", rentalHealth);

        return ResponseEntity.ok(response);
    }

    // =========================================================================
    // Helper methods
    // =========================================================================

    private BigDecimal calculateProfit(String code, Transaction.TransactionType type,
                                       BigDecimal amount, Map<String, Object> cf) {
        switch (code) {
            case "petrol": {
                if (type != Transaction.TransactionType.SALE) return null;
                BigDecimal ratePerLiter = toBigDecimal(cf.get("ratePerLiter"));
                BigDecimal purchaseRate = toBigDecimal(cf.get("purchaseRate"));
                BigDecimal liters = toBigDecimal(cf.get("liters"));
                if (purchaseRate == null || purchaseRate.compareTo(BigDecimal.ZERO) == 0) return null;
                if (ratePerLiter == null || liters == null) return null;
                return ratePerLiter.subtract(purchaseRate).multiply(liters);
            }
            case "ev": {
                if (type != Transaction.TransactionType.SALE) return null;
                BigDecimal profit = toBigDecimal(cf.get("profit"));
                return profit;
            }
            case "furniture": {
                if (type != Transaction.TransactionType.SALE) return null;
                BigDecimal sellingPrice = toBigDecimal(cf.get("sellingPrice"));
                BigDecimal purchasePrice = toBigDecimal(cf.get("purchasePrice"));
                if (purchasePrice == null || purchasePrice.compareTo(BigDecimal.ZERO) == 0) return null;
                if (sellingPrice == null) return null;
                // Quantity: check qtyOut first, then quantity
                BigDecimal qty = toBigDecimal(cf.get("qtyOut"));
                if (qty == null || qty.compareTo(BigDecimal.ZERO) == 0) {
                    qty = toBigDecimal(cf.get("quantity"));
                }
                if (qty == null) qty = BigDecimal.ONE;
                return sellingPrice.subtract(purchasePrice).multiply(qty);
            }
            case "rental": {
                if (type != Transaction.TransactionType.PAYMENT &&
                        type != Transaction.TransactionType.SALE &&
                        type != Transaction.TransactionType.INCOME) return null;
                BigDecimal maintenanceCost = toBigDecimal(cf.get("maintenanceCost"));
                if (maintenanceCost == null) maintenanceCost = BigDecimal.ZERO;
                return amount.subtract(maintenanceCost);
            }
            case "loan":
                return null; // Loan profit handled via portfolio section
            default:
                return null;
        }
    }

    private Map<String, Object> parseCustomFields(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return null;
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}

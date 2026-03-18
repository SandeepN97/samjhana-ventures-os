package com.samjhana.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.entity.DailyReport;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.repository.DailyReportRepository;
import com.samjhana.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/daily-reports")
@RequiredArgsConstructor
public class DailyReportController {

    private final TransactionRepository transactionRepository;
    private final DailyReportRepository dailyReportRepository;
    private final ObjectMapper objectMapper;

    @GetMapping("/today-summary")
    public ResponseEntity<?> todaySummary(@RequestParam(required = false) String date) {
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now();
        return ResponseEntity.ok(buildSummary(targetDate));
    }

    @GetMapping("/business-date")
    public ResponseEntity<?> businessDate() {
        LocalDate today = LocalDate.now();
        boolean todayClosed = dailyReportRepository.findByReportDate(today).isPresent();
        LocalDate effectiveDate = todayClosed ? today.plusDays(1) : today;
        return ResponseEntity.ok(Map.of(
                "date", effectiveDate.toString(),
                "todayClosed", todayClosed
        ));
    }

    @GetMapping("/recent")
    public ResponseEntity<?> recentReports() {
        LocalDate today = LocalDate.now();
        LocalDate thirtyDaysAgo = today.minusDays(30);
        List<Map<String, Object>> reports = dailyReportRepository
                .findByReportDateBetweenOrderByReportDateDesc(thirtyDaysAgo, today)
                .stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(reports);
    }

    @PostMapping("/close")
    public ResponseEntity<?> closeDay(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {

        // Accept optional date field; default to today
        LocalDate closeDate;
        if (body.containsKey("date") && body.get("date") != null) {
            closeDate = LocalDate.parse(body.get("date").toString());
        } else {
            closeDate = LocalDate.now();
        }

        // Check if already closed
        if (dailyReportRepository.findByReportDate(closeDate).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "This day's report has already been closed"));
        }

        BigDecimal cashCounted;
        try {
            cashCounted = new BigDecimal(body.get("cashCounted").toString());
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Invalid cashCounted value"));
        }

        String notes = body.get("notes") != null ? body.get("notes").toString() : null;

        // Calculate system totals
        Map<String, Object> summary = buildSummary(closeDate);

        BigDecimal petrolSales = toBigDecimal(summary.get("petrolSales"));
        BigDecimal petrolLiters = toBigDecimal(summary.get("petrolLiters"));
        BigDecimal dieselSales = toBigDecimal(summary.get("dieselSales"));
        BigDecimal dieselLiters = toBigDecimal(summary.get("dieselLiters"));
        BigDecimal evSales = toBigDecimal(summary.get("evSales"));
        BigDecimal evUnits = toBigDecimal(summary.get("evUnits"));
        BigDecimal otherSales = toBigDecimal(summary.get("otherSales"));
        BigDecimal totalSystemSales = toBigDecimal(summary.get("totalSystemSales"));
        BigDecimal totalCashSales = toBigDecimal(summary.get("totalCashSales"));
        BigDecimal totalBankSales = toBigDecimal(summary.get("totalBankSales"));
        // Discrepancy is cash counted vs cash sales only (bank sales are separate)
        BigDecimal discrepancy = cashCounted.subtract(totalCashSales);

        DailyReport report = DailyReport.builder()
                .reportDate(closeDate)
                .petrolSales(petrolSales)
                .petrolLiters(petrolLiters)
                .dieselSales(dieselSales)
                .dieselLiters(dieselLiters)
                .evSales(evSales)
                .evUnits(evUnits)
                .otherSales(otherSales)
                .totalSystemSales(totalSystemSales)
                .totalCashSales(totalCashSales)
                .totalBankSales(totalBankSales)
                .cashCounted(cashCounted)
                .discrepancy(discrepancy)
                .notes(notes)
                .closedBy(user)
                .closedAt(LocalDateTime.now())
                .build();

        DailyReport saved = dailyReportRepository.save(report);
        return ResponseEntity.ok(toResponse(saved));
    }

    @GetMapping
    public ResponseEntity<?> list() {
        List<Map<String, Object>> reports = dailyReportRepository.findAllByOrderByReportDateDesc()
                .stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/{date}")
    public ResponseEntity<?> getByDate(@PathVariable String date) {
        LocalDate reportDate = LocalDate.parse(date);
        return dailyReportRepository.findByReportDate(reportDate)
                .map(r -> ResponseEntity.ok(toResponse(r)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{date}/transactions")
    public ResponseEntity<?> getTransactionsForDate(@PathVariable String date) {
        LocalDate reportDate = LocalDate.parse(date);
        List<Transaction> transactions = transactionRepository.findByDateWithDetails(reportDate);
        List<com.samjhana.dto.TransactionResponse> filtered = transactions.stream()
                .filter(t -> t.getStatus() != Transaction.TransactionStatus.REJECTED)
                .map(com.samjhana.dto.TransactionResponse::from)
                .toList();
        return ResponseEntity.ok(filtered);
    }

    @PatchMapping("/{date}/verify")
    public ResponseEntity<?> verifyReport(
            @PathVariable String date,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal com.samjhana.entity.User user) {

        if (user.getRole() != com.samjhana.entity.User.UserRole.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Only admin can verify reports"));
        }

        LocalDate reportDate = LocalDate.parse(date);
        return dailyReportRepository.findByReportDate(reportDate)
                .map(report -> {
                    report.setVerificationStatus(DailyReport.VerificationStatus.VERIFIED);
                    report.setVerifiedBy(user);
                    report.setVerifiedAt(LocalDateTime.now());
                    if (body != null && body.containsKey("notes")) {
                        report.setVerificationNotes(body.get("notes"));
                    }
                    DailyReport saved = dailyReportRepository.save(report);
                    return ResponseEntity.ok(toResponse(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // =========================================================================
    // Helper methods
    // =========================================================================

    private Map<String, Object> buildSummary(LocalDate date) {
        List<Transaction> transactions = transactionRepository
                .findByTransactionDateBetweenOrderByTransactionDateDesc(date, date);

        // Filter out rejected transactions, only count SALE type
        List<Transaction> sales = transactions.stream()
                .filter(t -> t.getStatus() != Transaction.TransactionStatus.REJECTED)
                .filter(t -> t.getTransactionType() == Transaction.TransactionType.SALE)
                .toList();

        BigDecimal petrolSales = BigDecimal.ZERO;
        BigDecimal petrolLiters = BigDecimal.ZERO;
        BigDecimal dieselSales = BigDecimal.ZERO;
        BigDecimal dieselLiters = BigDecimal.ZERO;
        BigDecimal evSales = BigDecimal.ZERO;
        BigDecimal evUnits = BigDecimal.ZERO;
        BigDecimal otherSales = BigDecimal.ZERO;
        BigDecimal totalCashSales = BigDecimal.ZERO;
        BigDecimal totalBankSales = BigDecimal.ZERO;

        for (Transaction t : sales) {
            String businessCode = t.getBusiness().getCode();
            BigDecimal amount = t.getAmount() != null ? t.getAmount() : BigDecimal.ZERO;
            Map<String, Object> fields = parseCustomFields(t.getCustomFields());

            // Track cash vs bank payment method
            String paymentMethod = fields.get("paymentMethod") != null
                    ? fields.get("paymentMethod").toString().toUpperCase() : "CASH";
            if ("BANK".equals(paymentMethod)) {
                totalBankSales = totalBankSales.add(amount);
            } else {
                totalCashSales = totalCashSales.add(amount);
            }

            if ("petrol".equals(businessCode)) {
                String fuelType = fields.get("fuelType") != null
                        ? fields.get("fuelType").toString().toLowerCase() : "petrol";
                BigDecimal liters = toBigDecimal(fields.get("liters"));

                if ("diesel".equals(fuelType)) {
                    dieselSales = dieselSales.add(amount);
                    dieselLiters = dieselLiters.add(liters);
                } else {
                    petrolSales = petrolSales.add(amount);
                    petrolLiters = petrolLiters.add(liters);
                }
            } else if ("ev".equals(businessCode)) {
                evSales = evSales.add(amount);
                String chargingMode = fields.get("chargingMode") != null ? fields.get("chargingMode").toString() : "METER";
                if ("PERCENTAGE".equals(chargingMode)) {
                    evUnits = evUnits.add(toBigDecimal(fields.get("estimatedKwh")));
                } else {
                    BigDecimal opening = toBigDecimal(fields.get("openingMeter"));
                    BigDecimal closing = toBigDecimal(fields.get("closingMeter"));
                    evUnits = evUnits.add(closing.subtract(opening));
                }
            } else {
                otherSales = otherSales.add(amount);
            }
        }

        BigDecimal totalSystemSales = petrolSales.add(dieselSales).add(evSales).add(otherSales);

        // Check if today is already closed
        boolean isClosed = dailyReportRepository.findByReportDate(date).isPresent();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("date", date.toString());
        result.put("petrolSales", petrolSales);
        result.put("petrolLiters", petrolLiters);
        result.put("dieselSales", dieselSales);
        result.put("dieselLiters", dieselLiters);
        result.put("evSales", evSales);
        result.put("evUnits", evUnits);
        result.put("otherSales", otherSales);
        result.put("totalSystemSales", totalSystemSales);
        result.put("totalCashSales", totalCashSales);
        result.put("totalBankSales", totalBankSales);
        result.put("transactionCount", sales.size());
        result.put("isClosed", isClosed);

        if (isClosed) {
            dailyReportRepository.findByReportDate(date).ifPresent(report -> {
                result.put("closedReport", toResponse(report));
            });
        }

        return result;
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
        if (value == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private Map<String, Object> toResponse(DailyReport report) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", report.getId().toString());
        map.put("reportDate", report.getReportDate().toString());
        map.put("petrolSales", report.getPetrolSales());
        map.put("petrolLiters", report.getPetrolLiters());
        map.put("dieselSales", report.getDieselSales());
        map.put("dieselLiters", report.getDieselLiters());
        map.put("evSales", report.getEvSales());
        map.put("evUnits", report.getEvUnits());
        map.put("otherSales", report.getOtherSales());
        map.put("totalSystemSales", report.getTotalSystemSales());
        map.put("totalCashSales", report.getTotalCashSales());
        map.put("totalBankSales", report.getTotalBankSales());
        map.put("cashCounted", report.getCashCounted());
        map.put("discrepancy", report.getDiscrepancy());
        map.put("notes", report.getNotes());
        map.put("closedBy", report.getClosedBy().getFullName());
        map.put("closedAt", report.getClosedAt().toString());
        map.put("verificationStatus", report.getVerificationStatus() != null
                ? report.getVerificationStatus().name() : "PENDING");
        map.put("verifiedBy", report.getVerifiedBy() != null
                ? report.getVerifiedBy().getFullName() : null);
        map.put("verifiedAt", report.getVerifiedAt() != null
                ? report.getVerifiedAt().toString() : null);
        map.put("verificationNotes", report.getVerificationNotes());
        return map;
    }
}

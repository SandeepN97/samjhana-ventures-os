package com.samjhana.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.DailyReport;
import com.samjhana.entity.Transaction;
import com.samjhana.entity.User;
import com.samjhana.exception.DayAlreadyClosedException;
import com.samjhana.repository.DailyReportRepository;
import com.samjhana.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DailyReportService {

    private final TransactionRepository transactionRepository;
    private final DailyReportRepository dailyReportRepository;
    private final ObjectMapper objectMapper;

    public Map<String, Object> buildSummary(LocalDate date) {
        List<Transaction> sales = transactionRepository
                .findByTransactionDateBetweenOrderByTransactionDateDesc(date, date)
                .stream()
                .filter(t -> t.getStatus() != Transaction.TransactionStatus.REJECTED)
                .filter(t -> t.getTransactionType() == Transaction.TransactionType.SALE)
                .toList();

        BigDecimal petrolSales = BigDecimal.ZERO, petrolLiters = BigDecimal.ZERO;
        BigDecimal dieselSales = BigDecimal.ZERO, dieselLiters = BigDecimal.ZERO;
        BigDecimal evSales = BigDecimal.ZERO, evUnits = BigDecimal.ZERO;
        BigDecimal rentalSales = BigDecimal.ZERO, otherSales = BigDecimal.ZERO;
        BigDecimal totalCashSales = BigDecimal.ZERO, totalBankSales = BigDecimal.ZERO;

        for (Transaction t : sales) {
            String businessCode = t.getBusiness().getCode();
            BigDecimal amount = t.getAmount() != null ? t.getAmount() : BigDecimal.ZERO;
            Map<String, Object> fields = parseCustomFields(t.getCustomFields());

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
            } else if ("rental".equals(businessCode)) {
                rentalSales = rentalSales.add(amount);
            } else {
                otherSales = otherSales.add(amount);
            }
        }

        BigDecimal totalSystemSales = petrolSales.add(dieselSales).add(evSales).add(rentalSales).add(otherSales);
        boolean isClosed = dailyReportRepository.findByReportDate(date).isPresent();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("date", date.toString());
        result.put("petrolSales", petrolSales);
        result.put("petrolLiters", petrolLiters);
        result.put("dieselSales", dieselSales);
        result.put("dieselLiters", dieselLiters);
        result.put("evSales", evSales);
        result.put("evUnits", evUnits);
        result.put("rentalSales", rentalSales);
        result.put("otherSales", otherSales);
        result.put("totalSystemSales", totalSystemSales);
        result.put("totalCashSales", totalCashSales);
        result.put("totalBankSales", totalBankSales);
        result.put("transactionCount", sales.size());
        result.put("isClosed", isClosed);
        if (isClosed) {
            dailyReportRepository.findByReportDate(date)
                    .ifPresent(report -> result.put("closedReport", toResponse(report)));
        }
        return result;
    }

    public Map<String, Object> getBusinessDate() {
        LocalDate today = LocalDate.now();
        boolean todayClosed = dailyReportRepository.findByReportDate(today).isPresent();
        LocalDate effectiveDate = todayClosed ? today.plusDays(1) : today;
        return Map.of("date", effectiveDate.toString(), "todayClosed", todayClosed);
    }

    public List<Map<String, Object>> getRecentReports() {
        LocalDate today = LocalDate.now();
        return dailyReportRepository
                .findByReportDateBetweenOrderByReportDateDesc(today.minusDays(30), today)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public Map<String, Object> closeDay(LocalDate closeDate, BigDecimal cashCounted, String notes, User user) {
        if (dailyReportRepository.findByReportDate(closeDate).isPresent()) {
            throw new DayAlreadyClosedException(closeDate.toString());
        }

        Map<String, Object> summary = buildSummary(closeDate);
        BigDecimal totalCashSales = toBigDecimal(summary.get("totalCashSales"));

        DailyReport report = DailyReport.builder()
                .reportDate(closeDate)
                .petrolSales(toBigDecimal(summary.get("petrolSales")))
                .petrolLiters(toBigDecimal(summary.get("petrolLiters")))
                .dieselSales(toBigDecimal(summary.get("dieselSales")))
                .dieselLiters(toBigDecimal(summary.get("dieselLiters")))
                .evSales(toBigDecimal(summary.get("evSales")))
                .evUnits(toBigDecimal(summary.get("evUnits")))
                .rentalSales(toBigDecimal(summary.get("rentalSales")))
                .otherSales(toBigDecimal(summary.get("otherSales")))
                .totalSystemSales(toBigDecimal(summary.get("totalSystemSales")))
                .totalCashSales(totalCashSales)
                .totalBankSales(toBigDecimal(summary.get("totalBankSales")))
                .cashCounted(cashCounted)
                .discrepancy(cashCounted.subtract(totalCashSales))
                .notes(notes)
                .closedBy(user)
                .closedAt(LocalDateTime.now())
                .build();

        return toResponse(dailyReportRepository.save(report));
    }

    public List<Map<String, Object>> listAll() {
        return dailyReportRepository.findAllByOrderByReportDateDesc()
                .stream().map(this::toResponse).toList();
    }

    public Optional<Map<String, Object>> getByDate(LocalDate date) {
        return dailyReportRepository.findByReportDate(date).map(this::toResponse);
    }

    public List<TransactionResponse> getTransactionsForDate(LocalDate date) {
        return transactionRepository.findByDateWithDetails(date).stream()
                .filter(t -> t.getStatus() != Transaction.TransactionStatus.REJECTED)
                .map(TransactionResponse::from)
                .toList();
    }

    @Transactional
    public Optional<Map<String, Object>> verifyReport(LocalDate date, String notes, User user) {
        return dailyReportRepository.findByReportDate(date).map(report -> {
            report.setVerificationStatus(DailyReport.VerificationStatus.VERIFIED);
            report.setVerifiedBy(user);
            report.setVerifiedAt(LocalDateTime.now());
            if (notes != null) report.setVerificationNotes(notes);
            return toResponse(dailyReportRepository.save(report));
        });
    }

    public Map<String, Object> toResponse(DailyReport report) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", report.getId().toString());
        map.put("reportDate", report.getReportDate().toString());
        map.put("petrolSales", report.getPetrolSales());
        map.put("petrolLiters", report.getPetrolLiters());
        map.put("dieselSales", report.getDieselSales());
        map.put("dieselLiters", report.getDieselLiters());
        map.put("evSales", report.getEvSales());
        map.put("evUnits", report.getEvUnits());
        map.put("rentalSales", report.getRentalSales() != null ? report.getRentalSales() : BigDecimal.ZERO);
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
        map.put("verifiedBy", report.getVerifiedBy() != null ? report.getVerifiedBy().getFullName() : null);
        map.put("verifiedAt", report.getVerifiedAt() != null ? report.getVerifiedAt().toString() : null);
        map.put("verificationNotes", report.getVerificationNotes());
        return map;
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
}
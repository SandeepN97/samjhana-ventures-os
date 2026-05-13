package com.samjhana.controller;

import com.samjhana.dto.TransactionResponse;
import com.samjhana.entity.User;
import com.samjhana.service.DailyReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/daily-reports")
@RequiredArgsConstructor
public class DailyReportController {

    private final DailyReportService dailyReportService;

    @GetMapping("/today-summary")
    public ResponseEntity<?> todaySummary(@RequestParam(required = false) String date) {
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now();
        return ResponseEntity.ok(dailyReportService.buildSummary(targetDate));
    }

    @GetMapping("/business-date")
    public ResponseEntity<?> businessDate() {
        return ResponseEntity.ok(dailyReportService.getBusinessDate());
    }

    @GetMapping("/recent")
    public ResponseEntity<?> recentReports() {
        return ResponseEntity.ok(dailyReportService.getRecentReports());
    }

    @PostMapping("/close")
    public ResponseEntity<?> closeDay(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {

        LocalDate closeDate;
        if (body.containsKey("date") && body.get("date") != null) {
            closeDate = LocalDate.parse(body.get("date").toString());
        } else {
            closeDate = LocalDate.now();
        }

        BigDecimal cashCounted;
        try {
            cashCounted = new BigDecimal(body.get("cashCounted").toString());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid cashCounted value"));
        }

        String notes = body.get("notes") != null ? body.get("notes").toString() : null;
        return ResponseEntity.ok(dailyReportService.closeDay(closeDate, cashCounted, notes, user));
    }

    @GetMapping
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(dailyReportService.listAll());
    }

    @GetMapping("/{date}")
    public ResponseEntity<?> getByDate(@PathVariable String date) {
        return dailyReportService.getByDate(LocalDate.parse(date))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{date}/transactions")
    public ResponseEntity<?> getTransactionsForDate(@PathVariable String date) {
        List<TransactionResponse> transactions = dailyReportService.getTransactionsForDate(LocalDate.parse(date));
        return ResponseEntity.ok(transactions);
    }

    @PatchMapping("/{date}/verify")
    public ResponseEntity<?> verifyReport(
            @PathVariable String date,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal User user) {

        if (!user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }

        String notes = body != null ? body.get("notes") : null;
        return dailyReportService.verifyReport(LocalDate.parse(date), notes, user)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
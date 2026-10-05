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

        // The day being worked on (today, or tomorrow once today is closed). Nobody closes a day that
        // hasn't happened yet, and closing an earlier, missed day is a manager's job: a closed day
        // is final, so a wrong close would lock a day's takings.
        LocalDate businessDate = LocalDate.parse(dailyReportService.getBusinessDate().get("date").toString());
        LocalDate closeDate = body.get("date") != null ? LocalDate.parse(body.get("date").toString()) : businessDate;
        if (closeDate.isAfter(businessDate)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cannot close a day that hasn't happened yet"));
        }
        if (closeDate.isBefore(businessDate) && (user == null || !user.canManage())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Only an admin or manager can close an earlier day"));
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

    /** The whole history of closed days is for managers and admins; staff only close today. */
    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal User user) {
        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }
        return ResponseEntity.ok(dailyReportService.listAll());
    }

    @GetMapping("/{date}")
    public ResponseEntity<?> getByDate(@PathVariable String date, @AuthenticationPrincipal User user) {
        if (user == null || !user.canManage()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Admin or manager access required"));
        }
        return dailyReportService.getByDate(LocalDate.parse(date))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{date}/transactions")
    public ResponseEntity<?> getTransactionsForDate(@PathVariable String date, @AuthenticationPrincipal User user) {
        List<TransactionResponse> transactions = dailyReportService.getTransactionsForDate(LocalDate.parse(date), user);
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
package com.samjhana.service;

import com.samjhana.dto.ElectricityBillRequest;
import com.samjhana.dto.ElectricityBillResponse;
import com.samjhana.dto.EvReconciliationResponse;
import com.samjhana.entity.AuditLog;
import com.samjhana.entity.ChargeSession;
import com.samjhana.entity.ElectricityBill;
import com.samjhana.entity.User;
import com.samjhana.exception.EvSessionStateException;
import com.samjhana.exception.ResourceNotFoundException;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.ChargeSessionRepository;
import com.samjhana.repository.ElectricityBillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ElectricityBillService {

    private final ElectricityBillRepository electricityBillRepository;
    private final ChargeSessionRepository chargeSessionRepository;
    private final AuditLogRepository auditLogRepository;

    @Transactional
    public ElectricityBillResponse create(ElectricityBillRequest request, User user) {
        if (request.getPeriodEnd().isBefore(request.getPeriodStart())) {
            throw new IllegalArgumentException("Billing period end must be on or after its start");
        }
        if (electricityBillRepository.existsByPeriodStartAndPeriodEndAndDeletedAtIsNull(
                request.getPeriodStart(), request.getPeriodEnd())) {
            throw new EvSessionStateException("An electricity bill already exists for this exact period");
        }
        ElectricityBill bill = ElectricityBill.builder()
                .periodStart(request.getPeriodStart())
                .periodEnd(request.getPeriodEnd())
                .billedKwh(request.getBilledKwh().setScale(3, RoundingMode.HALF_UP))
                .amountPaid(request.getAmountPaid().setScale(2, RoundingMode.HALF_UP))
                .referenceNumber(clean(request.getReferenceNumber()))
                .notes(clean(request.getNotes()))
                .createdBy(user)
                .build();
        bill = electricityBillRepository.save(bill);
        auditLogRepository.save(AuditLog.createEvent(user, AuditLog.EntityType.ELECTRICITY_BILL,
                bill.getId(), "{\"periodStart\":\"" + bill.getPeriodStart() + "\",\"periodEnd\":\""
                        + bill.getPeriodEnd() + "\"}"));
        return ElectricityBillResponse.from(bill);
    }

    @Transactional(readOnly = true)
    public List<ElectricityBillResponse> list() {
        return electricityBillRepository.findByDeletedAtIsNullOrderByPeriodEndDesc()
                .stream().map(ElectricityBillResponse::from).toList();
    }

    @Transactional
    public void delete(UUID id, User user) {
        ElectricityBill bill = find(id);
        bill.setDeletedAt(LocalDateTime.now());
        electricityBillRepository.save(bill);
        auditLogRepository.save(AuditLog.updateEvent(user, AuditLog.EntityType.ELECTRICITY_BILL,
                bill.getId(), "{\"deletedAt\":null}", "{\"deletedAt\":\"" + bill.getDeletedAt() + "\"}"));
    }

    @Transactional(readOnly = true)
    public EvReconciliationResponse reconcile(UUID id) {
        ElectricityBill bill = find(id);
        LocalDateTime start = bill.getPeriodStart().atStartOfDay();
        LocalDateTime endExclusive = bill.getPeriodEnd().plusDays(1).atStartOfDay();
        List<ChargeSession> sessions = chargeSessionRepository.findPaidInPeriod(start, endExclusive).stream()
                .filter(session -> session.getClosedAt() != null)
                .toList();

        BigDecimal soldKwh = sessions.stream().map(ChargeSession::getEnergyDeliveredKwh)
                .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal revenue = sessions.stream().map(ChargeSession::getAmount)
                .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal variance = soldKwh.subtract(bill.getBilledKwh());
        BigDecimal variancePercent = bill.getBilledKwh().signum() == 0 ? BigDecimal.ZERO
                : variance.divide(bill.getBilledKwh(), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
        BigDecimal profit = revenue.subtract(bill.getAmountPaid());
        BigDecimal profitPercent = revenue.signum() == 0 ? BigDecimal.ZERO
                : profit.divide(revenue, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100));

        Map<String, MutableBreakdown> groups = new LinkedHashMap<>();
        for (ChargeSession session : sessions) {
            String code = session.getChargePoint().getCode();
            MutableBreakdown group = groups.computeIfAbsent(code,
                    ignored -> new MutableBreakdown(session.getChargePoint().getModel()));
            group.sessions++;
            group.soldKwh = group.soldKwh.add(session.getEnergyDeliveredKwh());
            group.revenue = group.revenue.add(session.getAmount());
        }
        List<EvReconciliationResponse.ChargePointBreakdown> breakdown = groups.entrySet().stream()
                .map(entry -> new EvReconciliationResponse.ChargePointBreakdown(
                        entry.getKey(), entry.getValue().model, entry.getValue().sessions,
                        entry.getValue().soldKwh, entry.getValue().revenue))
                .toList();

        return EvReconciliationResponse.builder()
                .electricityBillId(bill.getId().toString())
                .periodStart(bill.getPeriodStart())
                .periodEnd(bill.getPeriodEnd())
                .soldKwh(soldKwh.setScale(3, RoundingMode.HALF_UP))
                .billedKwh(bill.getBilledKwh())
                .varianceKwh(variance.setScale(3, RoundingMode.HALF_UP))
                .variancePercent(variancePercent.setScale(2, RoundingMode.HALF_UP))
                .revenue(revenue.setScale(2, RoundingMode.HALF_UP))
                .electricityCost(bill.getAmountPaid())
                .profit(profit.setScale(2, RoundingMode.HALF_UP))
                .profitPercent(profitPercent.setScale(2, RoundingMode.HALF_UP))
                .byChargePoint(breakdown)
                .build();
    }

    private ElectricityBill find(UUID id) {
        return electricityBillRepository.findById(id)
                .filter(bill -> bill.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Electricity bill not found: " + id));
    }

    private String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private static final class MutableBreakdown {
        private final String model;
        private long sessions;
        private BigDecimal soldKwh = BigDecimal.ZERO;
        private BigDecimal revenue = BigDecimal.ZERO;

        private MutableBreakdown(String model) {
            this.model = model;
        }
    }
}

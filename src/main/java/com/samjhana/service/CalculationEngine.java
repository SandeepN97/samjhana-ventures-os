package com.samjhana.service;

import com.samjhana.entity.Transaction;
import com.samjhana.strategy.BusinessCalculationStrategy;
import com.samjhana.strategy.BusinessCalculationStrategy.ReconciliationResult;
import com.samjhana.strategy.BusinessCalculationStrategy.ValidationResult;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CalculationEngine {

    private final List<BusinessCalculationStrategy> strategies;
    private Map<String, BusinessCalculationStrategy> strategyMap;

    @PostConstruct
    public void init() {
        strategyMap = new HashMap<>();
        for (BusinessCalculationStrategy strategy : strategies) {
            strategyMap.put(strategy.getBusinessCode(), strategy);
            log.info("Registered calculation strategy: {} -> {}",
                    strategy.getBusinessCode(),
                    strategy.getClass().getSimpleName());
        }
        log.info("CalculationEngine initialized with {} strategies", strategyMap.size());
    }

    public Optional<BusinessCalculationStrategy> getStrategy(String businessCode) {
        return Optional.ofNullable(strategyMap.get(businessCode));
    }

    public BigDecimal calculateAmount(String businessCode, Map<String, Object> customFields) {
        return getStrategy(businessCode)
                .map(s -> s.calculateAmount(customFields))
                .orElse(BigDecimal.ZERO);
    }

    public BigDecimal calculateProfit(String businessCode, Map<String, Object> customFields) {
        return getStrategy(businessCode)
                .map(s -> s.calculateProfit(customFields))
                .orElse(null);
    }

    public ValidationResult validate(String businessCode, Map<String, Object> customFields) {
        return getStrategy(businessCode)
                .map(s -> s.validate(customFields))
                .orElse(ValidationResult.valid());
    }

    public String getSummary(String businessCode, Transaction transaction,
                            Map<String, Object> customFields) {
        return getStrategy(businessCode)
                .map(s -> s.getSummary(transaction, customFields))
                .orElse("Transaction");
    }

    public ReconciliationResult reconcile(String businessCode,
                                          Map<String, Object> customFields,
                                          Map<String, Object> previousState) {
        return getStrategy(businessCode)
                .map(s -> s.reconcile(customFields, previousState))
                .orElse(ReconciliationResult.notApplicable());
    }

    public boolean hasStrategy(String businessCode) {
        return strategyMap.containsKey(businessCode);
    }

    public List<String> getRegisteredBusinessCodes() {
        return List.copyOf(strategyMap.keySet());
    }
}

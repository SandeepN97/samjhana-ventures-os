package com.samjhana.repository;

import com.samjhana.entity.LoanReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface LoanReceiptRepository extends JpaRepository<LoanReceipt, UUID> {

    Optional<LoanReceipt> findByIdAndDeletedAtIsNull(UUID id);
}

package com.samjhana.repository;

import com.samjhana.entity.LoanReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface LoanReceiptRepository extends JpaRepository<LoanReceipt, UUID> {

    Optional<LoanReceipt> findByIdAndDeletedAtIsNull(UUID id);

    /** Bytes held by receipt photos that have not been removed. */
    @Query("select coalesce(sum(r.sizeBytes), 0L) from LoanReceipt r where r.deletedAt is null")
    long sumLiveBytes();
}

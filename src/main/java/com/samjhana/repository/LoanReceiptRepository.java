package com.samjhana.repository;

import com.samjhana.entity.LoanReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LoanReceiptRepository extends JpaRepository<LoanReceipt, UUID> {

    Optional<LoanReceipt> findByIdAndDeletedAtIsNull(UUID id);

    /** Bytes held by receipt photos that have not been removed. */
    @Query("select coalesce(sum(r.sizeBytes), 0L) from LoanReceipt r where r.deletedAt is null")
    long sumLiveBytes();

    /**
     * Gives the receipt to a payment only while it still belongs to none (finding F-05). Returns 1 for the one request
     * that got it and 0 for any other, however many were holding the same free receipt at the same moment.
     */
    @Modifying(flushAutomatically = true)
    @Query("update LoanReceipt r set r.transactionId = :transactionId "
            + "where r.id = :id and r.transactionId is null and r.deletedAt is null")
    int attachIfFree(@Param("id") UUID id, @Param("transactionId") UUID transactionId);

    /** The receipts of exactly this size that are already attached to a payment (candidates for "the same photo again"). */
    @Query("select r from LoanReceipt r where r.sizeBytes = :sizeBytes and r.transactionId is not null and r.deletedAt is null")
    List<LoanReceipt> findAttachedWithSize(@Param("sizeBytes") long sizeBytes);
}

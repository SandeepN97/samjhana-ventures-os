package com.samjhana.repository;

import com.samjhana.entity.Transaction;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    @Query("SELECT t FROM Transaction t JOIN FETCH t.business b JOIN FETCH t.enteredBy WHERE b.code = :code ORDER BY t.transactionDate DESC")
    List<Transaction> findByBusinessCodeOrderByTransactionDateDesc(@Param("code") String businessCode);

    /**
     * One page of a business's newest transactions of one type, leaving out one status, newest first. No JOIN FETCH:
     * callers that only read the stored fields need neither the business nor the user (finding K-01).
     */
    @Query("SELECT t FROM Transaction t WHERE t.business.code = :code AND t.transactionType = :type "
            + "AND t.status <> :excluded ORDER BY t.transactionDate DESC, t.createdAt DESC")
    List<Transaction> findRecentByBusinessCodeAndTypeExcludingStatus(@Param("code") String businessCode,
            @Param("type") Transaction.TransactionType type,
            @Param("excluded") Transaction.TransactionStatus excluded, Pageable pageable);

    long countByBusiness_CodeAndStatus(String businessCode, Transaction.TransactionStatus status);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.business JOIN FETCH t.enteredBy ORDER BY t.createdAt DESC")
    List<Transaction> findAllWithDetails();

    List<Transaction> findByTransactionDateBetweenOrderByTransactionDateDesc(LocalDate start, LocalDate end);

    List<Transaction> findByStatusOrderByCreatedAtDesc(Transaction.TransactionStatus status);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.business JOIN FETCH t.enteredBy WHERE t.transactionDate = :date ORDER BY t.createdAt DESC")
    List<Transaction> findByDateWithDetails(@Param("date") LocalDate date);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.business JOIN FETCH t.enteredBy WHERE t.transactionDate BETWEEN :start AND :end ORDER BY t.transactionDate DESC")
    List<Transaction> findByDateRangeWithDetails(@Param("start") LocalDate start, @Param("end") LocalDate end);
}

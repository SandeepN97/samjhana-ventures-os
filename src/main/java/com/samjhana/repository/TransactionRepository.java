package com.samjhana.repository;

import com.samjhana.entity.Transaction;
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

    @Query("SELECT t FROM Transaction t JOIN FETCH t.business JOIN FETCH t.enteredBy ORDER BY t.createdAt DESC")
    List<Transaction> findAllWithDetails();

    List<Transaction> findByTransactionDateBetweenOrderByTransactionDateDesc(LocalDate start, LocalDate end);

    List<Transaction> findByEnteredByIdOrderByCreatedAtDesc(UUID userId);

    List<Transaction> findByStatusOrderByCreatedAtDesc(Transaction.TransactionStatus status);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.business JOIN FETCH t.enteredBy WHERE t.transactionDate = :date ORDER BY t.createdAt DESC")
    List<Transaction> findByDateWithDetails(@Param("date") LocalDate date);
}

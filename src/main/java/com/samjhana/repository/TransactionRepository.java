package com.samjhana.repository;

import com.samjhana.entity.Transaction;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    @Query("SELECT t FROM Transaction t JOIN FETCH t.business b JOIN FETCH t.enteredBy WHERE b.code = :code ORDER BY t.transactionDate DESC")
    List<Transaction> findByBusinessCodeOrderByTransactionDateDesc(@Param("code") String businessCode);

    long countByBusiness_CodeAndStatus(String businessCode, Transaction.TransactionStatus status);

    /** How many transactions of one type a business has on one day: counted by the database, nothing loaded. */
    long countByBusiness_CodeAndTransactionDateAndTransactionType(String businessCode, LocalDate date, Transaction.TransactionType type);

    /** The amounts of one business's transactions of one type on one day added up by the database; null when there are none. */
    @Query("SELECT SUM(t.amount) FROM Transaction t WHERE t.business.code = :code AND t.transactionDate = :date AND t.transactionType = :type")
    BigDecimal sumAmountByBusinessCodeAndDateAndType(@Param("code") String businessCode, @Param("date") LocalDate date,
                                                     @Param("type") Transaction.TransactionType type);

    /** One page of a business's transactions, newest first; the page decides how many rows are read. */
    @Query("SELECT t FROM Transaction t JOIN FETCH t.business b JOIN FETCH t.enteredBy WHERE b.code = :code "
            + "ORDER BY t.transactionDate DESC, t.createdAt DESC")
    List<Transaction> findNewestByBusinessCode(@Param("code") String businessCode, Pageable page);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.business JOIN FETCH t.enteredBy ORDER BY t.createdAt DESC")
    List<Transaction> findAllWithDetails();

    List<Transaction> findByTransactionDateBetweenOrderByTransactionDateDesc(LocalDate start, LocalDate end);

    List<Transaction> findByStatusOrderByCreatedAtDesc(Transaction.TransactionStatus status);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.business JOIN FETCH t.enteredBy WHERE t.transactionDate = :date ORDER BY t.createdAt DESC")
    List<Transaction> findByDateWithDetails(@Param("date") LocalDate date);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.business JOIN FETCH t.enteredBy WHERE t.transactionDate BETWEEN :start AND :end ORDER BY t.transactionDate DESC")
    List<Transaction> findByDateRangeWithDetails(@Param("start") LocalDate start, @Param("end") LocalDate end);
}

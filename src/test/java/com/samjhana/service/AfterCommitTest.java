package com.samjhana.service;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AfterCommitTest {

    @Test
    void shouldRunImmediately_whenThereIsNoTransaction() {
        AtomicInteger runs = new AtomicInteger();

        AfterCommit.run(runs::incrementAndGet);

        assertEquals(1, runs.get());
    }

    @Test
    void shouldWaitForCommit_whenInsideATransaction() {
        AtomicInteger runs = new AtomicInteger();
        TransactionSynchronizationManager.initSynchronization();
        try {
            AfterCommit.run(runs::incrementAndGet);
            assertEquals(0, runs.get(), "must not run before the transaction commits");

            TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);

            assertEquals(1, runs.get());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void shouldNeverRun_whenTheTransactionRollsBack() {
        AtomicInteger runs = new AtomicInteger();
        TransactionSynchronizationManager.initSynchronization();
        try {
            AfterCommit.run(runs::incrementAndGet);
            // afterCommit() is never invoked on rollback; only afterCompletion(STATUS_ROLLED_BACK) is.
            TransactionSynchronizationManager.getSynchronizations()
                    .forEach(sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        assertEquals(0, runs.get());
    }

    @Test
    void shouldPropagateFailure_whenRunOutsideATransactionAndTheActionThrows() {
        assertThrows(IllegalStateException.class, () -> AfterCommit.run(() -> { throw new IllegalStateException("boom"); }));
    }
}

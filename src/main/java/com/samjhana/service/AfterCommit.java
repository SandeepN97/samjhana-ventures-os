package com.samjhana.service;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Runs a side effect (a live WebSocket event, an OCPP command) only once the surrounding
 * database transaction has committed.
 *
 * <p>Doing it earlier is a race: a client that reacts to the event by re-reading the data can
 * still see the old state, and a charger that answers a command within milliseconds gets
 * handled against the pre-commit session. Outside a transaction it simply runs immediately.
 */
final class AfterCommit {

    private AfterCommit() {}

    static void run(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}

package com.samjhana.service;

import com.samjhana.entity.LoanReceipt;
import com.samjhana.repository.LoanReceiptRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Finding F-05: two loan payments could hold the same free receipt photo at the same moment, both pass the "is it
 * free?" check, and both attach it; the second one silently took the photo away from the first payment. Not a
 * transactional test: the point is real transactions that commit.
 */
@SpringBootTest
@ActiveProfiles("test")
class LoanReceiptAttachIntegrationTest {

    @Autowired LoanReceiptService service;
    @Autowired LoanReceiptRepository repository;

    private final List<UUID> created = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        repository.deleteAllById(created);
    }

    private LoanReceipt freeReceipt() {
        LoanReceipt saved = repository.save(LoanReceipt.builder().contentType("image/jpeg").sizeBytes(4L)
                .uploadedBy("manager").data(new byte[]{1, 2, 3, 4}).build());
        created.add(saved.getId());
        return saved;
    }

    private LoanReceipt storedCopy(LoanReceipt receipt) {
        return repository.findById(receipt.getId()).orElseThrow();
    }

    @Test
    void shouldGiveTheReceiptToTheFirstPayment_andRefuseTheSecond() {
        LoanReceipt receipt = freeReceipt();
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        LoanReceipt copyHeldByTheSecondRequest = storedCopy(receipt);   // it saw the receipt while it was free

        service.attach(storedCopy(receipt), first);

        assertThatThrownBy(() -> service.attach(copyHeldByTheSecondRequest, second))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("already used by another payment");
        assertThat(storedCopy(receipt).getTransactionId()).isEqualTo(first);
    }

    @Test
    void shouldGiveTheReceiptToExactlyOnePayment_whenManyAskAtTheSameMoment() throws Exception {
        LoanReceipt receipt = freeReceipt();
        int requests = 8;
        ExecutorService pool = Executors.newFixedThreadPool(requests);
        CountDownLatch go = new CountDownLatch(1);
        List<UUID> payments = new ArrayList<>();
        List<Future<Boolean>> results = new ArrayList<>();
        try {
            for (int n = 0; n < requests; n++) {
                UUID payment = UUID.randomUUID();
                payments.add(payment);
                LoanReceipt copy = storedCopy(receipt);   // each request loaded the receipt while it was free
                Callable<Boolean> request = () -> {
                    go.await();
                    try {
                        service.attach(copy, payment);
                        return true;
                    } catch (IllegalArgumentException refused) {
                        return false;
                    }
                };
                results.add(pool.submit(request));
            }
            go.countDown();
            int won = 0;
            for (Future<Boolean> result : results) {
                try {
                    if (result.get(30, TimeUnit.SECONDS)) won++;
                } catch (ExecutionException e) {
                    throw new AssertionError("a request failed in an unexpected way", e.getCause());
                }
            }
            assertThat(won).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
        assertThat(payments).contains(storedCopy(receipt).getTransactionId());
    }

    @Test
    void shouldRefuseToAttachAReceiptThatWasRemovedInTheMeantime() {
        LoanReceipt receipt = freeReceipt();
        LoanReceipt copy = storedCopy(receipt);
        LoanReceipt removed = storedCopy(receipt);
        removed.setDeletedAt(LocalDateTime.now());
        repository.save(removed);

        assertThatThrownBy(() -> service.attach(copy, UUID.randomUUID())).isInstanceOf(IllegalArgumentException.class);
        assertThat(storedCopy(receipt).getTransactionId()).isNull();
    }
}

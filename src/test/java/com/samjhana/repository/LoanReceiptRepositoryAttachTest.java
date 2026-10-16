package com.samjhana.repository;

import com.samjhana.entity.LoanReceipt;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding F-05: the statement that gives a receipt photo to a payment works for the first request only, and the
 * lookup that finds earlier receipts of the same size.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class LoanReceiptRepositoryAttachTest {

    @Autowired LoanReceiptRepository receipts;
    @PersistenceContext EntityManager entityManager;

    private LoanReceipt newReceipt(int size, UUID transactionId, LocalDateTime deletedAt) {
        return receipts.saveAndFlush(LoanReceipt.builder().contentType("image/jpeg").sizeBytes((long) size)
                .uploadedBy("manager").transactionId(transactionId).deletedAt(deletedAt).data(new byte[size]).build());
    }

    private LoanReceipt reload(LoanReceipt receipt) {
        entityManager.flush();
        entityManager.clear();
        return receipts.findById(receipt.getId()).orElseThrow();
    }

    @Test
    void shouldGiveTheReceiptToThePayment_whenItIsStillFree() {
        LoanReceipt receipt = newReceipt(10, null, null);
        UUID payment = UUID.randomUUID();

        int attached = receipts.attachIfFree(receipt.getId(), payment);

        assertThat(attached).isEqualTo(1);
        assertThat(reload(receipt).getTransactionId()).isEqualTo(payment);
    }

    @Test
    void shouldLeaveTheFirstPaymentInPlace_whenASecondOneAsksForTheSameReceipt() {
        LoanReceipt receipt = newReceipt(10, null, null);
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();

        int one = receipts.attachIfFree(receipt.getId(), first);
        int two = receipts.attachIfFree(receipt.getId(), second);

        assertThat(one).isEqualTo(1);
        assertThat(two).isZero();
        assertThat(reload(receipt).getTransactionId()).isEqualTo(first);
    }

    @Test
    void shouldAttachNothing_whenTheReceiptAlreadyBelongsToAPayment() {
        UUID owner = UUID.randomUUID();
        LoanReceipt receipt = newReceipt(10, owner, null);

        assertThat(receipts.attachIfFree(receipt.getId(), UUID.randomUUID())).isZero();
        assertThat(reload(receipt).getTransactionId()).isEqualTo(owner);
    }

    @Test
    void shouldAttachNothing_whenTheReceiptWasRemoved() {
        LoanReceipt receipt = newReceipt(10, null, LocalDateTime.now());

        assertThat(receipts.attachIfFree(receipt.getId(), UUID.randomUUID())).isZero();
        assertThat(reload(receipt).getTransactionId()).isNull();
    }

    @Test
    void shouldAttachNothing_forAReceiptThatDoesNotExist() {
        assertThat(receipts.attachIfFree(UUID.randomUUID(), UUID.randomUUID())).isZero();
    }

    @Test
    void shouldChangeOnlyThePaymentOfTheReceipt() {
        LoanReceipt receipt = newReceipt(10, null, null);

        receipts.attachIfFree(receipt.getId(), UUID.randomUUID());

        LoanReceipt after = reload(receipt);
        assertThat(after.getUploadedBy()).isEqualTo("manager");
        assertThat(after.getSizeBytes()).isEqualTo(10L);
        assertThat(after.getData()).hasSize(10);
        assertThat(after.getDeletedAt()).isNull();
    }

    @Test
    void shouldFindOnlyLiveAttachedReceiptsOfTheSameSize() {
        LoanReceipt attachedSameSize = newReceipt(37, UUID.randomUUID(), null);
        newReceipt(37, null, null);                              // not attached to a payment
        newReceipt(37, UUID.randomUUID(), LocalDateTime.now());  // removed
        newReceipt(38, UUID.randomUUID(), null);                 // another size

        assertThat(receipts.findAttachedWithSize(37)).extracting(LoanReceipt::getId).containsExactly(attachedSameSize.getId());
    }
}

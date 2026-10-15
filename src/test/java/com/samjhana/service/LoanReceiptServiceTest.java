package com.samjhana.service;

import com.samjhana.entity.LoanReceipt;
import com.samjhana.entity.User;
import com.samjhana.repository.LoanReceiptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class LoanReceiptServiceTest {

    @Mock LoanReceiptRepository repository;
    LoanReceiptService service;
    User manager, other, admin;

    @BeforeEach
    void setUp() {
        service = new LoanReceiptService(repository);
        lenient().when(repository.save(any(LoanReceipt.class))).thenAnswer(i -> i.getArgument(0));
        manager = User.builder().username("mgr").role(User.UserRole.MANAGER).build();
        other = User.builder().username("mgr2").role(User.UserRole.MANAGER).build();
        admin = User.builder().username("boss").role(User.UserRole.ADMIN).build();
    }

    private static byte[] image(String format, int w, int h) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), format, out);
        return out.toByteArray();
    }

    @Test
    void shouldSaveAPngAsAPlainJpegOwnedByTheUploader() throws Exception {
        LoanReceipt saved = service.store(image("png", 30, 20), manager);
        assertThat(saved.getContentType()).isEqualTo("image/jpeg");
        assertThat(saved.getUploadedBy()).isEqualTo("mgr");
        assertThat(saved.getTransactionId()).isNull();
        assertThat(saved.getData()[0] & 0xFF).isEqualTo(0xFF);
        assertThat(saved.getData()[1] & 0xFF).isEqualTo(0xD8);
    }

    @Test
    void shouldRefuseEmptyOversizeAndNonPictureBytes() {
        assertThatThrownBy(() -> service.store(new byte[0], manager)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.store(new byte[LoanReceiptService.MAX_BYTES + 1], manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("3 MB");
        assertThatThrownBy(() -> service.store("<svg/>".getBytes(), manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("JPEG or PNG");
    }

    @Test
    void shouldRefuseABrokenPictureThatOnlyStartsLikeAJpeg() {
        byte[] fake = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1, 2, 3, 4};
        assertThatThrownBy(() -> service.store(fake, manager)).isInstanceOf(IllegalArgumentException.class);
    }

    private LoanReceipt existing(String uploadedBy, UUID transactionId) {
        LoanReceipt r = LoanReceipt.builder().id(UUID.randomUUID()).uploadedBy(uploadedBy).transactionId(transactionId)
                .contentType("image/jpeg").sizeBytes(1L).data(new byte[]{1}).build();
        lenient().when(repository.findByIdAndDeletedAtIsNull(r.getId())).thenReturn(Optional.of(r));
        return r;
    }

    @Test
    void shouldLetTheUploaderAttachAFreeReceipt_andAnAdminAttachAnyFreeOne() {
        LoanReceipt r = existing("mgr", null);
        assertThat(service.requireAttachable(r.getId().toString(), manager)).isSameAs(r);
        assertThat(service.requireAttachable(r.getId().toString(), admin)).isSameAs(r);
    }

    @Test
    void shouldRefuseUnknownUsedOrSomeoneElsesReceipts() {
        LoanReceipt used = existing("mgr", UUID.randomUUID());
        LoanReceipt theirs = existing("mgr", null);
        assertThatThrownBy(() -> service.requireAttachable("not-an-id", manager)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.requireAttachable(UUID.randomUUID().toString(), manager)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.requireAttachable(used.getId().toString(), manager))
                .hasMessageContaining("already used");
        assertThatThrownBy(() -> service.requireAttachable(theirs.getId().toString(), other))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRecordWhichPaymentAReceiptBelongsTo() {
        LoanReceipt r = existing("mgr", null);
        UUID tx = UUID.randomUUID();
        service.attach(r, tx);
        ArgumentCaptor<LoanReceipt> captor = ArgumentCaptor.forClass(LoanReceipt.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getTransactionId()).isEqualTo(tx);
    }
}

package com.samjhana.service;

import com.samjhana.entity.AuditLog;
import com.samjhana.entity.LoanReceipt;
import com.samjhana.entity.User;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.LoanReceiptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.zip.CRC32;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoanReceiptServiceTest {

    @Mock LoanReceiptRepository repository;
    @Mock AuditLogRepository auditLogRepository;
    LoanReceiptService service;
    User manager, other, admin;

    @BeforeEach
    void setUp() {
        service = new LoanReceiptService(repository, auditLogRepository);
        lenient().when(repository.save(any(LoanReceipt.class))).thenAnswer(i -> {
            LoanReceipt receipt = i.getArgument(0);
            if (receipt.getId() == null) receipt.setId(UUID.randomUUID());   // what the database does on the first save
            return receipt;
        });
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

    // ---- finding P0-04: a small file must not be able to make the server build a huge picture in memory ----

    /** A PNG that is a few dozen bytes long but whose header claims the given size: the picture itself is empty. */
    private static byte[] pngClaiming(int width, int height) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A});
        byte[] header = ByteBuffer.allocate(13).putInt(width).putInt(height)
                .put((byte) 8).put((byte) 2).put((byte) 0).put((byte) 0).put((byte) 0).array();
        pngChunk(out, "IHDR", header);
        pngChunk(out, "IDAT", new byte[]{0x78, (byte) 0x9C, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01});   // an empty zlib stream
        pngChunk(out, "IEND", new byte[0]);
        return out.toByteArray();
    }

    private static void pngChunk(ByteArrayOutputStream out, String type, byte[] data) throws Exception {
        DataOutputStream chunk = new DataOutputStream(out);
        byte[] name = type.getBytes(StandardCharsets.US_ASCII);
        chunk.writeInt(data.length);
        chunk.write(name);
        chunk.write(data);
        CRC32 crc = new CRC32();
        crc.update(name);
        crc.update(data);
        chunk.writeInt((int) crc.getValue());
    }

    @Test
    void shouldRefuseAPhotoWhoseHeaderClaimsAHugeSize_withoutBuildingThePicture() throws Exception {
        assertThatThrownBy(() -> service.store(pngClaiming(9000, 9000), manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("under 8000");
        assertThatThrownBy(() -> service.store(pngClaiming(100, 9000), manager))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("under 8000");
    }

    @Test
    void shouldSaveALargePhotoAtAReducedSize() throws Exception {
        LoanReceipt saved = service.store(image("png", 3200, 2400), manager);
        BufferedImage result = ImageIO.read(new ByteArrayInputStream(saved.getData()));
        assertThat(Math.max(result.getWidth(), result.getHeight())).isBetween(800, 1600);
        assertThat(saved.getSizeBytes()).isEqualTo(saved.getData().length);
    }

    @Test
    void shouldKeepASmallPhotoAtItsOwnSize() throws Exception {
        LoanReceipt saved = service.store(image("png", 30, 20), manager);
        BufferedImage result = ImageIO.read(new ByteArrayInputStream(saved.getData()));
        assertThat(result.getWidth()).isEqualTo(30);
        assertThat(result.getHeight()).isEqualTo(20);
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

    // ---- finding F-05: one receipt, one payment ----

    @Test
    void shouldRecordWhichPaymentAReceiptBelongsTo_withOneGuardedStatement() {
        LoanReceipt r = existing("mgr", null);
        UUID tx = UUID.randomUUID();
        when(repository.attachIfFree(r.getId(), tx)).thenReturn(1);

        service.attach(r, tx);

        verify(repository).attachIfFree(r.getId(), tx);
        verify(repository, never()).save(any(LoanReceipt.class));   // the whole row is never written back
    }

    @Test
    void shouldRefuseTheSecondPayment_whenAnotherPaymentGotTheReceiptFirst() {
        LoanReceipt staleCopy = existing("mgr", null);   // this request still sees the receipt as free
        UUID tx = UUID.randomUUID();
        when(repository.attachIfFree(staleCopy.getId(), tx)).thenReturn(0);

        assertThatThrownBy(() -> service.attach(staleCopy, tx))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("already used by another payment");
        assertThat(staleCopy.getTransactionId()).as("the copy is not changed").isNull();
    }

    private LoanReceipt attachedWithTheseBytes(byte[] data) {
        return LoanReceipt.builder().id(UUID.randomUUID()).uploadedBy("mgr").transactionId(UUID.randomUUID())
                .contentType("image/jpeg").sizeBytes((long) data.length).data(data).build();
    }

    @Test
    void shouldRefuseAPhotoThatIsTheSameAsOneAlreadyAttachedToAPayment() throws Exception {
        byte[] photo = image("png", 30, 20);
        byte[] saved = service.store(photo, manager).getData();
        when(repository.findAttachedWithSize(saved.length)).thenReturn(List.of(attachedWithTheseBytes(saved.clone())));

        assertThatThrownBy(() -> service.store(photo, other))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("already attached to a payment");
    }

    @Test
    void shouldKeepAPhotoOfTheSameSizeButDifferentContent() throws Exception {
        byte[] photo = image("png", 30, 20);
        byte[] saved = service.store(photo, manager).getData();
        byte[] otherContent = saved.clone();
        otherContent[otherContent.length - 3] ^= 0x55;
        when(repository.findAttachedWithSize(saved.length)).thenReturn(List.of(attachedWithTheseBytes(otherContent)));

        assertThat(service.store(photo, other).getUploadedBy()).isEqualTo("mgr2");
    }

    @Test
    void shouldKeepAPhotoNobodyHasAttached() throws Exception {
        when(repository.findAttachedWithSize(org.mockito.ArgumentMatchers.anyLong())).thenReturn(List.of());

        assertThat(service.store(image("png", 30, 20), manager).getId()).isNotNull();
    }

    @Test
    void shouldLookOnlyAtReceiptsOfTheSameSize() throws Exception {
        LoanReceipt saved = service.store(image("png", 30, 20), manager);

        verify(repository).findAttachedWithSize(saved.getSizeBytes());
    }

    @Test
    void shouldRecordWhoUploadedAReceiptPhoto_withoutKeepingThePhotoInTheRecord() throws Exception {
        LoanReceipt saved = service.store(image("png", 30, 20), manager);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        AuditLog row = captor.getValue();
        assertThat(row.getUser()).isSameAs(manager);
        assertThat(row.getEntityType()).isEqualTo(AuditLog.EntityType.RESOURCE);
        assertThat(row.getAction()).isEqualTo(AuditLog.AuditAction.CREATE);
        assertThat(row.getEntityId()).isEqualTo(saved.getId());
        assertThat(row.getDescription()).contains("receipt").contains("mgr");
        assertThat(row.getNewValues()).doesNotContain("data");
    }

    @Test
    void shouldRecordNothing_whenThePhotoIsRefused() {
        assertThatThrownBy(() -> service.store("<svg/>".getBytes(), manager)).isInstanceOf(IllegalArgumentException.class);

        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }
}

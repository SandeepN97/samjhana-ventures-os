package com.samjhana.service;

import com.samjhana.entity.LoanReceipt;
import com.samjhana.entity.User;
import com.samjhana.repository.LoanReceiptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * Keeps the bank-receipt photos for loan payments. A photo is accepted only when its own bytes say it is a JPEG
 * or PNG of a sane size, then it is decoded and saved again as a plain JPEG: that proves it is a real picture
 * and drops everything hidden inside the file (phone location, camera details).
 */
@Service
@RequiredArgsConstructor
public class LoanReceiptService {

    public static final int MAX_BYTES = MediaService.MAX_BYTES;
    private static final int MAX_PIXELS_PER_SIDE = MediaService.MAX_PIXELS_PER_SIDE;
    private static final float JPEG_QUALITY = 0.85f;

    private final LoanReceiptRepository receiptRepository;

    @Transactional
    public LoanReceipt store(MultipartFile file, User uploader) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Choose a photo of the bank receipt");
        if (file.getSize() > MAX_BYTES) throw new IllegalArgumentException("The photo is larger than 3 MB");
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("The photo could not be read");
        }
        return store(bytes, uploader);
    }

    @Transactional
    public LoanReceipt store(byte[] bytes, User uploader) {
        if (bytes == null || bytes.length == 0) throw new IllegalArgumentException("Choose a photo of the bank receipt");
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("The photo is larger than 3 MB");
        String type = MediaService.detectType(bytes);
        if (!"image/jpeg".equals(type) && !"image/png".equals(type)) {
            throw new IllegalArgumentException("The receipt photo must be a JPEG or PNG picture");
        }
        byte[] clean = resave(bytes);
        return receiptRepository.save(LoanReceipt.builder()
                .contentType("image/jpeg").sizeBytes((long) clean.length)
                .uploadedBy(uploader.getUsername()).data(clean).build());
    }

    public Optional<LoanReceipt> find(UUID id) {
        return receiptRepository.findByIdAndDeletedAtIsNull(id);
    }

    /**
     * Checks that a receipt can go on a payment being saved now: it exists, is not removed, belongs to nobody
     * else's payment, and was uploaded by the person saving the payment (an admin may use any unattached one).
     */
    public LoanReceipt requireAttachable(Object rawId, User user) {
        UUID id = MediaService.parseId(rawId);
        if (id == null) throw new IllegalArgumentException("Receipt photo not found; upload it again");
        LoanReceipt receipt = find(id)
                .orElseThrow(() -> new IllegalArgumentException("Receipt photo not found; upload it again"));
        if (receipt.getTransactionId() != null) {
            throw new IllegalArgumentException("That receipt photo is already used by another payment");
        }
        if (!user.isAdmin() && !receipt.getUploadedBy().equals(user.getUsername())) {
            throw new IllegalArgumentException("Receipt photo not found; upload it again");
        }
        return receipt;
    }

    @Transactional
    public void attach(LoanReceipt receipt, UUID transactionId) {
        receipt.setTransactionId(transactionId);
        receiptRepository.save(receipt);
    }

    /** Decodes the picture and writes it back as a plain JPEG (alpha flattened onto white). */
    private static byte[] resave(byte[] bytes) {
        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(bytes));
            if (source == null) throw new IllegalArgumentException("That file is not a valid picture");
            if (source.getWidth() > MAX_PIXELS_PER_SIDE || source.getHeight() > MAX_PIXELS_PER_SIDE) {
                throw new IllegalArgumentException("The photo is too large; use one under 8000 pixels wide");
            }
            BufferedImage rgb = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgb.createGraphics();
            try {
                g.setColor(Color.WHITE);
                g.fillRect(0, 0, rgb.getWidth(), rgb.getHeight());
                g.drawImage(source, 0, 0, null);
            } finally {
                g.dispose();
            }
            ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
            ImageWriteParam params = writer.getDefaultWriteParam();
            params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            params.setCompressionQuality(JPEG_QUALITY);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
                writer.setOutput(ios);
                writer.write(null, new IIOImage(rgb, null, null), params);   // no metadata passed on
            } finally {
                writer.dispose();
            }
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalArgumentException("That file is not a valid picture");
        }
    }
}

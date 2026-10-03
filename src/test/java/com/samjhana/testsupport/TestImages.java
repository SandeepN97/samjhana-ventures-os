package com.samjhana.testsupport;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/** Tiny real pictures for tests. */
public final class TestImages {

    private TestImages() {}

    public static byte[] image(String format) {
        try {
            BufferedImage img = new BufferedImage(4, 3, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, format, out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public static byte[] png() { return image("png"); }

    public static byte[] jpeg() { return image("jpg"); }
}

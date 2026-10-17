package com.samjhana.testsupport;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.zip.CRC32;

/**
 * The byte-level pieces of JPEG, PNG and WebP files, for the picture tests: build a picture with hidden details planted
 * in it, and list what a finished file is made of so a test can say exactly what must be left.
 *
 * <p>The checks here are written separately from the code under test on purpose: a test that reused the same parser
 * would agree with the same mistake.
 */
public final class PictureFixtures {

    private PictureFixtures() {}

    /** Text planted in the hidden parts of test pictures. None of it may survive an upload. */
    public static final String SECRET = "SECRET-HIDDEN-DETAIL";

    // Real encoder output (ImageMagick, 8 x 8 pixels); each one also decodes in ffmpeg. The animated one has two frames.
    public static final byte[] WEBP_LOSSY = Base64.getDecoder().decode(
            "UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoIAAgAAgA0JaACdLoB+AADsAD+8MQL/yC5YXXI1/8gP+QH/ID/+PIAAAA=");
    public static final byte[] WEBP_LOSSLESS = Base64.getDecoder().decode("UklGRhwAAABXRUJQVlA4TA8AAAAvB8ABAAcQ0f/+ByKi/wEA");
    public static final byte[] WEBP_WITH_TRANSPARENCY = Base64.getDecoder().decode(
            "UklGRmQAAABXRUJQVlA4WAoAAAAQAAAABwAABwAAQUxQSAwAAAABDzD/ERFiHiL6Hw9WUDggMgAAALABAJ0BKggACAACADQloALsMpVByAAA/vDEC2H/xO6iIFl/8f7PB/Lqf/K7uXiaAAAA");
    public static final byte[] WEBP_ANIMATED = Base64.getDecoder().decode(
            "UklGRsAAAABXRUJQVlA4WAoAAAACAAAABwAABwAAQU5JTQYAAAD/////AABBTk1GSAAAAAAAAAAAAAcAAAcAAGQAAAJWUDggMAAAANABAJ0BKggACAACADQloAJ0ugH4AAOwAP7wxAv/ILlhdcjX/yA/5Af8gP/48gAAAEFOTUZEAAAAAAAAAAAABwAABwAAZAAAAFZQOCAsAAAAlAEAnQEqCAAIAAAANCWgAnS6AAOYAP75k2//kB//kB//kB//ID/iF3sgMAA=");

    // ===================== JPEG =====================

    /** One JPEG segment: marker, length, payload. */
    public static byte[] jpegSegment(int marker, byte[] payload) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(0xFF);
        out.write(marker);
        int length = payload.length + 2;
        out.write(length >> 8);
        out.write(length & 0xFF);
        out.writeBytes(payload);
        return out.toByteArray();
    }

    public static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.ISO_8859_1);
    }

    public static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) out.writeBytes(part);
        return out.toByteArray();
    }

    /** The first bytes of the EXIF segment payload, then a TIFF block holding a maker name, rotation flag and a GPS position. */
    public static byte[] exifPayloadWithGps(int orientation, boolean littleEndian) {
        return concat(ascii("Exif\0\0"), tiffWithGps(orientation, littleEndian));
    }

    /** A TIFF block as cameras write it: maker name, rotation flag (1 to 8) and a GPS position (27 41' N, 85 20' E). */
    public static byte[] tiffWithGps(int orientation, boolean littleEndian) {
        ByteOrder order = littleEndian ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN;
        byte[] make = ascii(SECRET + "\0");
        int ifd0 = 8;
        int ifd0Size = 2 + 3 * 12 + 4;
        int makeOffset = ifd0 + ifd0Size;
        int gpsIfd = makeOffset + make.length + (make.length & 1);
        int gpsSize = 2 + 4 * 12 + 4;
        int gpsData = gpsIfd + gpsSize;
        ByteBuffer b = ByteBuffer.allocate(gpsData + 48).order(order);
        byte byteOrderMark = (byte) (littleEndian ? 'I' : 'M');
        b.put(byteOrderMark).put(byteOrderMark).putShort((short) 42).putInt(ifd0);

        b.position(ifd0);
        b.putShort((short) 3);
        b.putShort((short) 0x010F).putShort((short) 2).putInt(make.length).putInt(makeOffset);      // Make
        b.putShort((short) 0x0112).putShort((short) 3).putInt(1).putShort((short) orientation).putShort((short) 0);
        b.putShort((short) 0x8825).putShort((short) 4).putInt(1).putInt(gpsIfd);                    // GPS block
        b.putInt(0);
        b.position(makeOffset);
        b.put(make);

        b.position(gpsIfd);
        b.putShort((short) 4);
        b.putShort((short) 0x0001).putShort((short) 2).putInt(2).put((byte) 'N').put((byte) 0).put((byte) 0).put((byte) 0);
        b.putShort((short) 0x0002).putShort((short) 5).putInt(3).putInt(gpsData);
        b.putShort((short) 0x0003).putShort((short) 2).putInt(2).put((byte) 'E').put((byte) 0).put((byte) 0).put((byte) 0);
        b.putShort((short) 0x0004).putShort((short) 5).putInt(3).putInt(gpsData + 24);
        b.putInt(0);

        b.position(gpsData);
        for (int[] rational : new int[][]{{27, 1}, {41, 1}, {0, 1}, {85, 1}, {20, 1}, {0, 1}}) {
            b.putInt(rational[0]).putInt(rational[1]);
        }
        return b.array();
    }

    public static byte[] exifSegment(int orientation, boolean littleEndian) {
        return jpegSegment(0xE1, exifPayloadWithGps(orientation, littleEndian));
    }

    public static byte[] xmpSegment() {
        return jpegSegment(0xE1, ascii("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>" + SECRET + "</x:xmpmeta>"));
    }

    public static byte[] photoshopSegment() {
        return jpegSegment(0xED, ascii("Photoshop 3.0\0" + SECRET));
    }

    public static byte[] commentSegment() {
        return jpegSegment(0xFE, ascii("taken with " + SECRET));
    }

    /** A colour profile segment (the profile itself is made-up bytes: only the wrapper matters to these tests). */
    public static byte[] iccSegment() {
        byte[] profile = new byte[300];
        for (int i = 0; i < profile.length; i++) profile[i] = (byte) (i * 7);
        return jpegSegment(0xE2, concat(ascii("ICC_PROFILE\0"), new byte[]{1, 1}, profile));
    }

    /** The "several pictures in one file" segment some phones write; it can hold a second, hidden picture. */
    public static byte[] multiPictureSegment() {
        return jpegSegment(0xE2, ascii("MPF\0" + SECRET));
    }

    /** The colour-handling segment CMYK and Photoshop files carry. */
    public static byte[] adobeSegment() {
        return jpegSegment(0xEE, new byte[]{'A', 'd', 'o', 'b', 'e', 0, 100, 0, 0, 0, 0, 1});
    }

    /** A JFIF header that also carries a tiny 2 x 2 preview picture. */
    public static byte[] jfifSegmentWithPreview() {
        byte[] preview = new byte[12];
        for (int i = 0; i < preview.length; i++) preview[i] = (byte) (200 + i);
        return jpegSegment(0xE0, concat(ascii("JFIF\0"), new byte[]{1, 2, 1, 0, 72, 0, 72, 2, 2}, preview));
    }

    /** The picture with extra segments placed straight after its start marker, and optional bytes after its end. */
    public static byte[] jpegPlanting(byte[] jpeg, byte[] trailing, byte[]... segments) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, 2);
        for (byte[] segment : segments) out.writeBytes(segment);
        out.write(jpeg, 2, jpeg.length - 2);
        out.writeBytes(trailing);
        return out.toByteArray();
    }

    /** The picture without its leading JFIF header (cameras and the starter pictures often have none). */
    public static byte[] jpegWithoutJfif(byte[] jpeg) {
        if ((jpeg[2] & 0xFF) != 0xFF || (jpeg[3] & 0xFF) != 0xE0) return jpeg;
        int length = ((jpeg[4] & 0xFF) << 8) | (jpeg[5] & 0xFF);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, 2);
        out.write(jpeg, 4 + length, jpeg.length - (4 + length));   // the header is 2 marker bytes + its declared length
        return out.toByteArray();
    }

    /**
     * The marker codes of a JPEG in file order, not counting the picture data between them (a reference reader, written
     * apart from the one under test). Stops at the end marker.
     */
    public static List<Integer> jpegMarkers(byte[] jpeg) {
        List<Integer> markers = new ArrayList<>();
        int pos = 2;
        markers.add(0xD8);
        while (pos < jpeg.length) {
            while (pos < jpeg.length && (jpeg[pos] & 0xFF) == 0xFF && pos + 1 < jpeg.length && (jpeg[pos + 1] & 0xFF) == 0xFF) pos++;
            int marker = jpeg[pos + 1] & 0xFF;
            markers.add(marker);
            if (marker == 0xD9) break;
            int length = ((jpeg[pos + 2] & 0xFF) << 8) | (jpeg[pos + 3] & 0xFF);
            pos += 2 + length;
            if (marker == 0xDA) {
                while (pos + 1 < jpeg.length) {
                    int next = jpeg[pos + 1] & 0xFF;
                    if ((jpeg[pos] & 0xFF) == 0xFF && next != 0x00 && !(next >= 0xD0 && next <= 0xD7) && next != 0xFF) break;
                    pos++;
                }
            }
        }
        return markers;
    }

    /** Everything from the first scan header to the end marker (the picture data itself). */
    public static byte[] jpegScanData(byte[] jpeg) {
        int start = indexOf(jpeg, new byte[]{(byte) 0xFF, (byte) 0xDA});
        return java.util.Arrays.copyOfRange(jpeg, start, jpeg.length);
    }

    /** Where the first segment with this marker starts (the position of its 0xFF byte), looking only before the picture data; -1 when there is none. */
    public static int jpegSegmentOffset(byte[] jpeg, int marker) {
        int pos = 2;
        while (pos + 3 < jpeg.length) {
            int code = jpeg[pos + 1] & 0xFF;
            if (code == marker) return pos;
            if (code == 0xD9 || code == 0xDA) return -1;
            int length = ((jpeg[pos + 2] & 0xFF) << 8) | (jpeg[pos + 3] & 0xFF);
            pos += 2 + length;
        }
        return -1;
    }

    /** The payload of the first segment with this marker, or null. */
    public static byte[] jpegSegmentPayload(byte[] jpeg, int marker) {
        int pos = jpegSegmentOffset(jpeg, marker);
        if (pos < 0) return null;
        int length = ((jpeg[pos + 2] & 0xFF) << 8) | (jpeg[pos + 3] & 0xFF);
        return java.util.Arrays.copyOfRange(jpeg, pos + 4, pos + 2 + length);
    }

    /** The tag numbers in the first block of a TIFF structure, in file order. */
    public static List<Integer> tiffTags(byte[] tiff) {
        ByteBuffer b = ByteBuffer.wrap(tiff).order(tiff[0] == 'I' ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN);
        int ifd = b.getInt(4);
        int count = b.getShort(ifd) & 0xFFFF;
        List<Integer> tags = new ArrayList<>();
        for (int i = 0; i < count; i++) tags.add(b.getShort(ifd + 2 + i * 12) & 0xFFFF);
        return tags;
    }

    /** The rotation flag (1 to 8) stored in a TIFF structure, or 0 when there is none. */
    public static int tiffOrientation(byte[] tiff) {
        ByteBuffer b = ByteBuffer.wrap(tiff).order(tiff[0] == 'I' ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN);
        int ifd = b.getInt(4);
        int count = b.getShort(ifd) & 0xFFFF;
        for (int i = 0; i < count; i++) {
            int at = ifd + 2 + i * 12;
            if ((b.getShort(at) & 0xFFFF) == 0x0112) return b.getShort(at + 8) & 0xFFFF;
        }
        return 0;
    }

    // ===================== PNG =====================

    /** One PNG chunk with a correct checksum. */
    public static byte[] pngChunk(String type, byte[] data) {
        ByteBuffer b = ByteBuffer.allocate(12 + data.length);
        b.putInt(data.length).put(ascii(type)).put(data);
        CRC32 crc = new CRC32();
        crc.update(ascii(type));
        crc.update(data);
        b.putInt((int) crc.getValue());
        return b.array();
    }

    /** The picture with extra chunks placed right after its header chunk, and optional bytes after its end. */
    public static byte[] pngPlanting(byte[] png, byte[] trailing, byte[]... chunks) {
        int afterHeader = 8 + 12 + 13;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(png, 0, afterHeader);
        for (byte[] chunk : chunks) out.writeBytes(chunk);
        out.write(png, afterHeader, png.length - afterHeader);
        out.writeBytes(trailing);
        return out.toByteArray();
    }

    /** The chunk types of a PNG in file order, up to and including the last one. */
    public static List<String> pngChunkTypes(byte[] png) {
        List<String> types = new ArrayList<>();
        int pos = 8;
        while (pos + 8 <= png.length) {
            int length = ByteBuffer.wrap(png, pos, 4).getInt();
            String type = new String(png, pos + 4, 4, StandardCharsets.ISO_8859_1);
            types.add(type);
            pos += 12 + length;
            if (type.equals("IEND")) break;
        }
        return types;
    }

    /** The data of the first chunk of this type, or null. */
    public static byte[] pngChunkData(byte[] png, String wanted) {
        int pos = 8;
        while (pos + 8 <= png.length) {
            int length = ByteBuffer.wrap(png, pos, 4).getInt();
            String type = new String(png, pos + 4, 4, StandardCharsets.ISO_8859_1);
            if (type.equals(wanted)) return java.util.Arrays.copyOfRange(png, pos + 8, pos + 8 + length);
            pos += 12 + length;
        }
        return null;
    }

    // ===================== WebP =====================

    /** One WebP chunk: name, little-endian size, data, and the padding byte an odd size needs. */
    public static byte[] webpChunk(String fourcc, byte[] data) {
        ByteBuffer b = ByteBuffer.allocate(8 + data.length + (data.length & 1)).order(ByteOrder.LITTLE_ENDIAN);
        b.put(ascii(fourcc)).putInt(data.length).put(data);
        return b.array();
    }

    /** A WebP file made of these chunks, with the size in its header worked out. */
    public static byte[] riff(byte[]... chunks) {
        byte[] body = concat(chunks);
        ByteBuffer b = ByteBuffer.allocate(12 + body.length).order(ByteOrder.LITTLE_ENDIAN);
        b.put(ascii("RIFF")).putInt(4 + body.length).put(ascii("WEBP")).put(body);
        return b.array();
    }

    /** The extended-format header chunk (flags: 0x20 colour profile, 0x10 transparency, 0x08 EXIF, 0x04 XMP, 0x02 animation). */
    public static byte[] webpHeaderChunk(int flags, int width, int height) {
        ByteBuffer b = ByteBuffer.allocate(10).order(ByteOrder.LITTLE_ENDIAN);
        b.put((byte) flags).put(new byte[3]);
        b.put((byte) ((width - 1) & 0xFF)).put((byte) (((width - 1) >> 8) & 0xFF)).put((byte) (((width - 1) >> 16) & 0xFF));
        b.put((byte) ((height - 1) & 0xFF)).put((byte) (((height - 1) >> 8) & 0xFF)).put((byte) (((height - 1) >> 16) & 0xFF));
        return webpChunk("VP8X", b.array());
    }

    /** The picture data chunk (and nothing else) of a plain, single-chunk WebP such as {@link #WEBP_LOSSY}. */
    public static byte[] webpPictureChunk(byte[] simpleWebp) {
        return java.util.Arrays.copyOfRange(simpleWebp, 12, simpleWebp.length);
    }

    /** The chunk names of a WebP in file order. */
    public static List<String> webpChunkTypes(byte[] webp) {
        List<String> types = new ArrayList<>();
        int pos = 12;
        while (pos + 8 <= webp.length) {
            int size = ByteBuffer.wrap(webp, pos + 4, 4).order(ByteOrder.LITTLE_ENDIAN).getInt();
            types.add(new String(webp, pos, 4, StandardCharsets.ISO_8859_1));
            pos += 8 + size + (size & 1);
        }
        return types;
    }

    /** The data of the first chunk with this name, or null. */
    public static byte[] webpChunkData(byte[] webp, String wanted) {
        int pos = 12;
        while (pos + 8 <= webp.length) {
            int size = ByteBuffer.wrap(webp, pos + 4, 4).order(ByteOrder.LITTLE_ENDIAN).getInt();
            if (new String(webp, pos, 4, StandardCharsets.ISO_8859_1).equals(wanted)) {
                return java.util.Arrays.copyOfRange(webp, pos + 8, pos + 8 + size);
            }
            pos += 8 + size + (size & 1);
        }
        return null;
    }

    // ===================== comparing pictures =====================

    /** Whether two files show exactly the same pixels (decoded by the JDK, not by the code under test). */
    public static boolean samePixels(byte[] a, byte[] b) {
        try {
            BufferedImage x = ImageIO.read(new ByteArrayInputStream(a));
            BufferedImage y = ImageIO.read(new ByteArrayInputStream(b));
            if (x == null || y == null || x.getWidth() != y.getWidth() || x.getHeight() != y.getHeight()) return false;
            for (int row = 0; row < x.getHeight(); row++) {
                for (int col = 0; col < x.getWidth(); col++) {
                    if (x.getRGB(col, row) != y.getRGB(col, row)) return false;
                }
            }
            return true;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public static boolean contains(byte[] haystack, String text) {
        return indexOf(haystack, ascii(text)) >= 0;
    }

    public static int indexOf(byte[] haystack, byte[] needle) {
        outer:
        for (int i = 0; i + needle.length <= haystack.length; i++) {
            for (int j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) continue outer;
            }
            return i;
        }
        return -1;
    }
}

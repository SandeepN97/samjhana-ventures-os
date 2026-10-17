package com.samjhana.service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.CRC32;

/**
 * Cuts the hidden details out of a picture file and leaves the picture alone (finding P0-05).
 *
 * <p>Cameras and editors write more into a file than the picture: the GPS position, the phone's make and model, the time,
 * serial numbers, notes, a small preview of the uncropped photo, sometimes a second picture or a whole video after the end
 * of the file. The public picture link hands the stored file to anyone, so none of that may be kept.
 *
 * <p>The file is read as the list of pieces it is made of, and only the pieces needed to show it are written out again:
 * <ul>
 *   <li><b>JPEG</b>: the picture's own segments, a plain JFIF header (its little preview picture is dropped), the colour
 *       profile and the Adobe colour marker. Everything after the end marker is dropped.</li>
 *   <li><b>PNG</b>: the header, palette, transparency, colour chunks (the small ones only at their fixed size) and picture
 *       data. Text, EXIF, time and unknown chunks are dropped, and so is anything after the end chunk.</li>
 *   <li><b>WebP</b>: the header, colour profile, transparency and picture data. EXIF, XMP and unknown chunks are dropped.</li>
 * </ul>
 * The one thing kept from EXIF is the rotation flag (1 to 8), written as a tiny EXIF block of its own: phones store a
 * portrait photo sideways and only mark it as turned, so without the flag every such photo would show on its side.
 *
 * <p>The picture data itself is copied byte for byte: nothing is decoded or re-encoded, so there is no loss of quality, no
 * memory spent on the pixels, and no image-decoding code runs on what was uploaded. A file that does not parse cleanly
 * (cut off, junk between its pieces, a wrong checksum, an impossible size) is refused instead of being passed on as it is,
 * so what is stored is always a file this class understood. Animated pictures are refused, and so is any side longer than
 * {@link MediaService#MAX_PIXELS_PER_SIDE}.
 */
public final class ImageMetadataStripper {

    private static final String NOT_VALID = "That file is not a valid picture";
    private static final String ANIMATED = "Animated pictures are not accepted; upload a still picture";
    private static final String TOO_LARGE = "The picture is too large; use one under 8000 pixels wide";

    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    private static final int WEBP_HEADER_BYTES = 12;
    private static final int WEBP_FLAG_PROFILE = 0x20;
    private static final int WEBP_FLAG_TRANSPARENCY = 0x10;
    private static final int WEBP_FLAG_EXIF = 0x08;
    private static final int WEBP_FLAG_ANIMATION = 0x02;

    private ImageMetadataStripper() {}

    /**
     * The same picture without its hidden details. {@code contentType} is what {@link MediaService#detectType} found from the
     * file's own first bytes.
     *
     * @throws IllegalArgumentException when the file is not a whole, still, reasonably sized picture of that kind
     */
    public static byte[] strip(byte[] bytes, String contentType) {
        try {
            return switch (contentType) {
                case "image/jpeg" -> stripJpeg(bytes);
                case "image/png" -> stripPng(bytes);
                case "image/webp" -> stripWebp(bytes);
                default -> throw new IllegalArgumentException("Only JPEG, PNG or WebP pictures can be uploaded");
            };
        } catch (IndexOutOfBoundsException e) {
            // Every read below is bounds-checked first; this only turns a missed check on a hostile file into a refusal.
            throw invalid();
        }
    }

    // ===================== JPEG =====================

    private static byte[] stripJpeg(byte[] in) {
        if (in.length < 4 || u8(in, 0) != 0xFF || u8(in, 1) != 0xD8) throw invalid();
        ByteArrayOutputStream body = new ByteArrayOutputStream(in.length);
        byte[] jfif = null;
        int orientation = 1;
        boolean sawExif = false;
        boolean sawFrame = false;
        boolean sawScan = false;
        int pos = 2;
        while (true) {
            if (pos >= in.length || u8(in, pos) != 0xFF) throw invalid();
            while (pos < in.length && u8(in, pos) == 0xFF) pos++;               // fill bytes may come before a marker
            if (pos >= in.length) throw invalid();
            int marker = u8(in, pos);
            int segmentStart = pos - 1;
            pos++;
            if (marker == 0xD9) {                                               // end of the picture: nothing after it is kept
                if (!sawScan) throw invalid();
                break;
            }
            if (marker == 0x00 || marker == 0x01 || marker == 0xD8 || (marker >= 0xD0 && marker <= 0xD7)) throw invalid();
            if (pos + 2 > in.length) throw invalid();
            int length = u16be(in, pos);
            if (length < 2 || pos + length > in.length) throw invalid();
            int dataStart = pos + 2;
            int segmentEnd = pos + length;
            switch (marker) {
                case 0xE0 -> {                                                   // JFIF header: kept without its preview picture
                    if (jfif == null && length >= 16 && startsWith(in, dataStart, "JFIF\0")) jfif = jfifWithoutPreview(in, dataStart);
                }
                case 0xE1 -> {                                                   // EXIF and XMP: only the rotation flag survives
                    if (!sawExif && startsWith(in, dataStart, "Exif\0\0")) {
                        sawExif = true;
                        orientation = readOrientation(in, dataStart + 6, segmentEnd);
                    }
                }
                case 0xE2 -> {                                                   // colour profile kept; the "several pictures" block is not
                    if (startsWith(in, dataStart, "ICC_PROFILE\0")) body.write(in, segmentStart, segmentEnd - segmentStart);
                }
                case 0xEE -> {                                                   // Adobe colour marker (needed to show CMYK files right)
                    if (length == 14 && startsWith(in, dataStart, "Adobe")) body.write(in, segmentStart, segmentEnd - segmentStart);
                }
                case 0xC0, 0xC1, 0xC2 -> {                                       // the picture's size and layout
                    if (sawFrame || length < 8) throw invalid();
                    int components = u8(in, dataStart + 5);
                    int height = u16be(in, dataStart + 1);
                    int width = u16be(in, dataStart + 3);
                    if (u8(in, dataStart) != 8 || width == 0 || height == 0
                            || (components != 1 && components != 3 && components != 4) || length != 8 + 3 * components) {
                        throw invalid();
                    }
                    requireWithinLimit(width, height);
                    body.write(in, segmentStart, segmentEnd - segmentStart);
                    sawFrame = true;
                }
                case 0xC4, 0xDB, 0xDD -> body.write(in, segmentStart, segmentEnd - segmentStart);   // tables and restart interval
                case 0xDA -> {                                                   // the picture data itself, copied as it is
                    if (!sawFrame) throw invalid();
                    int scanEnd = endOfScan(in, segmentEnd);
                    body.write(in, segmentStart, scanEnd - segmentStart);
                    sawScan = true;
                    pos = scanEnd;
                    continue;
                }
                default -> {
                    // Other kinds of JPEG (lossless, arithmetic-coded, hierarchical) cannot be shown by browsers.
                    if (marker >= 0xC3 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC) throw invalid();
                    // Every other segment (other APPn, comments, extensions) is dropped.
                }
            }
            pos = segmentEnd;
        }
        if (!sawFrame) throw invalid();

        ByteArrayOutputStream out = new ByteArrayOutputStream(body.size() + 64);
        out.write(0xFF);
        out.write(0xD8);
        if (jfif != null) out.writeBytes(jfif);
        if (orientation > 1) {
            byte[] tiff = rotationFlagOnly(orientation);
            int length = 2 + 6 + tiff.length;
            out.write(0xFF);
            out.write(0xE1);
            out.write(length >> 8);
            out.write(length & 0xFF);
            out.writeBytes(new byte[]{'E', 'x', 'i', 'f', 0, 0});
            out.writeBytes(tiff);
        }
        out.writeBytes(body.toByteArray());
        out.write(0xFF);
        out.write(0xD9);
        return out.toByteArray();
    }

    /** Where the picture data of one scan stops: at the next real marker (stuffed bytes and restart markers belong to the data). */
    private static int endOfScan(byte[] in, int from) {
        int p = from;
        while (true) {
            if (p >= in.length) throw invalid();
            if (u8(in, p) != 0xFF) {
                p++;
                continue;
            }
            if (p + 1 >= in.length) throw invalid();
            int next = u8(in, p + 1);
            if (next == 0x00 || (next >= 0xD0 && next <= 0xD7)) {
                p += 2;
                continue;
            }
            if (next == 0xFF) {
                p++;
                continue;
            }
            return p;
        }
    }

    /** A standard 16-byte JFIF header with the source's version and pixel density, and no preview picture. */
    private static byte[] jfifWithoutPreview(byte[] in, int dataStart) {
        return new byte[]{(byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F', 0,
                in[dataStart + 5], in[dataStart + 6], in[dataStart + 7],
                in[dataStart + 8], in[dataStart + 9], in[dataStart + 10], in[dataStart + 11], 0, 0};
    }

    // ===================== PNG =====================

    private static byte[] stripPng(byte[] in) {
        if (in.length < 8 + 12 || !matches(in, 0, PNG_SIGNATURE)) throw invalid();
        ByteArrayOutputStream out = new ByteArrayOutputStream(in.length);
        out.write(in, 0, 8);
        boolean first = true;
        boolean sawData = false;
        boolean sawEnd = false;
        int pos = 8;
        while (pos < in.length && !sawEnd) {
            if (in.length - pos < 12) throw invalid();
            long length = u32be(in, pos);
            if (length > in.length - pos - 12) throw invalid();
            int dataStart = pos + 8;
            int dataEnd = dataStart + (int) length;
            int next = dataEnd + 4;
            String type = new String(in, pos + 4, 4, StandardCharsets.ISO_8859_1);
            for (int i = 0; i < 4; i++) {
                if (!Character.isLetter((char) u8(in, pos + 4 + i)) || u8(in, pos + 4 + i) > 0x7A) throw invalid();
            }
            if (first != type.equals("IHDR")) throw invalid();
            boolean keep;
            switch (type) {
                case "IHDR" -> {
                    if (length != 13) throw invalid();
                    long width = u32be(in, dataStart);
                    long height = u32be(in, dataStart + 4);
                    if (width == 0 || height == 0) throw invalid();
                    requireWithinLimit(width, height);
                    keep = true;
                }
                case "IDAT" -> {
                    sawData = true;
                    keep = true;
                }
                case "IEND" -> {
                    if (length != 0) throw invalid();
                    sawEnd = true;
                    keep = true;
                }
                case "PLTE", "tRNS", "iCCP" -> keep = true;
                // The small colour chunks have a fixed size; one of any other size is dropped, not carried along.
                case "gAMA", "cICP" -> keep = length == 4;
                case "sRGB" -> keep = length == 1;
                case "cHRM" -> keep = length == 32;
                case "acTL", "fcTL", "fdAT" -> throw new IllegalArgumentException(ANIMATED);
                default -> {
                    if (Character.isUpperCase(type.charAt(0))) throw invalid();       // a required chunk this code does not know
                    keep = false;                                                      // text, EXIF, time, size and any private chunk
                }
            }
            if (keep) {
                CRC32 crc = new CRC32();
                crc.update(in, pos + 4, 4 + (int) length);
                if (crc.getValue() != u32be(in, dataEnd)) throw invalid();
                out.write(in, pos, next - pos);
            }
            first = false;
            pos = next;
        }
        if (!sawEnd || !sawData) throw invalid();
        return out.toByteArray();
    }

    // ===================== WebP =====================

    private record Chunk(String name, int dataStart, int size) {}

    private static byte[] stripWebp(byte[] in) {
        if (in.length < WEBP_HEADER_BYTES + 8 || !startsWith(in, 0, "RIFF") || !startsWith(in, 8, "WEBP")) throw invalid();
        long riffSize = u32le(in, 4);
        if (riffSize < 4 + 8 || riffSize + 8 > in.length) throw invalid();
        int end = (int) riffSize + 8;                                              // anything after this is not part of the picture

        List<Chunk> chunks = new ArrayList<>();
        int pos = WEBP_HEADER_BYTES;
        while (pos < end) {
            if (end - pos < 8) throw invalid();
            long size = u32le(in, pos + 4);
            int dataStart = pos + 8;
            if (size > end - dataStart) throw invalid();
            chunks.add(new Chunk(new String(in, pos, 4, StandardCharsets.ISO_8859_1), dataStart, (int) size));
            pos = (int) Math.min((long) dataStart + size + (size & 1), end);        // chunks are padded to an even size
        }
        if (chunks.isEmpty()) throw invalid();

        Chunk header = null;
        Chunk picture = null;
        Chunk transparency = null;
        Chunk profile = null;
        Chunk exif = null;
        for (Chunk chunk : chunks) {
            switch (chunk.name()) {
                case "VP8X" -> {
                    if (chunk != chunks.get(0)) throw invalid();
                    header = chunk;
                }
                case "VP8 ", "VP8L" -> {
                    if (picture != null) throw invalid();
                    picture = chunk;
                }
                case "ALPH" -> {
                    if (transparency != null) throw invalid();
                    transparency = chunk;
                }
                case "ICCP" -> {
                    if (profile != null) throw invalid();
                    profile = chunk;
                }
                case "EXIF" -> {
                    if (exif == null) exif = chunk;
                }
                case "ANIM", "ANMF" -> throw new IllegalArgumentException(ANIMATED);
                default -> { /* XMP and chunks nobody asked for are dropped */ }
            }
        }
        String firstName = chunks.get(0).name();
        if (!firstName.equals("VP8X") && !firstName.equals("VP8 ") && !firstName.equals("VP8L")) throw invalid();

        int flags = 0;
        if (header != null) {
            if (header.size() != 10) throw invalid();
            flags = u8(in, header.dataStart());
            if ((flags & WEBP_FLAG_ANIMATION) != 0) throw new IllegalArgumentException(ANIMATED);
            requireWithinLimit(u24le(in, header.dataStart() + 4) + 1L, u24le(in, header.dataStart() + 7) + 1L);
        }
        if (picture == null) throw invalid();
        checkWebpPicture(in, picture);
        if (transparency != null && picture.name().equals("VP8L")) throw invalid();

        ByteArrayOutputStream body = new ByteArrayOutputStream(in.length);
        if (header == null) {
            writeChunk(body, in, picture);
        } else {
            int orientation = 1;
            if (exif != null) {
                int exifStart = startsWith(in, exif.dataStart(), "Exif\0\0") && exif.size() >= 6 ? exif.dataStart() + 6 : exif.dataStart();
                orientation = readOrientation(in, exifStart, exif.dataStart() + exif.size());
            }
            boolean keepProfile = profile != null && (flags & WEBP_FLAG_PROFILE) != 0;
            int keptFlags = flags & WEBP_FLAG_TRANSPARENCY;
            if (keepProfile) keptFlags |= WEBP_FLAG_PROFILE;
            if (orientation > 1) keptFlags |= WEBP_FLAG_EXIF;

            body.writeBytes(new byte[]{'V', 'P', '8', 'X', 10, 0, 0, 0, (byte) keptFlags, 0, 0, 0});
            body.write(in, header.dataStart() + 4, 6);                             // canvas width and height
            if (keepProfile) writeChunk(body, in, profile);
            if (transparency != null) writeChunk(body, in, transparency);
            writeChunk(body, in, picture);
            if (orientation > 1) {
                byte[] tiff = rotationFlagOnly(orientation);
                body.writeBytes(new byte[]{'E', 'X', 'I', 'F', (byte) tiff.length, 0, 0, 0});
                body.writeBytes(tiff);
            }
        }
        int riffLength = 4 + body.size();
        ByteArrayOutputStream out = new ByteArrayOutputStream(12 + body.size());
        out.writeBytes(new byte[]{'R', 'I', 'F', 'F', (byte) riffLength, (byte) (riffLength >> 8), (byte) (riffLength >> 16),
                (byte) (riffLength >> 24), 'W', 'E', 'B', 'P'});
        out.writeBytes(body.toByteArray());
        return out.toByteArray();
    }

    /** The picture data chunk must start the way a real WebP picture does, and must not be too big. */
    private static void checkWebpPicture(byte[] in, Chunk picture) {
        int start = picture.dataStart();
        long width;
        long height;
        if (picture.name().equals("VP8 ")) {
            if (picture.size() < 10) throw invalid();
            boolean keyFrame = (u8(in, start) & 0x01) == 0;
            if (!keyFrame || u8(in, start + 3) != 0x9D || u8(in, start + 4) != 0x01 || u8(in, start + 5) != 0x2A) throw invalid();
            width = u16le(in, start + 6) & 0x3FFF;
            height = u16le(in, start + 8) & 0x3FFF;
            if (width == 0 || height == 0) throw invalid();
        } else {
            if (picture.size() < 5 || u8(in, start) != 0x2F) throw invalid();
            long bits = u32le(in, start + 1);
            if (((bits >> 29) & 0x7) != 0) throw invalid();
            width = (bits & 0x3FFF) + 1;
            height = ((bits >> 14) & 0x3FFF) + 1;
        }
        requireWithinLimit(width, height);
    }

    private static void writeChunk(ByteArrayOutputStream out, byte[] in, Chunk chunk) {
        out.write(in, chunk.dataStart() - 8, 8);
        out.write(in, chunk.dataStart(), chunk.size());
        if ((chunk.size() & 1) == 1) out.write(0);
    }

    // ===================== the rotation flag =====================

    /**
     * The rotation flag (2 to 8) from a TIFF block as EXIF stores it, or 1 ("upright") when there is none or the block is
     * not readable. Only this one value is ever taken from the block.
     */
    private static int readOrientation(byte[] in, int from, int to) {
        if (to > in.length || to - from < 8) return 1;
        boolean little;
        if (in[from] == 'I' && in[from + 1] == 'I') little = true;
        else if (in[from] == 'M' && in[from + 1] == 'M') little = false;
        else return 1;
        if (u16(in, from + 2, little) != 42) return 1;
        long directory = u32(in, from + 4, little);
        if (directory < 8 || directory + 2 > to - from) return 1;
        int dir = from + (int) directory;
        int entries = Math.min(u16(in, dir, little), (to - dir - 2) / 12);
        for (int i = 0; i < entries; i++) {
            int entry = dir + 2 + i * 12;
            if (u16(in, entry, little) != 0x0112) continue;
            if (u16(in, entry + 2, little) != 3 || u32(in, entry + 4, little) != 1) return 1;
            int value = u16(in, entry + 8, little);
            return value >= 2 && value <= 8 ? value : 1;
        }
        return 1;
    }

    /** A TIFF block holding the rotation flag and nothing else. */
    private static byte[] rotationFlagOnly(int orientation) {
        return new byte[]{'M', 'M', 0, 42, 0, 0, 0, 8,
                0, 1,
                0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, (byte) orientation, 0, 0,
                0, 0, 0, 0};
    }

    // ===================== small helpers =====================

    private static void requireWithinLimit(long width, long height) {
        if (width > MediaService.MAX_PIXELS_PER_SIDE || height > MediaService.MAX_PIXELS_PER_SIDE) {
            throw new IllegalArgumentException(TOO_LARGE);
        }
    }

    private static IllegalArgumentException invalid() {
        return new IllegalArgumentException(NOT_VALID);
    }

    private static boolean startsWith(byte[] in, int at, String text) {
        return matches(in, at, text.getBytes(StandardCharsets.ISO_8859_1));
    }

    private static boolean matches(byte[] in, int at, byte[] expected) {
        if (at < 0 || at + expected.length > in.length) return false;
        for (int i = 0; i < expected.length; i++) {
            if (in[at + i] != expected[i]) return false;
        }
        return true;
    }

    private static int u8(byte[] b, int i) {
        return b[i] & 0xFF;
    }

    private static int u16be(byte[] b, int i) {
        return (u8(b, i) << 8) | u8(b, i + 1);
    }

    private static int u16le(byte[] b, int i) {
        return u8(b, i) | (u8(b, i + 1) << 8);
    }

    private static int u16(byte[] b, int i, boolean little) {
        return little ? u16le(b, i) : u16be(b, i);
    }

    private static int u24le(byte[] b, int i) {
        return u8(b, i) | (u8(b, i + 1) << 8) | (u8(b, i + 2) << 16);
    }

    private static long u32be(byte[] b, int i) {
        return ((long) u8(b, i) << 24) | ((long) u8(b, i + 1) << 16) | ((long) u8(b, i + 2) << 8) | u8(b, i + 3);
    }

    private static long u32le(byte[] b, int i) {
        return u8(b, i) | ((long) u8(b, i + 1) << 8) | ((long) u8(b, i + 2) << 16) | ((long) u8(b, i + 3) << 24);
    }

    private static long u32(byte[] b, int i, boolean little) {
        return little ? u32le(b, i) : u32be(b, i);
    }
}

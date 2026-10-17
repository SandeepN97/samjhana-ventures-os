package com.samjhana.service;

import com.samjhana.testsupport.TestImages;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.image.BufferedImage;
import java.awt.image.IndexColorModel;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;

import static com.samjhana.testsupport.PictureFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Finding P0-05: an uploaded picture keeps whatever its camera or editor wrote into the file (GPS position, phone
 * model, time, notes), and the public picture link hands it to anyone. These tests plant such details in real pictures
 * and check that only the picture, its colour profile and its rotation flag come out.
 */
class ImageMetadataStripperTest {

    private static final byte[] TRAILER = ascii("TRAILING-" + SECRET);

    private static byte[] strip(byte[] bytes, String type) {
        return ImageMetadataStripper.strip(bytes, type);
    }

    private static byte[] photo() {
        return TestImages.jpeg();
    }

    // ===================== JPEG: hidden details =====================

    @Test
    void shouldRemoveEveryHiddenDetail_fromAJpeg() {
        byte[] original = jpegPlanting(photo(), TRAILER,
                exifSegment(1, false), xmpSegment(), photoshopSegment(), commentSegment(), multiPictureSegment());
        assertThat(contains(original, SECRET)).as("the test file really holds the details").isTrue();

        byte[] clean = strip(original, "image/jpeg");

        assertThat(contains(clean, SECRET)).isFalse();
        assertThat(jpegMarkers(clean)).doesNotContain(0xE1, 0xE2, 0xED, 0xFE);
        assertThat(clean[clean.length - 2] & 0xFF).as("ends at the end marker").isEqualTo(0xFF);
        assertThat(clean[clean.length - 1] & 0xFF).isEqualTo(0xD9);
        assertThat(samePixels(photo(), clean)).isTrue();
    }

    @Test
    void shouldLeaveNoExifAtAll_whenThePhotoIsUpright() {
        byte[] clean = strip(jpegPlanting(photo(), new byte[0], exifSegment(1, true)), "image/jpeg");

        assertThat(jpegMarkers(clean)).doesNotContain(0xE1);
    }

    @ParameterizedTest
    @CsvSource({"2,false", "3,true", "5,false", "6,false", "6,true", "7,true", "8,false"})
    void shouldKeepOnlyTheRotationFlag_whenThePhotoWasTakenSideways(int orientation, boolean littleEndian) {
        byte[] original = jpegPlanting(photo(), new byte[0], exifSegment(orientation, littleEndian));

        byte[] clean = strip(original, "image/jpeg");

        assertThat(jpegMarkers(clean).stream().filter(marker -> marker == 0xE1)).hasSize(1);
        byte[] exif = jpegSegmentPayload(clean, 0xE1);
        assertThat(Arrays.copyOf(exif, 6)).isEqualTo(ascii("Exif\0\0"));
        byte[] tiff = Arrays.copyOfRange(exif, 6, exif.length);
        assertThat(tiffTags(tiff)).as("nothing but the rotation flag").containsExactly(0x0112);
        assertThat(tiffOrientation(tiff)).isEqualTo(orientation);
        assertThat(contains(clean, SECRET)).isFalse();
        assertThat(samePixels(photo(), clean)).isTrue();
    }

    @Test
    void shouldKeepTheColourProfileAndTheAdobeColourMarker() {
        byte[] icc = iccSegment();
        byte[] adobe = adobeSegment();
        byte[] original = jpegPlanting(photo(), new byte[0], exifSegment(1, false), icc, adobe);

        byte[] clean = strip(original, "image/jpeg");

        assertThat(jpegSegmentPayload(clean, 0xE2)).isEqualTo(Arrays.copyOfRange(icc, 4, icc.length));
        assertThat(jpegSegmentPayload(clean, 0xEE)).isEqualTo(Arrays.copyOfRange(adobe, 4, adobe.length));
    }

    @Test
    void shouldDropThePreviewPictureHiddenInTheJfifHeader() {
        byte[] original = jpegPlanting(jpegWithoutJfif(photo()), new byte[0], jfifSegmentWithPreview());
        assertThat(jpegSegmentPayload(original, 0xE0)).hasSize(14 + 12);

        byte[] clean = strip(original, "image/jpeg");

        byte[] jfif = jpegSegmentPayload(clean, 0xE0);
        assertThat(jfif).hasSize(14);
        assertThat(Arrays.copyOf(jfif, 5)).isEqualTo(ascii("JFIF\0"));
        assertThat(jfif[7]).as("units kept").isEqualTo((byte) 1);
        assertThat(jfif[9]).as("density kept").isEqualTo((byte) 72);
        assertThat(jfif[12]).as("no preview width").isZero();
        assertThat(jfif[13]).as("no preview height").isZero();
    }

    // ===================== JPEG: the picture itself is not touched =====================

    @Test
    void shouldCopyThePictureDataByteForByte() {
        byte[] original = jpegPlanting(photo(), new byte[0], exifSegment(6, false), commentSegment());

        byte[] clean = strip(original, "image/jpeg");

        assertThat(jpegScanData(clean)).isEqualTo(jpegScanData(original));
    }

    @Test
    void shouldKeepEveryScanOfAProgressiveJpeg() throws IOException {
        byte[] base = progressiveJpeg();
        byte[] original = jpegPlanting(base, TRAILER, exifSegment(1, false), commentSegment());
        long scans = jpegMarkers(original).stream().filter(marker -> marker == 0xDA).count();
        assertThat(scans).as("a progressive file has several scans").isGreaterThan(1);

        byte[] clean = strip(original, "image/jpeg");

        assertThat(jpegMarkers(clean).stream().filter(marker -> marker == 0xDA)).hasSize((int) scans);
        assertThat(contains(clean, SECRET)).isFalse();
        assertThat(samePixels(base, clean)).isTrue();
    }

    @Test
    void shouldAcceptAJpegWithNoJfifHeader_likeTheStarterPictures() {
        byte[] original = jpegWithoutJfif(photo());
        assertThat(jpegMarkers(original)).doesNotContain(0xE0);

        byte[] clean = strip(original, "image/jpeg");

        assertThat(clean).isEqualTo(original);
    }

    @Test
    void shouldLeaveAnAlreadyCleanJpegExactlyAsItIs() {
        assertThat(strip(photo(), "image/jpeg")).isEqualTo(photo());
    }

    @Test
    void shouldAcceptFillBytesBeforeAMarker() {
        byte[] original = photo();
        int at = jpegSegmentOffset(original, 0xDB);
        byte[] padded = concat(Arrays.copyOf(original, at), new byte[]{(byte) 0xFF, (byte) 0xFF},
                Arrays.copyOfRange(original, at + 1, original.length));
        assertThat(jpegMarkers(padded)).contains(0xDB);

        byte[] clean = strip(padded, "image/jpeg");

        assertThat(clean).as("the fill byte is not kept").isEqualTo(original);
    }

    @Test
    void shouldCopyRestartMarkersAndStuffedBytesInsideAScan() {
        byte[] original = photo();
        int scanStart = jpegSegmentOffset(original, 0xDA);
        int scanHeaderLength = ((original[scanStart + 2] & 0xFF) << 8) | (original[scanStart + 3] & 0xFF);
        byte[] picturePrefix = Arrays.copyOf(original, scanStart + 2 + scanHeaderLength);
        byte[] oddData = {0x12, (byte) 0xFF, 0x00, 0x34, (byte) 0xFF, (byte) 0xD0, 0x56, (byte) 0xFF, (byte) 0xD1, 0x78};
        byte[] synthetic = concat(picturePrefix, oddData, new byte[]{(byte) 0xFF, (byte) 0xD9});

        byte[] clean = strip(synthetic, "image/jpeg");

        assertThat(clean).isEqualTo(synthetic);
    }

    // ===================== JPEG: files that are not whole pictures =====================

    @Test
    void shouldRefuseAJpegThatIsCutOff() {
        byte[] photo = photo();
        for (int cut : new int[]{10, 2, photo.length / 2}) {
            byte[] broken = Arrays.copyOf(photo, photo.length - cut);
            assertThatThrownBy(() -> strip(broken, "image/jpeg"))
                    .as("cut %d bytes from the end", cut)
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        }
    }

    @Test
    void shouldRefuseAJpegWithJunkBetweenItsSegments() {
        byte[] photo = photo();
        byte[] broken = concat(Arrays.copyOf(photo, 20), new byte[]{0x42}, Arrays.copyOfRange(photo, 20, photo.length));
        assertThatThrownBy(() -> strip(broken, "image/jpeg"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
    }

    @Test
    void shouldRefuseAJpegWhoseSegmentRunsPastTheEndOfTheFile() {
        byte[] broken = photo();
        int at = jpegSegmentOffset(broken, 0xDB);
        broken[at + 2] = (byte) 0xFF;
        broken[at + 3] = (byte) 0xFF;
        assertThatThrownBy(() -> strip(broken, "image/jpeg"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
    }

    @Test
    void shouldRefuseAJpegWithNoPictureInIt() {
        byte[] startAndEndOnly = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xD9};
        assertThatThrownBy(() -> strip(startAndEndOnly, "image/jpeg"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
    }

    @Test
    void shouldRefuseAJpegBiggerThan8000PixelsOnEitherSide() {
        for (int[] size : new int[][]{{8001, 10}, {10, 8001}}) {
            byte[] big = jpegWithSize(photo(), size[0], size[1]);
            assertThatThrownBy(() -> strip(big, "image/jpeg"))
                    .as("%d x %d", size[0], size[1])
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("too large");
        }
        assertThat(strip(jpegWithSize(photo(), 8000, 8000), "image/jpeg")).isNotEmpty();
    }

    @Test
    void shouldRefuseAJpegThatClaimsAHeightOfZero() {
        byte[] zero = jpegWithSize(photo(), 10, 0);
        assertThatThrownBy(() -> strip(zero, "image/jpeg"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
    }

    @ParameterizedTest
    @CsvSource({"195", "197", "201", "202", "205"})
    void shouldRefuseKindsOfJpegThatBrowsersCannotShow(int sofMarker) {
        byte[] odd = photo();
        odd[jpegSegmentOffset(odd, 0xC0) + 1] = (byte) sofMarker;
        assertThatThrownBy(() -> strip(odd, "image/jpeg"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRefuseAJpegThatHasASizeButNoPictureData() {
        byte[] photo = photo();
        int scan = jpegSegmentOffset(photo, 0xDA);
        byte[] noData = concat(Arrays.copyOf(photo, scan), new byte[]{(byte) 0xFF, (byte) 0xD9});
        assertThat(jpegMarkers(noData)).contains(0xC0).doesNotContain(0xDA);

        assertThatThrownBy(() -> strip(noData, "image/jpeg"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
    }

    @Test
    void shouldUseTheFirstExifBlock_whenAFileHasTwo() {
        byte[] original = jpegPlanting(photo(), new byte[0], exifSegment(3, false), exifSegment(6, true));

        byte[] clean = strip(original, "image/jpeg");

        assertThat(jpegMarkers(clean).stream().filter(marker -> marker == 0xE1)).hasSize(1);
        byte[] exif = jpegSegmentPayload(clean, 0xE1);
        assertThat(tiffOrientation(Arrays.copyOfRange(exif, 6, exif.length))).isEqualTo(3);
    }

    @ParameterizedTest
    @CsvSource({"0", "9", "255", "65535"})
    void shouldTreatARotationValueOutsideOneToEightAsUpright(int value) {
        byte[] clean = strip(jpegPlanting(photo(), new byte[0], exifSegment(value, false)), "image/jpeg");

        assertThat(jpegMarkers(clean)).doesNotContain(0xE1);
    }

    @Test
    void shouldNotChokeOnAnExifBlockThatIsGarbled_itSimplyLeavesNoRotationFlag() {
        byte[] headerOnly = concat(ascii("Exif\0\0"), new byte[]{'M', 'M', 0, 42, 0, 0, 0, 8});
        byte[] wrongByteOrderMark = concat(ascii("Exif\0\0"), ascii("XX"), new byte[]{0, 42, 0, 0, 0, 8, 0, 1});
        byte[] directoryFarAway = concat(ascii("Exif\0\0"), new byte[]{'M', 'M', 0, 42, 0x7F, (byte) 0xFF, (byte) 0xFF, (byte) 0xFF, 0, 1});
        byte[] hugeEntryCount = concat(ascii("Exif\0\0"), new byte[]{'I', 'I', 42, 0, 8, 0, 0, 0, (byte) 0xFF, (byte) 0xFF, 1, 1});
        byte[] wrongValueType = concat(ascii("Exif\0\0"), new byte[]{'M', 'M', 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 4, 0, 0, 0, 1, 0, 6, 0, 0});
        byte[] severalValues = concat(ascii("Exif\0\0"), new byte[]{'M', 'M', 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 2, 0, 6, 0, 0});
        byte[] tooShort = ascii("Exif\0\0MM");
        byte[] notTheFullPrefix = ascii("Exif\0");
        for (byte[] payload : new byte[][]{headerOnly, wrongByteOrderMark, directoryFarAway, hugeEntryCount, wrongValueType,
                severalValues, tooShort, notTheFullPrefix}) {
            byte[] clean = strip(jpegPlanting(photo(), new byte[0], jpegSegment(0xE1, payload)), "image/jpeg");

            assertThat(jpegMarkers(clean)).doesNotContain(0xE1);
            assertThat(samePixels(photo(), clean)).isTrue();
        }
    }

    @Test
    void shouldDropAJfifHeaderThatIsTooShortToHoldWhatItClaims() {
        byte[] stub = jpegSegment(0xE0, ascii("JFIF\0\1\2"));
        byte[] original = jpegPlanting(jpegWithoutJfif(photo()), new byte[0], stub);
        assertThat(jpegMarkers(original)).contains(0xE0);

        byte[] clean = strip(original, "image/jpeg");

        assertThat(jpegMarkers(clean)).doesNotContain(0xE0);
    }

    @ParameterizedTest
    @CsvSource({"192", "194", "195", "201"})
    void shouldRefuseAJpegWithASecondPictureHeader_whateverItsKind(int kind) {
        byte[] photo = photo();
        int at = jpegSegmentOffset(photo, 0xC0);
        int end = at + 2 + (((photo[at + 2] & 0xFF) << 8) | (photo[at + 3] & 0xFF));
        byte[] second = Arrays.copyOfRange(photo, at, end);
        second[1] = (byte) kind;
        byte[] twoHeaders = concat(Arrays.copyOf(photo, end), second, Arrays.copyOfRange(photo, end, photo.length));
        assertThat(jpegMarkers(twoHeaders)).as("the test file really holds two picture headers").contains(kind);

        assertThatThrownBy(() -> strip(twoHeaders, "image/jpeg"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
    }

    @Test
    void shouldAcceptTheProgressiveKindOfJpeg() throws IOException {
        byte[] progressive = progressiveJpeg();
        assertThat(jpegSegmentOffset(progressive, 0xC2)).isPositive();
        assertThat(strip(progressive, "image/jpeg")).isNotEmpty();
    }

    // ===================== PNG =====================

    @Test
    void shouldRemoveEveryHiddenPart_fromAPng() {
        byte[] original = pngPlanting(TestImages.png(), TRAILER,
                pngChunk("tEXt", ascii("Comment\0" + SECRET)),
                pngChunk("iTXt", ascii("XML:com.adobe.xmp\0\0\0\0\0<x>" + SECRET + "</x>")),
                pngChunk("zTXt", ascii("Note\0\0" + SECRET)),
                pngChunk("eXIf", tiffWithGps(1, false)),
                pngChunk("tIME", new byte[]{7, (byte) 0xEA, 10, 17, 9, 30, 0}),
                pngChunk("pHYs", new byte[]{0, 0, 11, 19, 0, 0, 11, 19, 1}),
                pngChunk("prVt", ascii(SECRET)));
        assertThat(contains(original, SECRET)).isTrue();

        byte[] clean = strip(original, "image/png");

        assertThat(pngChunkTypes(clean)).containsExactly("IHDR", "IDAT", "IEND");
        assertThat(contains(clean, SECRET)).isFalse();
        assertThat(clean[clean.length - 1]).as("ends at the end chunk").isEqualTo((byte) 0x82);
        assertThat(samePixels(TestImages.png(), clean)).isTrue();
    }

    @Test
    void shouldKeepThePaletteTransparencyAndColourChunksOfAPng() throws IOException {
        byte[] indexed = transparentPalettePng();
        assertThat(pngChunkTypes(indexed)).contains("PLTE", "tRNS");
        byte[] gamma = pngChunk("gAMA", new byte[]{0, 1, (byte) 0x86, (byte) 0xA0});
        byte[] srgb = pngChunk("sRGB", new byte[]{0});
        byte[] primaries = pngChunk("cHRM", new byte[32]);
        byte[] codePoints = pngChunk("cICP", new byte[]{1, 13, 0, 1});
        byte[] profile = pngChunk("iCCP", ascii("profile\0\0made-up profile bytes"));

        byte[] colour = pngPlanting(indexed, new byte[0], gamma, srgb, primaries, codePoints);
        byte[] cleanColour = strip(colour, "image/png");
        assertThat(cleanColour).isEqualTo(colour);
        assertThat(samePixels(indexed, cleanColour)).as("transparent palette entries still decode the same").isTrue();

        byte[] profiled = pngPlanting(indexed, new byte[0], gamma, srgb, profile);
        assertThat(strip(profiled, "image/png")).isEqualTo(profiled);
    }

    @Test
    void shouldDropAColourChunkOfTheWrongSize_insteadOfCarryingItAlong() {
        byte[] original = pngPlanting(TestImages.png(), new byte[0],
                pngChunk("gAMA", ascii("gamma " + SECRET)),
                pngChunk("sRGB", ascii("srgb " + SECRET)),
                pngChunk("cHRM", ascii("chroma")),
                pngChunk("cICP", ascii("code points " + SECRET)));
        assertThat(contains(original, SECRET)).isTrue();

        byte[] clean = strip(original, "image/png");

        assertThat(pngChunkTypes(clean)).containsExactly("IHDR", "IDAT", "IEND");
        assertThat(contains(clean, SECRET)).isFalse();
    }

    @Test
    void shouldLeaveAnAlreadyCleanPngExactlyAsItIs() {
        assertThat(strip(TestImages.png(), "image/png")).isEqualTo(TestImages.png());
    }

    @Test
    void shouldAcceptAPngWhosePictureDataChecksumIsWrong_asBrowsersDo() {
        // Chromium, ImageMagick and ffmpeg all show this file, so refusing it would only turn away pictures that work.
        byte[] clean = strip(PNG_WITH_WRONG_PICTURE_CHECKSUM, "image/png");

        assertThat(clean).isEqualTo(PNG_WITH_WRONG_PICTURE_CHECKSUM);
    }

    @Test
    void shouldRefuseAPngThatIsCutOffOrHasNoEnd() {
        byte[] png = TestImages.png();
        for (int cut : new int[]{12, 1, png.length / 2}) {
            byte[] broken = Arrays.copyOf(png, png.length - cut);
            assertThatThrownBy(() -> strip(broken, "image/png"))
                    .as("cut %d bytes from the end", cut)
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        }
    }

    @Test
    void shouldRefuseAPngWhoseChunkRunsPastTheEndOfTheFile() {
        byte[] fake = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4};
        assertThatThrownBy(() -> strip(fake, "image/png"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
    }

    @Test
    void shouldRefuseAPngThatDoesNotStartWithItsHeaderChunk_orHasTwoOfThem() {
        byte[] signature = Arrays.copyOf(TestImages.png(), 8);
        byte[] endOnly = concat(signature, pngChunk("IEND", new byte[0]));
        byte[] dataFirst = concat(signature, pngChunk("IDAT", new byte[]{1, 2, 3}), pngChunk("IEND", new byte[0]));
        byte[] headerChunk = Arrays.copyOfRange(TestImages.png(), 8, 8 + 25);
        byte[] twoHeaders = pngPlanting(TestImages.png(), new byte[0], headerChunk);
        for (byte[] broken : new byte[][]{endOnly, dataFirst, twoHeaders}) {
            assertThatThrownBy(() -> strip(broken, "image/png"))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        }
    }

    @Test
    void shouldRefuseAPngChunkWithAnImpossibleName() {
        for (String name : new String[]{"ab1d", "a b\0", "\u00e9xyz"}) {
            byte[] odd = pngPlanting(TestImages.png(), new byte[0], pngChunk(name, new byte[]{1}));
            assertThatThrownBy(() -> strip(odd, "image/png"))
                    .as("chunk named %s", name)
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        }
    }

    @Test
    void shouldRefuseAPngWhoseHeaderOrEndChunkHasTheWrongSize() {
        byte[] signature = Arrays.copyOf(TestImages.png(), 8);
        byte[] idat = pngChunk("IDAT", new byte[]{1, 2, 3});
        byte[] headerData = Arrays.copyOfRange(TestImages.png(), 16, 16 + 13);      // a real header: right size, real width and height
        byte[] shortHeader = concat(signature, pngChunk("IHDR", Arrays.copyOf(headerData, 12)), idat, pngChunk("IEND", new byte[0]));
        byte[] longHeader = concat(signature, pngChunk("IHDR", concat(headerData, new byte[]{0})), idat, pngChunk("IEND", new byte[0]));
        byte[] endWithData = concat(Arrays.copyOf(TestImages.png(), 8 + 25), idat, pngChunk("IEND", new byte[]{1}));
        for (byte[] broken : new byte[][]{shortHeader, longHeader, endWithData}) {
            assertThatThrownBy(() -> strip(broken, "image/png"))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        }
    }

    @Test
    void shouldRefuseAnAnimatedPng() {
        byte[] animated = pngPlanting(TestImages.png(), new byte[0], pngChunk("acTL", new byte[]{0, 0, 0, 2, 0, 0, 0, 0}));
        assertThatThrownBy(() -> strip(animated, "image/png"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Animated");
    }

    @Test
    void shouldRefuseAPngBiggerThan8000PixelsOnEitherSide() {
        for (int[] size : new int[][]{{8001, 10}, {10, 8001}}) {
            byte[] big = pngWithSize(TestImages.png(), size[0], size[1]);
            assertThatThrownBy(() -> strip(big, "image/png"))
                    .as("%d x %d", size[0], size[1])
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("too large");
        }
        assertThat(strip(pngWithSize(TestImages.png(), 8000, 8000), "image/png")).isNotEmpty();
    }

    @Test
    void shouldRefuseAPngWithAnUnknownCriticalChunk() {
        byte[] odd = pngPlanting(TestImages.png(), new byte[0], pngChunk("ABCD", new byte[]{1, 2, 3}));
        assertThatThrownBy(() -> strip(odd, "image/png"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
    }

    // ===================== WebP =====================

    @Test
    void shouldAcceptRealStillWebpFiles_andLeaveThemExactlyAsTheyAre() {
        for (byte[] webp : new byte[][]{WEBP_LOSSY, WEBP_LOSSLESS, WEBP_WITH_TRANSPARENCY}) {
            assertThat(strip(webp, "image/webp")).isEqualTo(webp);
        }
    }

    @ParameterizedTest
    @CsvSource({"true", "false"})
    void shouldRemoveExifAndXmpFromAWebp_butKeepTheColourProfile(boolean exifHasTheExifPrefix) {
        byte[] exif = exifHasTheExifPrefix ? exifPayloadWithGps(1, false) : tiffWithGps(1, false);
        byte[] profile = new byte[]{1, 2, 3, 4, 5};
        byte[] original = riff(webpHeaderChunk(0x20 | 0x08 | 0x04, 8, 8), webpChunk("ICCP", profile),
                webpPictureChunk(WEBP_LOSSY), webpChunk("EXIF", exif), webpChunk("XMP ", ascii("<x>" + SECRET + "</x>")));
        assertThat(contains(original, SECRET)).isTrue();

        byte[] clean = strip(original, "image/webp");

        assertThat(webpChunkTypes(clean)).containsExactly("VP8X", "ICCP", "VP8 ");
        assertThat(webpChunkData(clean, "VP8X")[0]).as("only the colour profile flag is left").isEqualTo((byte) 0x20);
        assertThat(webpChunkData(clean, "ICCP")).isEqualTo(profile);
        assertThat(contains(clean, SECRET)).isFalse();
        assertThat(ByteBuffer.wrap(clean, 4, 4).order(ByteOrder.LITTLE_ENDIAN).getInt()).as("size in the file header").isEqualTo(clean.length - 8);
    }

    @ParameterizedTest
    @CsvSource({"3,true,true", "6,false,false", "8,true,false"})
    void shouldKeepOnlyTheRotationFlagInAWebp(int orientation, boolean littleEndian, boolean exifHasTheExifPrefix) {
        byte[] exif = exifHasTheExifPrefix ? exifPayloadWithGps(orientation, littleEndian) : tiffWithGps(orientation, littleEndian);
        byte[] original = riff(webpHeaderChunk(0x08 | 0x04, 8, 8), webpPictureChunk(WEBP_LOSSY),
                webpChunk("EXIF", exif), webpChunk("XMP ", ascii(SECRET)));

        byte[] clean = strip(original, "image/webp");

        assertThat(webpChunkTypes(clean)).containsExactly("VP8X", "VP8 ", "EXIF");
        assertThat(webpChunkData(clean, "VP8X")[0]).as("the EXIF flag stays, the XMP flag goes").isEqualTo((byte) 0x08);
        byte[] kept = webpChunkData(clean, "EXIF");
        assertThat(tiffTags(kept)).containsExactly(0x0112);
        assertThat(tiffOrientation(kept)).isEqualTo(orientation);
        assertThat(contains(clean, SECRET)).isFalse();
    }

    @Test
    void shouldKeepTheTransparencyChunkAndFlagOfAWebp() {
        byte[] alphaChunk = webpChunkData(WEBP_WITH_TRANSPARENCY, "ALPH");
        byte[] pictureChunk = webpChunkData(WEBP_WITH_TRANSPARENCY, "VP8 ");
        byte[] original = riff(webpHeaderChunk(0x10 | 0x08, 8, 8), webpChunk("ALPH", alphaChunk), webpChunk("VP8 ", pictureChunk),
                webpChunk("EXIF", tiffWithGps(1, false)));

        byte[] clean = strip(original, "image/webp");

        assertThat(webpChunkTypes(clean)).containsExactly("VP8X", "ALPH", "VP8 ");
        assertThat(webpChunkData(clean, "VP8X")[0]).isEqualTo((byte) 0x10);
    }

    @Test
    void shouldDropUnknownChunksAndBytesAfterTheEndOfAWebp() {
        byte[] original = concat(riff(webpHeaderChunk(0, 8, 8), webpChunk("zzzz", ascii(SECRET)), webpPictureChunk(WEBP_LOSSY)), TRAILER);

        byte[] clean = strip(original, "image/webp");

        assertThat(webpChunkTypes(clean)).containsExactly("VP8X", "VP8 ");
        assertThat(contains(clean, SECRET)).isFalse();
        assertThat(clean.length).isEqualTo(8 + ByteBuffer.wrap(clean, 4, 4).order(ByteOrder.LITTLE_ENDIAN).getInt());
    }

    @Test
    void shouldDropBytesAfterTheEndOfASimpleWebp() {
        assertThat(strip(concat(WEBP_LOSSY, TRAILER), "image/webp")).isEqualTo(WEBP_LOSSY);
    }

    @Test
    void shouldRefuseAnAnimatedWebp() {
        assertThatThrownBy(() -> strip(WEBP_ANIMATED, "image/webp"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Animated");
        byte[] flagOnly = riff(webpHeaderChunk(0x02, 8, 8), webpPictureChunk(WEBP_LOSSY));
        assertThatThrownBy(() -> strip(flagOnly, "image/webp"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Animated");
    }

    @Test
    void shouldRefuseAFileThatOnlyStartsLikeAWebp() {
        byte[] justTheHeader = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '};
        byte[] junk = new byte[200];
        for (int i = 0; i < junk.length; i++) junk[i] = (byte) (i * 31 + 7);
        byte[] junkInsideARiff = riff(junk);
        byte[] riffSizeTooBig = WEBP_LOSSY.clone();
        riffSizeTooBig[4] = (byte) 0xFF;
        for (byte[] fake : new byte[][]{justTheHeader, junkInsideARiff, riffSizeTooBig, Arrays.copyOf(WEBP_LOSSY, 12),
                Arrays.copyOf(WEBP_LOSSY, WEBP_LOSSY.length - 9)}) {
            assertThatThrownBy(() -> strip(fake, "image/webp"))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        }
    }

    @Test
    void shouldRefuseAWebpWhosePictureHeaderIsWrong() {
        byte[] badStartCode = WEBP_LOSSY.clone();
        badStartCode[20 + 3] = 0x00;
        byte[] notAKeyFrame = WEBP_LOSSY.clone();
        notAKeyFrame[20] |= 0x01;
        byte[] badSignature = WEBP_LOSSLESS.clone();
        badSignature[20] = 0x2E;
        byte[] badVersion = WEBP_LOSSLESS.clone();
        badVersion[20 + 4] |= 0x20;
        for (byte[] fake : new byte[][]{badStartCode, notAKeyFrame, badSignature, badVersion}) {
            assertThatThrownBy(() -> strip(fake, "image/webp"))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        }
    }

    @Test
    void shouldRefuseAWebpWithTheWrongChunksInIt() {
        byte[] headerOnly = riff(webpHeaderChunk(0, 8, 8));
        byte[] twoPictures = riff(webpHeaderChunk(0, 8, 8), webpPictureChunk(WEBP_LOSSY), webpPictureChunk(WEBP_LOSSY));
        byte[] transparencyWithLossless = riff(webpHeaderChunk(0x10, 8, 8), webpChunk("ALPH", new byte[]{0, 1, 2}), webpPictureChunk(WEBP_LOSSLESS));
        byte[] chunkRunsPastTheEnd = WEBP_LOSSY.clone();
        chunkRunsPastTheEnd[16] = (byte) 0xF0;
        for (byte[] fake : new byte[][]{headerOnly, twoPictures, transparencyWithLossless, chunkRunsPastTheEnd}) {
            assertThatThrownBy(() -> strip(fake, "image/webp"))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        }
    }

    @Test
    void shouldRefuseAWebpBiggerThan8000PixelsOnEitherSide() {
        byte[] wideLossy = WEBP_LOSSY.clone();
        wideLossy[20 + 6] = 0x41;
        wideLossy[20 + 7] = 0x1F;
        byte[] tallLossless = WEBP_LOSSLESS.clone();
        int dims = ByteBuffer.wrap(tallLossless, 21, 4).order(ByteOrder.LITTLE_ENDIAN).getInt();
        dims = (dims & ~(0x3FFF << 14)) | (8000 << 14);
        ByteBuffer.wrap(tallLossless, 21, 4).order(ByteOrder.LITTLE_ENDIAN).putInt(dims);
        byte[] bigCanvas = riff(webpHeaderChunk(0, 8001, 8), webpPictureChunk(WEBP_LOSSY));
        for (byte[] big : new byte[][]{wideLossy, tallLossless, bigCanvas}) {
            assertThatThrownBy(() -> strip(big, "image/webp"))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("too large");
        }
    }

    @Test
    void shouldRefuseAWebpWhoseFirstChunkIsNeitherThePictureNorItsHeader() {
        byte[] odd = riff(webpChunk("zzzz", ascii(SECRET)), webpPictureChunk(WEBP_LOSSY));

        assertThatThrownBy(() -> strip(odd, "image/webp"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
    }

    @Test
    void shouldKeepAColourProfileOnlyWhenTheHeaderSaysThereIsOne() {
        byte[] profile = new byte[]{1, 2, 3, 4};
        byte[] flagNotSet = riff(webpHeaderChunk(0x00, 8, 8), webpChunk("ICCP", profile), webpPictureChunk(WEBP_LOSSY));
        byte[] flagSetButNoProfile = riff(webpHeaderChunk(0x20, 8, 8), webpPictureChunk(WEBP_LOSSY));

        for (byte[] original : new byte[][]{flagNotSet, flagSetButNoProfile}) {
            byte[] clean = strip(original, "image/webp");

            assertThat(webpChunkTypes(clean)).containsExactly("VP8X", "VP8 ");
            assertThat(webpChunkData(clean, "VP8X")[0]).as("no profile, so no profile flag").isZero();
        }
    }

    @Test
    void shouldRefuseAWebpHeaderChunkOfTheWrongSize_orOneThatIsNotFirst() {
        byte[] wrongSize = riff(webpChunk("VP8X", new byte[12]), webpPictureChunk(WEBP_LOSSY));
        byte[] notFirst = riff(webpPictureChunk(WEBP_LOSSY), webpHeaderChunk(0, 8, 8));
        for (byte[] broken : new byte[][]{wrongSize, notFirst}) {
            assertThatThrownBy(() -> strip(broken, "image/webp"))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        }
    }

    @Test
    void shouldRefuseAnimationChunksEvenWhenTheHeaderFlagSaysStill() {
        byte[] lying = riff(webpHeaderChunk(0, 8, 8), webpChunk("ANIM", new byte[6]), webpPictureChunk(WEBP_LOSSY));

        assertThatThrownBy(() -> strip(lying, "image/webp"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Animated");
    }

    // ===================== all formats =====================

    @Test
    void shouldGiveTheSameAnswerWhenRunTwice() {
        byte[] jpeg = jpegPlanting(photo(), TRAILER, exifSegment(6, true), xmpSegment(), iccSegment());
        byte[] png = pngPlanting(TestImages.png(), TRAILER, pngChunk("tEXt", ascii("a\0" + SECRET)));
        byte[] webp = riff(webpHeaderChunk(0x08, 8, 8), webpPictureChunk(WEBP_LOSSY), webpChunk("EXIF", tiffWithGps(6, false)));

        for (Object[] pair : new Object[][]{{jpeg, "image/jpeg"}, {png, "image/png"}, {webp, "image/webp"}}) {
            byte[] once = strip((byte[]) pair[0], (String) pair[1]);
            assertThat(strip(once, (String) pair[1])).isEqualTo(once);
        }
    }

    @Test
    void shouldRefuseAFileThatIsNotTheKindItWasSaidToBe() {
        assertThatThrownBy(() -> strip(photo(), "image/png"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        assertThatThrownBy(() -> strip(TestImages.png(), "image/webp"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        assertThatThrownBy(() -> strip(WEBP_LOSSY, "image/jpeg"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not a valid picture");
        assertThatThrownBy(() -> strip(photo(), "image/gif"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * Whatever is done to a file, the answer is a cleaned file or a plain refusal: never another kind of error (which would
     * reach the person uploading as a server failure), and never a hang. The edits are repeatable (fixed seed).
     */
    @Test
    @Timeout(120)
    void shouldOnlyEverAcceptOrRefuseCleanly_whateverIsDoneToAFile() throws IOException {
        Object[][] bases = {
                {jpegPlanting(photo(), TRAILER, exifSegment(6, false), xmpSegment(), iccSegment(), commentSegment()), "image/jpeg"},
                {jpegPlanting(progressiveJpeg(), new byte[0], exifSegment(3, true), adobeSegment()), "image/jpeg"},
                {pngPlanting(transparentPalettePng(), TRAILER, pngChunk("tEXt", ascii("a\0" + SECRET)), pngChunk("eXIf", tiffWithGps(1, false))), "image/png"},
                {riff(webpHeaderChunk(0x20 | 0x08 | 0x04, 8, 8), webpChunk("ICCP", new byte[]{1, 2, 3}), webpPictureChunk(WEBP_LOSSY),
                        webpChunk("EXIF", exifPayloadWithGps(6, true)), webpChunk("XMP ", ascii(SECRET))), "image/webp"},
                {riff(webpHeaderChunk(0x10, 8, 8), webpChunk("ALPH", webpChunkData(WEBP_WITH_TRANSPARENCY, "ALPH")),
                        webpChunk("VP8 ", webpChunkData(WEBP_WITH_TRANSPARENCY, "VP8 "))), "image/webp"},
                {WEBP_LOSSLESS, "image/webp"},
        };
        java.util.Random random = new java.util.Random(20261017L);
        int accepted = 0;
        int refused = 0;
        for (int round = 0; round < 3000; round++) {
            Object[] base = bases[round % bases.length];
            byte[] bytes = ((byte[]) base[0]).clone();
            String type = (String) base[1];
            switch (random.nextInt(4)) {
                case 0 -> bytes = Arrays.copyOf(bytes, random.nextInt(bytes.length + 1));                 // cut off anywhere
                case 1 -> {
                    for (int flips = 1 + random.nextInt(8); flips > 0; flips--) bytes[random.nextInt(bytes.length)] = (byte) random.nextInt(256);
                }
                case 2 -> {                                                                                  // a window of 0x00 or 0xFF
                    int at = random.nextInt(bytes.length);
                    int width = 1 + random.nextInt(6);
                    for (int i = at; i < Math.min(bytes.length, at + width); i++) bytes[i] = (byte) (random.nextBoolean() ? 0xFF : 0x00);
                }
                default -> {                                                                                 // a block moved or repeated
                    int from = random.nextInt(bytes.length);
                    int to = Math.min(bytes.length, from + 1 + random.nextInt(40));
                    bytes = concat(Arrays.copyOf(bytes, to), Arrays.copyOfRange(bytes, from, bytes.length));
                }
            }
            byte[] input = bytes;
            byte[] clean;
            try {
                clean = strip(input, type);
            } catch (IllegalArgumentException refusal) {
                refused++;
                continue;
            } catch (Throwable other) {
                throw new AssertionError("round " + round + " (" + type + "): " + other, other);
            }
            accepted++;
            assertThat(strip(clean, type)).as("round %d is stable when run twice", round).isEqualTo(clean);
        }
        assertThat(accepted).as("the sweep reaches the accepting paths too").isGreaterThan(100);
        assertThat(refused).as("and the refusing ones").isGreaterThan(100);
    }

    // ===================== helpers =====================

    private static byte[] progressiveJpeg() throws IOException {
        BufferedImage image = new BufferedImage(40, 30, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 30; y++) for (int x = 0; x < 40; x++) image.setRGB(x, y, (x * 6) << 16 | (y * 8) << 8 | ((x + y) * 3));
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ImageWriteParam params = writer.getDefaultWriteParam();
        params.setProgressiveMode(ImageWriteParam.MODE_DEFAULT);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(image, null, null), params);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }

    /** A 8 x 8 picture with a see-through palette entry, so the file holds PLTE and tRNS chunks. */
    private static byte[] transparentPalettePng() throws IOException {
        byte[] red = {(byte) 255, 0, 0, 10};
        byte[] green = {0, (byte) 255, 0, 20};
        byte[] blue = {0, 0, (byte) 255, 30};
        byte[] alpha = {(byte) 255, (byte) 128, 0, (byte) 255};
        IndexColorModel palette = new IndexColorModel(2, 4, red, green, blue, alpha);
        BufferedImage image = new BufferedImage(8, 8, BufferedImage.TYPE_BYTE_BINARY, palette);
        for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) image.getRaster().setSample(x, y, 0, (x + y) % 4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private static byte[] jpegWithSize(byte[] jpeg, int width, int height) {
        byte[] copy = jpeg.clone();
        int at = jpegSegmentOffset(copy, 0xC0);
        copy[at + 5] = (byte) (height >> 8);
        copy[at + 6] = (byte) height;
        copy[at + 7] = (byte) (width >> 8);
        copy[at + 8] = (byte) width;
        return copy;
    }

    private static byte[] pngWithSize(byte[] png, int width, int height) {
        byte[] header = ByteBuffer.allocate(13).putInt(width).putInt(height).put(new byte[]{8, 2, 0, 0, 0}).array();
        return concat(Arrays.copyOf(png, 8), pngChunk("IHDR", header), Arrays.copyOfRange(png, 8 + 25, png.length));
    }
}

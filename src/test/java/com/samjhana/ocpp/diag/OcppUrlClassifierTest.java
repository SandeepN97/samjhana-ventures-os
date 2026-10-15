package com.samjhana.ocpp.diag;

import com.samjhana.ocpp.diag.OcppUrlClassifier.Shape;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OcppUrlClassifierTest {

    @Test
    void shouldClassifyEveryUrlShape() {
        assertThat(OcppUrlClassifier.classify("/ocpp/HD-D180-CC-01")).isEqualTo(Shape.EXPECTED);
        assertThat(OcppUrlClassifier.classify("/ocpp/HD-D180-CC-01/")).isEqualTo(Shape.TRAILING_SLASH);
        assertThat(OcppUrlClassifier.classify("/ocpp/HD-D180-CC-01/extra")).isEqualTo(Shape.EXTRA_SEGMENT);
        assertThat(OcppUrlClassifier.classify("/ocpp/ocpp2.0.1/HD-D180-CC-01")).isEqualTo(Shape.EXTRA_SEGMENT);
        assertThat(OcppUrlClassifier.classify("/ocpp/HD-D180-CC-01/HD-D180-CC-01")).isEqualTo(Shape.DOUBLED_CHARGE_POINT_ID);
        assertThat(OcppUrlClassifier.classify("/ocpp/HD-D180-CC-01/HD-D180-CC-01/")).isEqualTo(Shape.DOUBLED_CHARGE_POINT_ID);
        assertThat(OcppUrlClassifier.classify("/ocpp2.0.1/HD-D180-CC-01")).isEqualTo(Shape.UNKNOWN_PREFIX);
        assertThat(OcppUrlClassifier.classify("/ocpp-debug/abc")).isEqualTo(Shape.UNKNOWN_PREFIX);
        assertThat(OcppUrlClassifier.classify("/ocpp")).isEqualTo(Shape.MISSING_CHARGE_POINT_ID);
        assertThat(OcppUrlClassifier.classify("/ocpp/")).isEqualTo(Shape.MISSING_CHARGE_POINT_ID);
    }

    @Test
    void shouldNotTouchNonOcppPaths() {
        assertThat(OcppUrlClassifier.classify("/api/ev/sessions")).isEqualTo(Shape.NOT_OCPP);
        assertThat(OcppUrlClassifier.classify(null)).isEqualTo(Shape.NOT_OCPP);
        assertThat(Shape.NOT_OCPP.isNearMiss()).isFalse();
        assertThat(Shape.EXPECTED.isNearMiss()).isFalse();
        assertThat(Shape.EXTRA_SEGMENT.isNearMiss()).isTrue();
    }
}

package com.samjhana.service;

import com.samjhana.entity.ChargePoint;
import com.samjhana.ocpp.OcppConnectionRegistry;
import com.samjhana.ocpp.diag.LogCapture;
import com.samjhana.repository.AuditLogRepository;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.websocket.EvLiveWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** The old -> new log lines for charge_point changes (logger com.samjhana.ocpp.lifecycle). */
class ChargePointServiceLoggingTest {

    private ChargePointService service;
    private ChargePoint point;

    @BeforeEach
    void setUp() {
        ChargePointRepository repository = mock(ChargePointRepository.class);
        point = ChargePoint.builder().id(java.util.UUID.randomUUID()).code("CP-1").model("M").build();
        when(repository.findByCodeAndDeletedAtIsNull("CP-1")).thenReturn(Optional.of(point));
        when(repository.save(any(ChargePoint.class))).thenAnswer(invocation -> invocation.getArgument(0));
        service = new ChargePointService(repository, mock(EvLiveWebSocketHandler.class), mock(PasswordEncoder.class),
                mock(AuditLogRepository.class), mock(OcppConnectionRegistry.class));
    }

    @Test
    void shouldLogConnectionStatusChangesOldToNew_andStaySilentWhenNothingChanges() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            service.markConnected("CP-1");
            service.recordHeartbeat("CP-1"); // already ONLINE: no change line
            service.markDisconnected("CP-1");

            assertThat(capture.matching("CHARGE POINT CP-1 connection_status: OFFLINE -> ONLINE (connected)")).hasSize(1);
            assertThat(capture.matching("CHARGE POINT CP-1 connection_status: ONLINE -> OFFLINE (disconnected)")).hasSize(1);
            assertThat(capture.matching("(heartbeat)")).isEmpty();
        }
    }

    @Test
    void shouldLogConnectorStatusAndSerialNumberChanges() {
        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            service.recordBoot("CP-1", "SN-42");
            service.recordStatus("CP-1", "Occupied");
            service.recordStatus("CP-1", "Occupied");
            service.recordStatus("CP-1", "Available");

            assertThat(capture.matching("serial_number: null -> SN-42")).hasSize(1);
            assertThat(capture.matching("connector_status: null -> Occupied")).hasSize(1);
            assertThat(capture.matching("connector_status: Occupied -> Available")).hasSize(1);
            assertThat(capture.matching("connector_status: Occupied -> Occupied")).isEmpty();
        }
    }
}

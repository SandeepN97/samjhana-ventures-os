package com.samjhana.ocpp.diag;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samjhana.ocpp.OcppConnectionRegistry;
import com.samjhana.repository.ChargePointRepository;
import com.samjhana.repository.ChargeSessionRepository;
import com.samjhana.repository.OcppCommandLogRepository;
import com.samjhana.repository.OcppConnectionLogRepository;
import com.samjhana.repository.OcppMessageLogRepository;
import com.samjhana.repository.OcppSessionEvidenceRepository;
import com.samjhana.service.ChargePointService;
import com.samjhana.service.ChargeSessionService;
import com.samjhana.websocket.OcppHandshakeInterceptor;
import com.samjhana.websocket.OcppWebSocketHandler;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** A broken database must never reach the charger connection: it keeps answering while every insert fails. */
class OcppAuditResilienceTest {

    @Test
    void shouldKeepAnsweringTheCharger_whenEveryAuditInsertFails() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        OcppLoggingProperties properties = new OcppLoggingProperties();
        OcppMessageLogRepository messages = mock(OcppMessageLogRepository.class);
        OcppConnectionLogRepository connections = mock(OcppConnectionLogRepository.class);
        OcppCommandLogRepository commands = mock(OcppCommandLogRepository.class);
        OcppSessionEvidenceRepository evidenceRepo = mock(OcppSessionEvidenceRepository.class);
        when(messages.saveAll(anyList())).thenThrow(new IllegalStateException("connection refused"));
        when(messages.save(any())).thenThrow(new IllegalStateException("connection refused"));
        when(connections.saveAll(anyList())).thenThrow(new IllegalStateException("connection refused"));
        when(connections.save(any())).thenThrow(new IllegalStateException("connection refused"));
        OcppAuditWriter writer = new OcppAuditWriter(messages, connections, commands, evidenceRepo, properties);

        JsonMasker masker = new JsonMasker(mapper);
        OcppFrameLogger frames = new OcppFrameLogger(properties, masker, writer);
        OcppFrameSender sender = new OcppFrameSender(frames);
        LockEvidenceTracker evidence = new LockEvidenceTracker(writer, mock(ChargeSessionRepository.class), properties, mapper);
        OcppCommandAudit audit = new OcppCommandAudit(writer, evidence);
        OcppConnectionRegistry registry = new OcppConnectionRegistry(sender, audit);
        OcppWebSocketHandler handler = new OcppWebSocketHandler(mapper, registry, mock(ChargePointService.class),
                mock(ChargeSessionService.class), frames, sender,
                new OcppMessageLogger(properties, mock(ChargePointRepository.class), evidence, masker),
                audit, writer, properties, masker);

        List<String> sent = new ArrayList<>();
        WebSocketSession session = mock(WebSocketSession.class);
        Map<String, Object> attributes = new HashMap<>();
        attributes.put(OcppHandshakeInterceptor.CHARGE_POINT_CODE, "CP-1");
        when(session.getId()).thenReturn("ws-1");
        when(session.isOpen()).thenReturn(true);
        when(session.getAttributes()).thenReturn(attributes);
        org.mockito.Mockito.doAnswer(invocation -> {
            sent.add(((TextMessage) invocation.getArgument(0)).getPayload());
            return null;
        }).when(session).sendMessage(any(WebSocketMessage.class));

        try (LogCapture capture = LogCapture.atConfiguredLevels()) {
            handler.afterConnectionEstablished(session);
            handler.handleMessage(session, new TextMessage("[2,\"h-1\",\"Heartbeat\",{}]"));
            handler.handleMessage(session, new TextMessage("[2,\"h-2\",\"Heartbeat\",{}]"));
            assertThatCode(writer::flush).doesNotThrowAnyException();

            assertThat(sent).hasSize(2).allMatch(frame -> frame.startsWith("[3,\"h-"));
            assertThat(capture.matching("OCPP audit insert failed")).hasSize(1);
            // the frames are still in the log output, the other copy of the evidence
            assertThat(capture.textsFrom(OcppLoggers.FRAMES_NAME)).hasSize(4);
        }
    }
}

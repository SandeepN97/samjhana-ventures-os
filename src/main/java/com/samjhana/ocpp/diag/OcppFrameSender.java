package com.samjhana.ocpp.diag;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;

/**
 * The only way text leaves the CSMS towards a charger. Everything (CALLRESULT, CALLERROR, commands)
 * goes through {@link #send}, so no outbound frame can bypass the frame log.
 */
@Component
public class OcppFrameSender {

    private static final Logger log = LoggerFactory.getLogger(OcppFrameSender.class);

    private final OcppFrameLogger frames;

    public OcppFrameSender(OcppFrameLogger frames) {
        this.frames = frames;
    }

    public void send(WebSocketSession session, String chargePointCode, String json) throws IOException {
        OcppConnectionState state = OcppConnectionState.of(session, chargePointCode);
        frames.outbound(state, json);
        try {
            session.sendMessage(new TextMessage(json));
        } catch (IOException | RuntimeException ex) {
            try (OcppMdc mdc = OcppMdc.open().chargePoint(chargePointCode).session(state.wsSessionId())) {
                log.error("Could not send OCPP frame to {} (session open={}): {}", chargePointCode,
                        session.isOpen(), ex.toString(), ex);
            }
            throw ex;
        }
    }
}

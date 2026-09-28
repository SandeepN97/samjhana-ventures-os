package com.samjhana.ocpp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OcppCommandService {

    private final OcppConnectionRegistry connectionRegistry;
    private final ObjectMapper objectMapper;

    public boolean isConnected(String chargePointCode) {
        return connectionRegistry.isConnected(chargePointCode);
    }

    /**
     * The remoteStartId sent with a session's start command. The charger echoes it back in its
     * TransactionEvents, which is how they are tied to the session: the start command can't name
     * a connector, so the connector the charger picks may not be the one staff chose.
     */
    public static int remoteStartIdFor(UUID sessionId) {
        // Mask instead of Math.abs(): abs(Integer.MIN_VALUE) is still negative, which OCPP rejects.
        return sessionId.hashCode() & 0x7fffffff;
    }

    public String requestStart(String chargePointCode, UUID sessionId, int evseId, String plateNumber) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("remoteStartId", remoteStartIdFor(sessionId));
        payload.put("evseId", evseId);
        ObjectNode idToken = payload.putObject("idToken");
        idToken.put("idToken", truncate(plateNumber, 36));
        idToken.put("type", "Central");
        return send(chargePointCode, "RequestStartTransaction", sessionId, payload);
    }

    public String requestStop(String chargePointCode, UUID sessionId, String ocppTransactionId) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("transactionId", ocppTransactionId);
        return send(chargePointCode, "RequestStopTransaction", sessionId, payload);
    }

    public String unlockConnector(String chargePointCode, UUID sessionId, int evseId, int connectorId) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("evseId", evseId);
        payload.put("connectorId", connectorId);
        return send(chargePointCode, "UnlockConnector", sessionId, payload);
    }

    private String send(String chargePointCode, String action, UUID sessionId, JsonNode payload) {
        ArrayNode frame = objectMapper.createArrayNode();
        frame.add(2);
        frame.add("__MESSAGE_ID__");
        frame.add(action);
        frame.add(payload);
        return connectionRegistry.send(chargePointCode, action, sessionId, frame.toString());
    }

    private String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}

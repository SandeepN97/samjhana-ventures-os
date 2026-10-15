package com.samjhana.ocpp.diag;

import com.fasterxml.jackson.databind.JsonNode;
import com.samjhana.entity.ChargePoint;
import com.samjhana.repository.ChargePointRepository;
import org.slf4j.Logger;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The parsed, human-readable log lines for each OCPP message (logger {@code lifecycle}, INFO unless noted).
 * The raw frame is logged separately by {@link OcppFrameLogger}; these lines say what the frame meant.
 * This class only reads and logs; it never changes what the CSMS answers or stores.
 */
@Component
public class OcppMessageLogger {

    private static final Logger LIFECYCLE = OcppLoggers.LIFECYCLE;
    private static final int PAYLOAD_LINE_LIMIT = 8_192;

    /** Actions a 2.0.1 charger commonly sends that this CSMS does not implement (answered NotSupported). */
    private static final Set<String> KNOWN_UNHANDLED = Set.of("Authorize", "MeterValues", "SecurityEventNotification",
            "NotifyReport", "NotifyEvent", "FirmwareStatusNotification", "LogStatusNotification");

    private static final Map<String, List<String>> REQUIRED = Map.of(
            "BootNotification", List.of("/reason", "/chargingStation/model", "/chargingStation/vendorName"),
            "StatusNotification", List.of("/timestamp", "/connectorStatus", "/evseId", "/connectorId"),
            "TransactionEvent", List.of("/eventType", "/timestamp", "/triggerReason", "/seqNo",
                    "/transactionInfo/transactionId"),
            "Authorize", List.of("/idToken/idToken", "/idToken/type"),
            "MeterValues", List.of("/evseId", "/meterValue"),
            "NotifyReport", List.of("/requestId", "/generatedAt", "/seqNo"));

    private static final Map<String, Set<String>> READ_PATHS = Map.of(
            "BootNotification", Set.of("reason", "chargingStation", "chargingStation.model",
                    "chargingStation.vendorName", "chargingStation.serialNumber", "chargingStation.firmwareVersion",
                    "chargingStation.modem", "chargingStation.modem.iccid", "chargingStation.modem.imsi"),
            "StatusNotification", Set.of("timestamp", "connectorStatus", "evseId", "connectorId"),
            "TransactionEvent", Set.of("eventType", "timestamp", "triggerReason", "seqNo", "offline",
                    "numberOfPhasesUsed", "cableMaxCurrent", "reservationId", "transactionInfo",
                    "transactionInfo.transactionId", "transactionInfo.chargingState",
                    "transactionInfo.timeSpentCharging", "transactionInfo.stoppedReason",
                    "transactionInfo.remoteStartId", "evse", "evse.id", "evse.connectorId", "idToken",
                    "idToken.idToken", "idToken.type", "meterValue", "meterValue[]", "meterValue[].timestamp",
                    "meterValue[].sampledValue", "meterValue[].sampledValue[]", "meterValue[].sampledValue[].value",
                    "meterValue[].sampledValue[].measurand", "meterValue[].sampledValue[].context",
                    "meterValue[].sampledValue[].location", "meterValue[].sampledValue[].phase",
                    "meterValue[].sampledValue[].unitOfMeasure", "meterValue[].sampledValue[].unitOfMeasure.unit",
                    "meterValue[].sampledValue[].unitOfMeasure.multiplier"));

    private final OcppLoggingProperties properties;
    private final ChargePointRepository chargePoints;
    private final LockEvidenceTracker lockEvidence;
    private final JsonMasker masker;

    private final Map<String, String> connectorStatuses = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, BigDecimal> lastEnergyWh = Collections.synchronizedMap(new LinkedHashMap<>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, BigDecimal> eldest) {
            return size() > 200;
        }
    });

    public OcppMessageLogger(OcppLoggingProperties properties, ChargePointRepository chargePoints,
                             LockEvidenceTracker lockEvidence, JsonMasker masker) {
        this.properties = properties;
        this.chargePoints = chargePoints;
        this.lockEvidence = lockEvidence;
        this.masker = masker;
    }

    // ------------------------------------------------------------------ required fields / unread keys

    /** Log-only: never rejects a frame. */
    public void checkRequired(String code, String action, JsonNode payload) {
        List<String> required = REQUIRED.get(action);
        if (required == null) return;
        List<String> missing = new ArrayList<>();
        for (String pointer : required) {
            JsonNode node = payload == null ? null : payload.at(pointer);
            if (node == null || node.isMissingNode() || node.isNull()) missing.add(pointer);
        }
        if (!missing.isEmpty()) {
            LIFECYCLE.warn("MISSING REQUIRED FIELD(S) in {} from {}: {} (frame still processed)", action, code, missing);
        }
    }

    public void logUnreadKeys(String code, String action, JsonNode payload) {
        if (!LIFECYCLE.isDebugEnabled() || payload == null) return;
        Set<String> known = READ_PATHS.get(action);
        if (known == null) return;
        Set<String> unread = new LinkedHashSet<>();
        collectUnread(payload, "", known, unread);
        if (!unread.isEmpty()) {
            LIFECYCLE.debug("UNREAD KEYS in {} from {} (vendor-specific or unused fields): {}", action, code, unread);
        }
    }

    private void collectUnread(JsonNode node, String path, Set<String> known, Set<String> unread) {
        if (node.isObject()) {
            for (Iterator<Map.Entry<String, JsonNode>> it = node.fields(); it.hasNext(); ) {
                Map.Entry<String, JsonNode> entry = it.next();
                String child = path.isEmpty() ? entry.getKey() : path + "." + entry.getKey();
                if (!known.contains(child)) unread.add(child);
                else collectUnread(entry.getValue(), child, known, unread);
            }
        } else if (node.isArray()) {
            for (JsonNode element : node) collectUnread(element, path + "[]", known, unread);
        }
    }

    // ------------------------------------------------------------------ BootNotification

    /** Call before the charge_point row is updated, so the stored model/serial can be compared. */
    public void boot(OcppConnectionState state, JsonNode payload) {
        JsonNode station = payload.path("chargingStation");
        String model = station.path("model").asText(null);
        String vendor = station.path("vendorName").asText(null);
        String serial = station.path("serialNumber").asText(null);
        String firmware = station.path("firmwareVersion").asText(null);
        JsonNode modem = station.path("modem");
        LIFECYCLE.info("BOOT reason={} vendor={} model={} serial={} firmware={} modem.iccid={} modem.imsi={} "
                        + "(clock skew n/a: the 2.0.1 BootNotification request carries no charger time)",
                payload.path("reason").asText(null), vendor, model, serial, firmware,
                modem.path("iccid").asText(null), modem.path("imsi").asText(null));
        ChargePoint stored = chargePoints.findByCodeAndDeletedAtIsNull(state.chargePointCode()).orElse(null);
        if (stored == null) return;
        if (serial != null && stored.getSerialNumber() != null && !serial.equals(stored.getSerialNumber())) {
            LIFECYCLE.warn("BOOT serial MISMATCH: charger reports '{}' but charge_point row has '{}'",
                    serial, stored.getSerialNumber());
        }
        if (model != null && stored.getModel() != null && !model.equalsIgnoreCase(stored.getModel())) {
            LIFECYCLE.warn("BOOT model MISMATCH: charger reports '{}' but charge_point row has '{}'",
                    model, stored.getModel());
        }
    }

    // ------------------------------------------------------------------ Heartbeat

    public void heartbeat(OcppConnectionState state) {
        Instant now = Instant.now();
        Instant previous = state.lastHeartbeatAt();
        state.lastHeartbeatAt(now);
        LIFECYCLE.debug("HEARTBEAT #{} previous={} sincePrevious={}s (clock skew n/a: the 2.0.1 Heartbeat request "
                        + "carries no charger time)", state.heartbeats().get(), previous,
                previous == null ? "-" : String.valueOf(Duration.between(previous, now).toSeconds()));
    }

    // ------------------------------------------------------------------ StatusNotification

    public void status(OcppConnectionState state, JsonNode payload) {
        String code = state.chargePointCode();
        Integer evse = intOrNull(payload.get("evseId"));
        Integer connector = intOrNull(payload.get("connectorId"));
        String status = payload.path("connectorStatus").asText(null);
        String key = code + "|" + evse + "|" + connector;
        String previous = status == null ? connectorStatuses.get(key) : connectorStatuses.put(key, status);
        LIFECYCLE.info("STATUS evse={} connector={} connectorStatus={} timestamp={}", evse, connector, status,
                payload.path("timestamp").asText(null));
        if (status != null && !status.equals(previous)) {
            LIFECYCLE.info("CONNECTOR STATUS CHANGE evse={} connector={}: {} -> {}", evse, connector,
                    previous == null ? "(first seen)" : previous, status);
            lockEvidence.connectorStatus(code, evse, connector, previous, status);
        }
        skew(code, "StatusNotification", payload.path("timestamp").asText(null));
    }

    // ------------------------------------------------------------------ TransactionEvent

    public void transactionEvent(OcppConnectionState state, JsonNode payload) {
        String code = state.chargePointCode();
        JsonNode info = payload.path("transactionInfo");
        JsonNode evse = payload.path("evse");
        String eventType = payload.path("eventType").asText(null);
        String transactionId = info.path("transactionId").asText(null);
        String token = payload.path("idToken").path("idToken").asText(null);
        LIFECYCLE.info("TRANSACTION EVENT eventType={} triggerReason={} transactionId={} seqNo={} stoppedReason={} "
                        + "evse={} connector={} chargingState={} idToken={} offline={} timestamp={}",
                eventType, payload.path("triggerReason").asText(null), transactionId,
                payload.path("seqNo").asText(null), info.path("stoppedReason").asText(null),
                evse.path("id").asText(null), evse.path("connectorId").asText(null),
                info.path("chargingState").asText(null), token == null ? null : JsonMasker.maskToken(token),
                payload.path("offline").asText(null), payload.path("timestamp").asText(null));
        skew(code, "TransactionEvent", payload.path("timestamp").asText(null));

        logMeterValues(code, transactionId, payload.path("meterValue"));
        if ("Ended".equals(eventType)) {
            lockEvidence.transactionEnded(code, transactionId, info.path("stoppedReason").asText(null),
                    payload.path("triggerReason").asText(null));
            lastEnergyWh.remove(code + "|" + transactionId);
        }
    }

    private void logMeterValues(String code, String transactionId, JsonNode meterValues) {
        boolean socPresent = false;
        String socValue = null;
        for (JsonNode meterValue : meterValues) {
            List<String> samples = new ArrayList<>();
            for (JsonNode sample : meterValue.path("sampledValue")) {
                String measurand = sample.path("measurand").asText("Energy.Active.Import.Register");
                String unit = sample.path("unitOfMeasure").path("unit").asText(null);
                int multiplier = sample.path("unitOfMeasure").path("multiplier").asInt(0);
                samples.add("{measurand=" + measurand + " value=" + sample.path("value").asText(null)
                        + " unit=" + unit + (multiplier != 0 ? " multiplier=" + multiplier : "")
                        + " context=" + sample.path("context").asText(null)
                        + " location=" + sample.path("location").asText(null)
                        + " phase=" + sample.path("phase").asText(null) + "}");
                if ("SoC".equalsIgnoreCase(measurand)) {
                    socPresent = true;
                    socValue = sample.path("value").asText(null);
                } else if (measurand.startsWith("Energy.Active.Import")) {
                    energy(code, transactionId, sample, measurand);
                }
            }
            LIFECYCLE.info("METER VALUE timestamp={} sampledValues={}", meterValue.path("timestamp").asText(null), samples);
        }
        if (socPresent) {
            LIFECYCLE.info("SoC present=true value={}%", socValue);
        } else {
            LIFECYCLE.info("SoC present=false{}", meterValues.isEmpty() ? " (event has no meterValue)"
                    : " (meterValue has no SoC sampledValue)");
        }
    }

    private void energy(String code, String transactionId, JsonNode sample, String measurand) {
        String text = sample.path("value").asText(null);
        BigDecimal value;
        try {
            value = text == null ? null : new BigDecimal(text);
        } catch (NumberFormatException ex) {
            LIFECYCLE.warn("ENERGY value '{}' is not a number", text);
            return;
        }
        if (value == null) return;
        String unit = sample.path("unitOfMeasure").path("unit").asText("Wh");
        BigDecimal wh = value.scaleByPowerOfTen(sample.path("unitOfMeasure").path("multiplier").asInt(0));
        if ("kWh".equalsIgnoreCase(unit)) wh = wh.multiply(BigDecimal.valueOf(1000));
        String key = code + "|" + transactionId;
        BigDecimal previous = lastEnergyWh.put(key, wh);
        if (previous != null && wh.compareTo(previous) < 0) {
            boolean reset = wh.signum() == 0;
            LIFECYCLE.warn("ENERGY {} {} ({} {}) = {} Wh is LOWER than the previous {} Wh for transaction {}",
                    reset ? "RESET to zero:" : "DECREASED:", measurand, text, unit, wh.stripTrailingZeros().toPlainString(),
                    previous.stripTrailingZeros().toPlainString(), transactionId);
        } else {
            LIFECYCLE.info("ENERGY {} = {} {} ({} Wh){}", measurand, text, unit, wh.stripTrailingZeros().toPlainString(),
                    previous == null ? " first reading for this transaction" : "");
        }
    }

    // ------------------------------------------------------------------ everything else

    public void otherAction(OcppConnectionState state, String action, JsonNode payload) {
        String text = LogSafe.clean(masker.mask(payload == null ? "" : payload.toString()).text(), PAYLOAD_LINE_LIMIT);
        if (KNOWN_UNHANDLED.contains(action)) {
            LIFECYCLE.info("ACTION {} received but not implemented by this CSMS (answering NotSupported): payload={}",
                    action, text);
        } else {
            LIFECYCLE.warn("UNKNOWN ACTION '{}' from {} (answering NotSupported): payload={}", action,
                    state.chargePointCode(), text);
        }
        if (payload != null && payload.has("timestamp")) skew(state.chargePointCode(), action, payload.get("timestamp").asText(null));
    }

    // ------------------------------------------------------------------ clock skew

    /** Charger time minus server time. WARN above the configured threshold. */
    void skew(String code, String source, String chargerTime) {
        if (chargerTime == null) return;
        Instant parsed;
        try {
            parsed = OffsetDateTime.parse(chargerTime).toInstant();
        } catch (RuntimeException ex) {
            try {
                parsed = Instant.parse(chargerTime);
            } catch (RuntimeException ignored) {
                LIFECYCLE.warn("CLOCK SKEW cannot be computed: {} timestamp '{}' is not an ISO-8601 date-time",
                        source, LogSafe.clean(chargerTime, 60));
                return;
            }
        }
        long seconds = Duration.between(Instant.now(), parsed).getSeconds();
        String zone = OffsetDateTime.ofInstant(parsed, ZoneOffset.UTC).toString();
        if (Math.abs(seconds) > properties.getClockSkewWarnSeconds()) {
            LIFECYCLE.warn("CLOCK SKEW {}s on {} (charger {} vs server now): charger clock is {}", seconds, source,
                    zone, seconds > 0 ? "AHEAD" : "BEHIND");
        } else {
            LIFECYCLE.info("CLOCK SKEW {}s on {} (charger {})", seconds, source, zone);
        }
    }

    private static Integer intOrNull(JsonNode node) {
        return node != null && node.canConvertToInt() ? node.asInt() : null;
    }
}

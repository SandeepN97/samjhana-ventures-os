-- Run against each PostgreSQL environment before deploying the EVSE-aware application.
-- Existing sessions are assigned to EVSE 1; new requests default to EVSE 1 as well.
ALTER TABLE charge_sessions
    ADD COLUMN IF NOT EXISTS evse_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_charge_session_location_status
    ON charge_sessions (charge_point_id, evse_id, connector_id, status);

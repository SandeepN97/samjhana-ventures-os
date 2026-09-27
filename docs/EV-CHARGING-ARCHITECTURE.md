# EV Charging — Current Implementation

This document describes the code in this repository. It does not assert that a particular charger, staging deployment, or physical lock behavior is currently online or verified.

## Implemented flow

The Spring Boot backend accepts charger connections at `/ocpp/<charge-point-code>` and supports OCPP 2.0.1 messages for boot, heartbeat, connector status, and transaction events. Authenticated users manage charge sessions through `/api/ev/sessions`; OCPP commands are sent back over the charger's WebSocket connection.

The implemented session endpoints are:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/ev/sessions/start` | Create a session and send a remote start request |
| `GET` | `/api/ev/sessions/active` | List open sessions |
| `GET` | `/api/ev/sessions/recent` | List recent sessions |
| `GET` | `/api/ev/sessions/{id}` | Read a session |
| `POST` | `/api/ev/sessions/{id}/stop` | Stop or queue a stop, depending on lock behavior |
| `POST` | `/api/ev/sessions/{id}/mark-paid` | Record payment and trigger stop or unlock |
| `POST` | `/api/ev/sessions/{id}/unlock` | Retry an explicit unlock |

For `EXPLICIT_UNLOCK`, stopping ends energy delivery but leaves the connector locked until payment and a successful unlock. For `AUTO_UNLOCK_ON_STOP`, staff records payment before the stop command because stopping itself releases the connector. This behavior is configurable per charge point; verify the physical charger's behavior before choosing it.

OCPP updates include transaction state, meter readings, and state of charge when provided by the charger. The admin receives live session updates over the separate `/ws/ev/**` WebSocket. A local simulated charger is used by the Playwright E2E tests; the standalone [`tools/ocpp-simulator`](../tools/ocpp-simulator/README.md) supports manual protocol testing.

## Current session data model

`ChargeSession` references a `ChargePoint`, vehicle, starting user, and optional paid user and transaction. It stores an `evseId` (default 1) and a `connectorId` alongside session/payment state, state-of-charge readings, meter readings, and energy delivered.

The start command sends the session's `evseId` in OCPP's `RequestStartTransaction`, which addresses an EVSE only and has no connector-ID field. The unlock command sends `evseId` and `connectorId` separately.

## EVSE and connector identity

The checked-in vendor documentation confirms OCPP 2.0.1 but does not identify how each physical nozzle maps to OCPP EVSE and connector IDs. Until the vendor configuration is verified on each unit, the application assumes EVSE 1 with connectors 1 and 2. Treat this as a provisional mapping, not a confirmed hardware fact.

If a unit reports both nozzles under one EVSE, the charger decides which connector a remote start uses, and this CSMS cannot select a specific connector. Verify the mapping with the vendor before relying on remote start selection; two separate EVSE IDs may be the correct representation for independently startable nozzles.

## Connector concurrency

Sessions are isolated by `(charge point, EVSE, connector)`. Starting a session takes a pessimistic write lock on the charge-point row for the duration of the transaction, then rejects the start only if that exact EVSE/connector already has an open session. This serializes competing starts on the same charger while allowing distinct connectors to run at the same time.

Incoming `TransactionEvent` messages must report both IDs in OCPP's `evse` object. They are matched by OCPP transaction ID together with charge point, EVSE, and connector, falling back to the open session on that same charge point, EVSE, and connector.

The `evse_id` column and its supporting index are added by `docs/migrations/2026-09-26-add-evse-id-to-charge-sessions.sql`. **Apply that SQL to the staging and production databases before deploying this version:** staging uses `ddl-auto: validate` and will refuse to start without the column.

## Security and deployment notes

- Charger WebSocket authentication uses the per-charge-point secret configured for the backend.
- Keep charger credentials, JWT secrets, and database credentials in the target environment's secret store, not in source control.
- Production/staging database schema behavior is configured separately from local development; coordinate any schema change with the target database migration and deployment.
- Do not run the simulator against production or real chargers. Use the disposable local E2E stack or an explicitly approved test environment.

This guide reflects the source tree, not a live staging or hardware check. See the [README](../README.md) for local application startup.

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

`ChargeSession` references a `ChargePoint`, vehicle, starting user, and optional paid user and transaction. It stores one `connectorId` alongside session/payment state, state-of-charge readings, meter readings, and energy delivered.

There is **no separate EVSE ID field** in the current session model. The start command writes the session's `connectorId` into OCPP's `evseId`; the unlock command writes that same value into both `evseId` and `connectorId`. These identifiers are currently conflated.

## Connector concurrency limitation

The current start logic rejects a new session if **any** open session exists on that charge point. It does not scope the check to connector or EVSE, and the database has no uniqueness constraint for open sessions by connector. Two start requests can also race because the check is not backed by a database constraint or a charge-point lock.

Incoming `TransactionEvent` messages are matched first by OCPP transaction ID. If that does not resolve a session, the handler falls back to the most recently requested open session on the charge point; it does not select by EVSE and connector. This fallback is ambiguous when concurrent sessions exist.

Therefore, the current code does **not** safely support two simultaneous sessions on one physical charge point. Supporting that requires separate, correctly mapped EVSE and connector fields; connector-specific event matching; and race-safe enforcement of one open session per charge point/EVSE/connector (for example, a database constraint with appropriate status handling or transaction-safe locking). A schema migration would be required for new persisted fields or indexes, with existing sessions backfilled and validated before enabling the new behavior.

## Security and deployment notes

- Charger WebSocket authentication uses the per-charge-point secret configured for the backend.
- Keep charger credentials, JWT secrets, and database credentials in the target environment's secret store, not in source control.
- Production/staging database schema behavior is configured separately from local development; coordinate any schema change with the target database migration and deployment.
- Do not run the simulator against production or real chargers. Use the disposable local E2E stack or an explicitly approved test environment.

This guide reflects the source tree, not a live staging or hardware check. See the [README](../README.md) for local application startup.

# OCPP simulator (planned)

Scaffold only — the actual simulator is not implemented yet. This directory is deliberately
isolated from the Maven build (`src/`) and both frontends (`samjhana-admin/`, `samjhana-web/`),
so it never affects the application build.

## What this is for

A standalone tool for exercising the backend's OCPP 2.0.1 handler against something other than
the in-process JUnit `SimulatedCharger` used in CI. See `docs/EV-CHARGING-ARCHITECTURE.md` and
the `ChargerSessionFlowIntegrationTest` for the protocol this must speak.

| | Existing JUnit `SimulatedCharger` | This tool |
|---|---|---|
| Where it runs | Inside a `@SpringBootTest`, in-process | Standalone process, against any deployed URL |
| Use case | CI regression testing | Manual/exploratory testing on staging, demos, load-testing reconnect behavior |
| Lifetime | Duration of one test method | Long-running, can simulate hours-long sessions |

## Planned tool

The MobilityHouse open-source `ocpp` Python library (Apache-2.0), because it implements the
OCPP 2.0.1 charge-point role specifically — matching both the real hardware and this backend's
protocol version exactly.

## Planned shape

A `simulate_charger.py` script accepting:
- `--url` — the CSMS WebSocket URL to connect to (see the safety guardrail below)
- `--charge-point-id` — which charger identity to present
- `--secret` — that charger's OCPP Basic-auth secret
- `--scenario` — at minimum: a normal charge (BootNotification, Heartbeat, Start/Stop
  transaction, configurable SoC/energy ramp-up), a rejected-start scenario, and a forced
  mid-session drop-and-reconnect (to exercise the backend's resync path when a Render restart
  or deploy interrupts an active session).

## Safety guardrail

**This tool's default example configuration must point only at staging charge-point IDs and
staging secrets.** It must never be pointed at production charger IDs or production secrets,
accidentally or otherwise. Whatever config file or `.env.example` ships with the eventual
implementation should make the staging default obvious and require a deliberate, explicit
override to target anything else.

## Status

Not implemented. This README exists so the directory has a place-holder and a documented
intent; the Python script, its dependencies, and its tests are a separate piece of work.

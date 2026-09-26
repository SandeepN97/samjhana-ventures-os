# OCPP simulator

Scaffold isolated from the Maven build (`src/`) and both frontends (`samjhana-admin/`,
`samjhana-web/`), so it never affects the application build.

## What this is for

A standalone tool for exercising the backend's OCPP 2.0.1 handler against something other than
the in-process JUnit `SimulatedCharger` used in CI. See `docs/EV-CHARGING-ARCHITECTURE.md` and
the `ChargerSessionFlowIntegrationTest` for the protocol this must speak.

| | Existing JUnit `SimulatedCharger` | This tool |
|---|---|---|
| Where it runs | Inside a `@SpringBootTest`, in-process | Standalone process, against any deployed URL |
| Use case | CI regression testing | Manual/exploratory testing on staging, demos, load-testing reconnect behavior |
| Lifetime | Duration of one test method | Long-running, can simulate hours-long sessions |

## Usage

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Full test transaction (BootNotification -> StatusNotification -> Started/Updated/Ended)
python simulate_charger.py --secret <staging-charger-secret>

# Just connect + boot, no transaction
python simulate_charger.py --secret <staging-charger-secret> --charge-point-id HQC23-80-01 --scenario boot
```

`--secret` must be the charger's **actual current secret as stored in that environment's
database** — see "A secret nuance" below, since this is not always the same as today's
`OCPP_SECRET_*` Render env var value.

## A secret nuance

The charge point's auth secret is only synced from the `OCPP_SECRET_*` env var **once**, the
first time `ChargePointSeeder` runs against an empty `charge_points` table — after that, the
stored hash is never overwritten by a later env var change. So the secret this tool needs is
whatever was live in staging's `OCPP_SECRET_*` variables the first time staging booted
successfully, not necessarily whatever's in Render right now. If those have diverged, clear the
`ocpp_auth_secret_hash` column for the charge point in question and let the seeder resync it on
next boot.

## Safety guardrail

`--url` defaults to staging. Anything else (in particular, anything that isn't staging or
localhost) requires typing an explicit confirmation phrase before the tool will proceed — see
`check_target_is_safe()` in `simulate_charger.py`. This tool must never be pointed at production
charge point IDs or production secrets.

## What's implemented vs. still planned

Implemented: connect + authenticate (Basic auth over the WebSocket handshake, `ocpp2.0.1`
subprotocol), `BootNotification`, `StatusNotification`, and a 3-event `TransactionEvent`
sequence (Started/Updated/Ended) with SoC + energy meter values — verified end-to-end against a
throwaway local fake CSMS during development (exact message shapes match
`ChargerSessionFlowIntegrationTest`, and schema-validated correctly by the `ocpp` library itself).

Still planned, not built: `Heartbeat`, a rejected-start scenario, and a forced mid-session
drop-and-reconnect (to exercise the backend's resync path when a Render restart or deploy
interrupts an active session) — see `docs/EV-CHARGING-ARCHITECTURE.md` for why that resync path
matters.

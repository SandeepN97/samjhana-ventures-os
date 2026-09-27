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

# Put the STAGING charger secrets in your shell (e.g. at the end of ~/.zshrc), never prod ones:
export OCPP_SECRET_HD_D180_CC_01='...'
export OCPP_SECRET_HQC23_80_01='...'
export OCPP_SECRET_HD_D140_E_01='...'

# All three chargers, live, until Ctrl+C
python simulate_charger.py --all

# One charger, live
python simulate_charger.py --charge-point-id HQC23-80-01

# Just connect + boot, then exit
python simulate_charger.py --charge-point-id HQC23-80-01 --scenario boot
```

Options for the live scenario:

| Option | Effect |
|---|---|
| `--speed N` | Vehicles charge N times faster than real time (default 10) |
| `--reject-starts` | Every start command is rejected |
| `--fail-first-unlock` | The first unlock on each connector fails, so staff must use Retry unlock |
| `--verbose` | Also log every raw OCPP message |
| `--url` | Another backend, e.g. `ws://localhost:8080/ocpp/` for a local dev backend |

`--secret` (or the env var) must be the charger's **actual current secret as stored in that
environment's database** — see "A secret nuance" below, since this is not always the same as
today's `OCPP_SECRET_*` Render env var value.

## What the live scenario does

Each charger behaves like the real site's units, as the backend currently models them: one
EVSE with two connectors (nozzles).

- Connects, sends `BootNotification` and a `StatusNotification` per connector, then a
  `Heartbeat` at the interval the backend returns. Reconnects on its own after a backend
  restart or deploy, and resumes any charging that was in progress.
- `RequestStartTransaction` → accepted on the first free connector (rejected if both are busy),
  connector reports `Occupied`, and a `TransactionEvent` `Started` follows.
- Every 5 seconds while charging → `TransactionEvent` `Updated` with SoC, energy (Wh), power (W),
  voltage and current. The unit's rated power (80 kW, 80 kW, 40 kW) is shared between both
  connectors when two vehicles charge; each vehicle has its own battery size and maximum charge
  rate and tapers above 80% SoC.
- `RequestStopTransaction` (manual stop, or the backend reaching the target %) →
  `TransactionEvent` `Ended`; the connector stays `Occupied` (locked) until payment.
- `UnlockConnector` → `Unlocked`, and the connector reports `Available` again.

Every `TransactionEvent` names its EVSE and connector, because the backend ignores events that
don't. `RequestStartTransaction` carries no connector ID in OCPP 2.0.1, so the simulator picks
the first free connector, the same default the admin's connector selector uses.

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

## Not simulated

- Power, voltage and current are sent but the backend doesn't store or display them yet.
- Separate EVSE IDs per nozzle: the real vendor mapping is unconfirmed (see
  `docs/EV-CHARGING-ARCHITECTURE.md`); the simulator follows the backend's EVSE 1 /
  connectors 1–2 assumption.
- Firmware, reservations, local authorization and other OCPP features the backend doesn't use.

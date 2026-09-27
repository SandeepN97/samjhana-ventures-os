#!/usr/bin/env python3
"""Simulated OCPP 2.0.1 chargers for exercising a real, deployed CSMS (this backend),
as opposed to the in-process JUnit/Playwright simulated chargers used in CI.

The "live" scenario behaves like the real site: each charger has one EVSE with two
connectors (nozzles), stays connected with Heartbeats, and answers the backend's
RequestStartTransaction / RequestStopTransaction / UnlockConnector. While charging it
reports SoC, energy, power, voltage and current, splitting the charger's rated power
between both nozzles when two vehicles charge at once and tapering above 80% SoC.
The connector stays occupied (locked) after a stop until the backend unlocks it.

SAFETY: --url defaults to staging. Pointing this at anything that isn't staging or
localhost requires typing an explicit confirmation phrase — see check_target_is_safe()
below. Never point this at production charge point IDs or production secrets.

Secrets come from --secret, or from the same env var names the backend uses
(OCPP_SECRET_HD_D180_CC_01, OCPP_SECRET_HQC23_80_01, OCPP_SECRET_HD_D140_E_01).

Usage:
    pip install -r requirements.txt
    python simulate_charger.py --all                       # all three chargers, live
    python simulate_charger.py --all --speed 30            # charge 30x faster than real time
    python simulate_charger.py --charge-point-id HQC23-80-01 --scenario live
    python simulate_charger.py --secret <staging-charger-secret> --scenario boot
"""

import argparse
import asyncio
import logging
import os
import random
import sys
import urllib.parse
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import websockets
from websockets.headers import build_authorization_basic
from ocpp.routing import after, on
from ocpp.v201 import ChargePoint as OcppChargePoint
from ocpp.v201 import call, call_result
from ocpp.v201.datatypes import (
    ChargingStationType,
    EVSEType,
    MeterValueType,
    SampledValueType,
    TransactionType,
    UnitOfMeasureType,
)
from ocpp.v201.enums import (
    BootReasonEnumType,
    ChargingStateEnumType,
    ConnectorStatusEnumType,
    MeasurandEnumType,
    ReasonEnumType,
    RequestStartStopStatusEnumType,
    TransactionEventEnumType,
    TriggerReasonEnumType,
    UnlockStatusEnumType,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ocpp-simulator")
# The ocpp library logs every raw frame at INFO; --verbose turns that back on.
logging.getLogger("ocpp").setLevel(logging.WARNING)

STAGING_HOSTNAME = "samjhana-ventures-os-staging.onrender.com"
DEFAULT_URL = f"wss://{STAGING_HOSTNAME}/ocpp/"
KNOWN_CHARGE_POINT_IDS = ["HD-D180-CC-01", "HQC23-80-01", "HD-D140-E-01"]
# Rated DC output per unit, matching ChargePointSeeder.
MAX_POWER_KW = {"HD-D180-CC-01": 80.0, "HQC23-80-01": 80.0, "HD-D140-E-01": 40.0}
# The backend currently models each unit as EVSE 1 with two connectors (see
# docs/EV-CHARGING-ARCHITECTURE.md); the real vendor mapping is still unconfirmed.
EVSE_ID = 1
CONNECTOR_IDS = (1, 2)
METER_INTERVAL_SECONDS = 5
RECONNECT_DELAY_SECONDS = 5


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def secret_env_var(charge_point_id: str) -> str:
    return "OCPP_SECRET_" + charge_point_id.replace("-", "_").upper()


def resolve_secret(charge_point_id: str, explicit: Optional[str]) -> Optional[str]:
    return explicit or os.environ.get(secret_env_var(charge_point_id))


# ------------------------------------------------------------------ one-shot scenarios


class SimulatedCharger(OcppChargePoint):
    """Speaks just enough OCPP 2.0.1 charge-point role to boot, report status, and
    run one scripted test transaction against a real CSMS over a real WebSocket."""

    async def send_boot_notification(self) -> int:
        request = call.BootNotification(
            reason=BootReasonEnumType.power_up,
            charging_station=ChargingStationType(
                vendor_name="Samjhana-Sim",
                model="SIMULATOR",
                serial_number=f"SIM-{self.id}",
            ),
        )
        response = await self.call(request)
        logger.info("[%s] BootNotification -> status=%s", self.id, response.status)
        if response.status != "Accepted":
            raise SystemExit(f"CSMS rejected BootNotification: status={response.status}")
        return response.interval

    async def send_status_notification(
        self, status: str = ConnectorStatusEnumType.available, connector_id: int = 1
    ) -> None:
        request = call.StatusNotification(
            timestamp=now_iso(),
            connector_status=status,
            evse_id=EVSE_ID,
            connector_id=connector_id,
        )
        await self.call(request)
        logger.info("[%s] Connector %s -> %s", self.id, connector_id, status)

    async def send_transaction_event(
        self, event_type: str, seq_no: int, transaction_id: str, soc: int, energy_wh: int
    ) -> None:
        request = call.TransactionEvent(
            event_type=event_type,
            timestamp=now_iso(),
            trigger_reason=TriggerReasonEnumType.trigger,
            seq_no=seq_no,
            transaction_info=TransactionType(transaction_id=transaction_id),
            evse=EVSEType(id=EVSE_ID, connector_id=1),
            meter_value=[
                MeterValueType(
                    timestamp=now_iso(),
                    sampled_value=[
                        SampledValueType(value=soc, measurand=MeasurandEnumType.soc),
                        SampledValueType(
                            value=energy_wh, measurand=MeasurandEnumType.energy_active_import_register
                        ),
                    ],
                )
            ],
        )
        await self.call(request)
        logger.info("TransactionEvent(%s, seq=%s, soc=%s%%, energy=%sWh)", event_type, seq_no, soc, energy_wh)

    async def run_test_transaction(self, transaction_id: str = "SIM-TX-1") -> None:
        await self.send_boot_notification()
        await self.send_status_notification()
        await self.send_transaction_event(
            TransactionEventEnumType.started, 0, transaction_id, soc=32, energy_wh=0
        )
        await asyncio.sleep(2)
        await self.send_transaction_event(
            TransactionEventEnumType.updated, 1, transaction_id, soc=45, energy_wh=2_000
        )
        await asyncio.sleep(2)
        await self.send_transaction_event(
            TransactionEventEnumType.ended, 2, transaction_id, soc=60, energy_wh=5_000
        )
        logger.info("Test transaction complete.")


# ------------------------------------------------------------------ live chargers


@dataclass
class Connector:
    connector_id: int
    transaction_id: Optional[str] = None
    remote_start_id: Optional[int] = None
    id_token: Optional[dict] = None
    charging: bool = False  # delivering energy (False once stopped, while still locked)
    seq_no: int = 0
    battery_kwh: float = 0.0
    vehicle_max_kw: float = 0.0
    soc: float = 0.0
    energy_wh: float = 0.0
    power_w: float = 0.0
    failed_unlocks: int = 0

    @property
    def occupied(self) -> bool:
        return self.transaction_id is not None

    def plug_in_vehicle(self, remote_start_id: Optional[int], id_token: Optional[dict]) -> None:
        self.transaction_id = f"SIM-{uuid.uuid4().hex[:12]}"
        self.remote_start_id = remote_start_id
        self.id_token = id_token
        self.charging = True
        self.seq_no = 0
        self.battery_kwh = random.choice([39.2, 50.0, 60.0, 64.0, 75.0])
        self.vehicle_max_kw = random.choice([50.0, 60.0, 80.0])
        self.soc = float(random.randint(15, 40))
        self.energy_wh = 0.0
        self.power_w = 0.0

    def release(self) -> None:
        self.transaction_id = None
        self.remote_start_id = None
        self.id_token = None
        self.charging = False
        self.power_w = 0.0

    def next_seq(self) -> int:
        seq = self.seq_no
        self.seq_no += 1
        return seq


@dataclass
class StationOptions:
    speed: float = 10.0
    reject_starts: bool = False
    fail_first_unlock: bool = False


@dataclass
class ChargingStation:
    """State of one physical charger. Survives reconnects: a dropped WebSocket doesn't
    end a charging session, it just delays reporting until the link is back."""

    charge_point_id: str
    options: StationOptions
    connectors: dict = field(default_factory=dict)
    link: Optional["StationLink"] = None

    def __post_init__(self) -> None:
        self.connectors = {cid: Connector(cid) for cid in CONNECTOR_IDS}
        self.max_power_kw = MAX_POWER_KW.get(self.charge_point_id, 50.0)

    def log(self, message: str, *args) -> None:
        logger.info("[%s] " + message, self.charge_point_id, *args)

    def free_connector(self) -> Optional[Connector]:
        return next((c for c in self.connectors.values() if not c.occupied), None)

    def find_transaction(self, transaction_id: str) -> Optional[Connector]:
        return next((c for c in self.connectors.values() if c.transaction_id == transaction_id), None)

    def advance(self, real_seconds: float) -> None:
        """Move every charging vehicle forward. Both nozzles share the unit's rated power,
        and each vehicle tapers above 80% SoC, like a real DC fast charge."""
        active = [c for c in self.connectors.values() if c.charging]
        if not active:
            return
        share_kw = self.max_power_kw / len(active)
        hours = real_seconds * self.options.speed / 3600
        for c in active:
            taper = 1.0 if c.soc < 80 else max(0.1, 1 - (c.soc - 80) / 22)
            power_kw = 0.0 if c.soc >= 100 else min(share_kw, c.vehicle_max_kw) * taper
            added_kwh = power_kw * hours
            c.soc = min(100.0, c.soc + added_kwh / c.battery_kwh * 100)
            c.energy_wh += added_kwh * 1000
            c.power_w = power_kw * 1000

    def sampled_values(self, c: Connector) -> list:
        voltage = 360 + c.soc * 0.6  # pack voltage rises with SoC
        current = c.power_w / voltage if voltage else 0.0
        return [
            SampledValueType(value=round(c.soc), measurand=MeasurandEnumType.soc,
                             unit_of_measure=UnitOfMeasureType(unit="Percent")),
            SampledValueType(value=round(c.energy_wh), measurand=MeasurandEnumType.energy_active_import_register,
                             unit_of_measure=UnitOfMeasureType(unit="Wh")),
            SampledValueType(value=round(c.power_w), measurand=MeasurandEnumType.power_active_import,
                             unit_of_measure=UnitOfMeasureType(unit="W")),
            SampledValueType(value=round(voltage, 1), measurand=MeasurandEnumType.voltage,
                             unit_of_measure=UnitOfMeasureType(unit="V")),
            SampledValueType(value=round(current, 1), measurand=MeasurandEnumType.current_import,
                             unit_of_measure=UnitOfMeasureType(unit="A")),
        ]

    async def meter_loop(self) -> None:
        while True:
            await asyncio.sleep(METER_INTERVAL_SECONDS)
            self.advance(METER_INTERVAL_SECONDS)
            for c in self.connectors.values():
                if c.charging and self.link is not None:
                    await self.link.send_transaction_event(
                        c, TransactionEventEnumType.updated, TriggerReasonEnumType.meter_value_periodic)


class StationLink(OcppChargePoint):
    """One WebSocket connection for a ChargingStation. Handlers answer the backend's
    commands; the station holds the state so it outlives the connection."""

    def __init__(self, station: ChargingStation, connection):
        super().__init__(station.charge_point_id, connection)
        self.station = station
        self._pending_start: Optional[Connector] = None
        self._pending_stop: Optional[Connector] = None
        self._pending_unlock: Optional[Connector] = None

    # --- outgoing

    async def boot(self) -> int:
        response = await self.call(call.BootNotification(
            reason=BootReasonEnumType.power_up,
            charging_station=ChargingStationType(
                vendor_name="Samjhana-Sim", model="SIMULATOR", serial_number=f"SIM-{self.id}"),
        ))
        if response.status != "Accepted":
            raise SystemExit(f"[{self.id}] CSMS rejected BootNotification: status={response.status}")
        for c in self.station.connectors.values():
            await self.send_status(c)
        self.station.log("Online (connector 1: %s, connector 2: %s)",
                         *(("Occupied" if c.occupied else "Available") for c in self.station.connectors.values()))
        return response.interval or 30

    async def heartbeat_loop(self, interval: int) -> None:
        while True:
            await asyncio.sleep(interval)
            await self.call(call.Heartbeat())

    async def send_status(self, c: Connector) -> None:
        status = ConnectorStatusEnumType.occupied if c.occupied else ConnectorStatusEnumType.available
        await self.call(call.StatusNotification(
            timestamp=now_iso(), connector_status=status, evse_id=EVSE_ID, connector_id=c.connector_id))

    async def send_transaction_event(self, c: Connector, event_type: str, trigger: str,
                                     stopped_reason: Optional[str] = None) -> None:
        state = ChargingStateEnumType.charging if c.charging and c.soc < 100 else (
            ChargingStateEnumType.suspended_ev if c.charging else ChargingStateEnumType.ev_connected)
        # Snapshot before sending: a stop can arrive while this call is in flight.
        summary = (c.connector_id, round(c.soc), c.energy_wh / 1000, c.power_w / 1000)
        info = TransactionType(transaction_id=c.transaction_id, charging_state=state,
                               remote_start_id=c.remote_start_id, stopped_reason=stopped_reason)
        await self.call(call.TransactionEvent(
            event_type=event_type,
            timestamp=now_iso(),
            trigger_reason=trigger,
            seq_no=c.next_seq(),
            transaction_info=info,
            # Every event names its EVSE and connector: the backend ignores events that don't.
            evse=EVSEType(id=EVSE_ID, connector_id=c.connector_id),
            id_token=c.id_token if event_type == TransactionEventEnumType.started else None,
            meter_value=[MeterValueType(timestamp=now_iso(), sampled_value=self.station.sampled_values(c))],
        ))
        if event_type == TransactionEventEnumType.updated:
            self.station.log("Connector %s: %d%%  %.2f kWh  %.1f kW", *summary)

    # --- incoming

    @on("RequestStartTransaction")
    def on_request_start(self, evse_id=None, id_token=None, remote_start_id=None, **_):
        connector = self.station.free_connector()
        if self.station.options.reject_starts or connector is None or (evse_id not in (None, EVSE_ID)):
            reason = "rejecting (--reject-starts)" if self.station.options.reject_starts else "no free connector"
            self.station.log("Start requested for %s: %s", (id_token or {}).get("id_token"), reason)
            return call_result.RequestStartTransaction(status=RequestStartStopStatusEnumType.rejected)
        connector.plug_in_vehicle(remote_start_id, id_token)
        self._pending_start = connector
        return call_result.RequestStartTransaction(
            status=RequestStartStopStatusEnumType.accepted, transaction_id=connector.transaction_id)

    @after("RequestStartTransaction")
    async def after_request_start(self, **_):
        c, self._pending_start = self._pending_start, None
        if c is None:
            return
        self.station.log("Connector %s: vehicle %s started (%d%% of %.0f kWh battery)", c.connector_id,
                         (c.id_token or {}).get("id_token"), round(c.soc), c.battery_kwh)
        await self.send_status(c)
        await self.send_transaction_event(c, TransactionEventEnumType.started, TriggerReasonEnumType.remote_start)

    @on("RequestStopTransaction")
    def on_request_stop(self, transaction_id=None, **_):
        c = self.station.find_transaction(transaction_id)
        if c is None or not c.charging:
            return call_result.RequestStopTransaction(status=RequestStartStopStatusEnumType.rejected)
        c.charging = False
        c.power_w = 0.0
        self._pending_stop = c
        return call_result.RequestStopTransaction(status=RequestStartStopStatusEnumType.accepted)

    @after("RequestStopTransaction")
    async def after_request_stop(self, **_):
        c, self._pending_stop = self._pending_stop, None
        if c is None:
            return
        await self.send_transaction_event(c, TransactionEventEnumType.ended, TriggerReasonEnumType.remote_stop,
                                          stopped_reason=ReasonEnumType.remote)
        self.station.log("Connector %s: stopped at %d%%, %.2f kWh delivered; connector stays locked",
                         c.connector_id, round(c.soc), c.energy_wh / 1000)

    @on("UnlockConnector")
    def on_unlock(self, evse_id=None, connector_id=None, **_):
        c = self.station.connectors.get(connector_id)
        if c is None or evse_id != EVSE_ID:
            return call_result.UnlockConnector(status=UnlockStatusEnumType.unknown_connector)
        if self.station.options.fail_first_unlock and c.failed_unlocks == 0:
            c.failed_unlocks += 1
            self.station.log("Connector %s: unlock failed (--fail-first-unlock)", connector_id)
            return call_result.UnlockConnector(status=UnlockStatusEnumType.unlock_failed)
        c.release()
        c.failed_unlocks = 0
        self._pending_unlock = c
        return call_result.UnlockConnector(status=UnlockStatusEnumType.unlocked)

    @after("UnlockConnector")
    async def after_unlock(self, **_):
        c, self._pending_unlock = self._pending_unlock, None
        if c is None:
            return
        await self.send_status(c)
        self.station.log("Connector %s: unlocked, Available", c.connector_id)


async def run_station(base_url: str, station: ChargingStation, secret: str) -> None:
    """Keep one charger connected for as long as the process runs, reconnecting like
    real hardware does after a backend restart or deploy."""
    ws_url = base_url.rstrip("/") + "/" + station.charge_point_id
    auth_header = build_authorization_basic(station.charge_point_id, secret)
    meter_task = asyncio.create_task(station.meter_loop())
    try:
        while True:
            try:
                async with websockets.connect(
                    ws_url,
                    subprotocols=["ocpp2.0.1"],
                    additional_headers={"Authorization": auth_header},
                    open_timeout=60,  # a sleeping free-plan backend can take a while to wake
                ) as ws:
                    link = StationLink(station, ws)
                    listen_task = asyncio.create_task(link.start())
                    try:
                        interval = await link.boot()
                        station.link = link
                        heartbeat_task = asyncio.create_task(link.heartbeat_loop(interval))
                        await asyncio.wait({listen_task, heartbeat_task}, return_when=asyncio.FIRST_COMPLETED)
                        heartbeat_task.cancel()
                        station.log("Disconnected by the backend (restart or deploy?)")
                    finally:
                        station.link = None
                        listen_task.cancel()
            except websockets.exceptions.InvalidStatus as exc:
                station.log(
                    "Handshake rejected (%s). The secret must match what's stored for this charger in "
                    "that environment's database; see README. Not retrying.", exc)
                return
            except (OSError, asyncio.TimeoutError, websockets.exceptions.WebSocketException) as exc:
                station.log("Connection lost or unavailable (%s)", exc)
            station.log("Reconnecting in %ss ...", RECONNECT_DELAY_SECONDS)
            await asyncio.sleep(RECONNECT_DELAY_SECONDS)
    finally:
        meter_task.cancel()


# ------------------------------------------------------------------ entry points


SAFE_HOSTNAMES = {STAGING_HOSTNAME, "localhost", "127.0.0.1"}


def check_target_is_safe(url: str) -> None:
    """Refuse to run against anything that doesn't look like staging or a local
    dev backend, unless the operator explicitly confirms. This is the one guardrail
    standing between a typo and accidentally hitting production hardware secrets.

    Checks the parsed hostname exactly, not a substring match against the raw URL:
    a substring check would wave through something like wss://evil.com/localhost or
    wss://staging.attacker.example.com, since both contain the "safe" word without
    actually being staging or localhost."""
    hostname = (urllib.parse.urlparse(url).hostname or "").lower()
    if hostname in SAFE_HOSTNAMES:
        return
    print(
        f"\n /!\\  --url ({url}) does not look like staging or localhost.\n"
        " This tool must NEVER be pointed at production charge point IDs or secrets.\n",
        file=sys.stderr,
    )
    confirm = input("Type 'yes-i-am-sure' to proceed anyway: ")
    if confirm.strip() != "yes-i-am-sure":
        print("Aborted.", file=sys.stderr)
        sys.exit(1)


async def run_one_shot(args: argparse.Namespace, secret: str) -> None:
    ws_url = args.url.rstrip("/") + "/" + args.charge_point_id
    auth_header = build_authorization_basic(args.charge_point_id, secret)

    logger.info("Connecting to %s as %s (scenario=%s) ...", ws_url, args.charge_point_id, args.scenario)
    try:
        async with websockets.connect(
            ws_url,
            subprotocols=["ocpp2.0.1"],
            additional_headers={"Authorization": auth_header},
            open_timeout=60,
        ) as ws:
            charger = SimulatedCharger(args.charge_point_id, ws)
            listen_task = asyncio.ensure_future(charger.start())
            try:
                if args.scenario == "boot":
                    await charger.send_boot_notification()
                    await charger.send_status_notification()
                else:
                    await charger.run_test_transaction()
            finally:
                listen_task.cancel()
    except websockets.exceptions.InvalidStatus as exc:
        logger.error(
            "Handshake rejected (%s). Check: charge point id matches --charge-point-id exactly, "
            "the secret matches what's actually stored for this charger in that environment's "
            "database (not necessarily today's Render env var value — see README), and the URL's "
            "trailing path segment is the charge point id.",
            exc,
        )
        sys.exit(1)


async def run_live(args: argparse.Namespace, charge_point_ids: list, secrets: dict) -> None:
    options = StationOptions(speed=args.speed, reject_starts=args.reject_starts,
                             fail_first_unlock=args.fail_first_unlock)
    logger.info("Starting %d live charger(s) against %s at %sx speed. Ctrl+C to stop.",
                len(charge_point_ids), args.url, args.speed)
    await asyncio.gather(*(
        run_station(args.url, ChargingStation(cp_id, options), secrets[cp_id]) for cp_id in charge_point_ids
    ))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"CSMS base WebSocket URL; the charge point id is appended. Default (staging): {DEFAULT_URL}",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run all three chargers in the live scenario (secrets from OCPP_SECRET_* env vars).",
    )
    parser.add_argument(
        "--charge-point-id",
        default=KNOWN_CHARGE_POINT_IDS[0],
        choices=KNOWN_CHARGE_POINT_IDS,
        help="Which charger identity to present (ignored with --all).",
    )
    parser.add_argument(
        "--secret",
        help="This charger's plaintext OCPP Basic-auth secret; defaults to its OCPP_SECRET_* env var. "
        "Never pass a production secret.",
    )
    parser.add_argument(
        "--scenario",
        default="live",
        choices=["live", "boot", "transaction"],
        help="'live' (default): stay connected with two connectors and answer start/stop/unlock "
        "from the admin. 'boot': connect + BootNotification + StatusNotification, then exit. "
        "'transaction': send one scripted Started/Updated/Ended sequence, then exit.",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=10.0,
        help="How much faster than real time vehicles charge in the live scenario (default 10).",
    )
    parser.add_argument("--verbose", action="store_true", help="Also log every raw OCPP message.")
    parser.add_argument("--reject-starts", action="store_true", help="Live: reject every start command.")
    parser.add_argument(
        "--fail-first-unlock", action="store_true", help="Live: fail the first unlock on each connector."
    )
    args = parser.parse_args()
    if args.verbose:
        logging.getLogger("ocpp").setLevel(logging.INFO)
    if args.speed <= 0:
        parser.error("--speed must be greater than 0")

    charge_point_ids = KNOWN_CHARGE_POINT_IDS if args.all else [args.charge_point_id]
    if args.all and args.secret:
        parser.error("--secret applies to one charger; with --all set the OCPP_SECRET_* env vars instead")
    secrets = {cp_id: resolve_secret(cp_id, args.secret) for cp_id in charge_point_ids}
    missing = [secret_env_var(cp_id) for cp_id, secret in secrets.items() if not secret]
    if missing:
        parser.error("missing charger secret(s): set " + ", ".join(missing) + " or pass --secret")

    check_target_is_safe(args.url)
    try:
        if args.all or args.scenario == "live":
            asyncio.run(run_live(args, charge_point_ids, secrets))
        else:
            asyncio.run(run_one_shot(args, secrets[args.charge_point_id]))
    except KeyboardInterrupt:
        logger.info("Stopped. The chargers will show Offline.")


if __name__ == "__main__":
    main()

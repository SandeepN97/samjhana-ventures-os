#!/usr/bin/env python3
"""Minimal simulated OCPP 2.0.1 charger for exercising a real, deployed CSMS
(this backend), as opposed to the in-process JUnit SimulatedCharger used in CI.

See tools/ocpp-simulator/README.md for the fuller planned scope (scenarios,
forced reconnects, etc.) — this is the first, minimal slice of that plan: connect,
authenticate, and run one BootNotification -> StatusNotification -> a 3-event
TransactionEvent sequence (Started/Updated/Ended), matching the message shapes the
backend actually expects (see ChargerSessionFlowIntegrationTest.java).

SAFETY: --url defaults to staging. Pointing this at anything that isn't staging or
localhost requires typing an explicit confirmation phrase — see check_target_is_safe()
below. Never point this at production charge point IDs or production secrets.

Usage:
    pip install -r requirements.txt
    python simulate_charger.py --secret <staging-charger-secret>
    python simulate_charger.py --secret <staging-charger-secret> --charge-point-id HQC23-80-01 --scenario boot
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timezone

import websockets
from websockets.headers import build_authorization_basic
from ocpp.v201 import ChargePoint as OcppChargePoint
from ocpp.v201 import call
from ocpp.v201.datatypes import ChargingStationType, MeterValueType, SampledValueType, TransactionType
from ocpp.v201.enums import (
    BootReasonEnumType,
    ConnectorStatusEnumType,
    MeasurandEnumType,
    TransactionEventEnumType,
    TriggerReasonEnumType,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ocpp-simulator")

DEFAULT_URL = "wss://samjhana-ventures-os-staging.onrender.com/ocpp/"
KNOWN_CHARGE_POINT_IDS = ["HD-D180-CC-01", "HQC23-80-01", "HD-D140-E-01"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SimulatedCharger(OcppChargePoint):
    """Speaks just enough OCPP 2.0.1 charge-point role to boot, report status, and
    run one test transaction against a real CSMS over a real WebSocket."""

    async def send_boot_notification(self) -> None:
        request = call.BootNotification(
            reason=BootReasonEnumType.power_up,
            charging_station=ChargingStationType(
                vendor_name="Samjhana-Sim",
                model="SIMULATOR",
                serial_number=f"SIM-{self.id}",
            ),
        )
        response = await self.call(request)
        logger.info("BootNotification -> status=%s", response.status)
        if response.status != "Accepted":
            raise SystemExit(f"CSMS rejected BootNotification: status={response.status}")

    async def send_status_notification(self, status: str = ConnectorStatusEnumType.available) -> None:
        request = call.StatusNotification(
            timestamp=now_iso(),
            connector_status=status,
            evse_id=1,
            connector_id=1,
        )
        await self.call(request)
        logger.info("StatusNotification -> %s", status)

    async def send_transaction_event(
        self, event_type: str, seq_no: int, transaction_id: str, soc: int, energy_wh: int
    ) -> None:
        request = call.TransactionEvent(
            event_type=event_type,
            timestamp=now_iso(),
            trigger_reason=TriggerReasonEnumType.trigger,
            seq_no=seq_no,
            transaction_info=TransactionType(transaction_id=transaction_id),
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


def check_target_is_safe(url: str) -> None:
    """Refuse to run against anything that doesn't look like staging or a local
    dev backend, unless the operator explicitly confirms. This is the one guardrail
    standing between a typo and accidentally hitting production hardware secrets."""
    looks_safe = "staging" in url or "localhost" in url or "127.0.0.1" in url
    if looks_safe:
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


async def run(args: argparse.Namespace) -> None:
    ws_url = args.url.rstrip("/") + "/" + args.charge_point_id
    auth_header = build_authorization_basic(args.charge_point_id, args.secret)

    logger.info("Connecting to %s as %s (scenario=%s) ...", ws_url, args.charge_point_id, args.scenario)
    try:
        async with websockets.connect(
            ws_url,
            subprotocols=["ocpp2.0.1"],
            additional_headers={"Authorization": auth_header},
            open_timeout=15,
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"CSMS base WebSocket URL; the charge point id is appended. Default (staging): {DEFAULT_URL}",
    )
    parser.add_argument(
        "--charge-point-id",
        default=KNOWN_CHARGE_POINT_IDS[0],
        choices=KNOWN_CHARGE_POINT_IDS,
        help="Which charger identity to present.",
    )
    parser.add_argument(
        "--secret",
        required=True,
        help="This charger's plaintext OCPP Basic-auth secret. Never pass a production secret.",
    )
    parser.add_argument(
        "--scenario",
        default="transaction",
        choices=["boot", "transaction"],
        help="'boot': connect + BootNotification + StatusNotification only. "
        "'transaction' (default): also runs a full Started/Updated/Ended test charge.",
    )
    args = parser.parse_args()

    check_target_is_safe(args.url)
    asyncio.run(run(args))


if __name__ == "__main__":
    main()

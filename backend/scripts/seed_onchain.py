"""
Mints a spread of demo certificates so a fresh environment isn't an empty
dashboard.

A local Hardhat node keeps no state across restarts, so every `npx hardhat
node` gives you a registry with zero certificates — which makes the explorer,
the analytics page and the fraud view all render empty. This mints a set that
covers the states the UI actually has to show: a clean certificate, a
high-risk one, a retired one, and a transferred one.

Usage:
    python -m backend.scripts.seed_onchain            # default: 6 certificates
    python -m backend.scripts.seed_onchain --count 12
    python -m backend.scripts.seed_onchain --dry-run  # show what it would mint

Safe to re-run: certificates are keyed on a timestamp that advances per run, so
a second run adds new records rather than failing on duplicates. Against a
public network this spends real test ETH — roughly one mint's gas per
certificate, plus one transaction each for the retire and transfer.
"""
import argparse
import sys
from datetime import datetime, timedelta, timezone

from backend.app.clients import web3_client
from backend.app.db import SessionLocal, init_db
from backend.app.schemas import CertificateIssueRequest, Generation, Plant
from backend.app import onchain_service

# Plants chosen to produce a spread of risk scores from the real pipeline
# rather than hand-set numbers — a seeded demo that fakes its scores teaches
# the reviewer nothing.
PLANTS = [
    # (id, type, capacity_mw, lat, lon, mwh_claimed, hours)
    ("SOLAR-GJ-001", "solar", 50.0, 23.03, 72.58, 180.0, 4),   # plausible
    ("WIND-TN-014", "wind", 80.0, 8.09, 77.55, 240.0, 4),      # plausible
    ("SOLAR-RJ-007", "solar", 20.0, 26.91, 75.79, 79.0, 4),    # near capacity
    ("WIND-MH-022", "wind", 60.0, 19.08, 72.88, 239.0, 4),     # near capacity
    ("SOLAR-KA-031", "solar", 35.0, 12.97, 77.59, 120.0, 4),
    ("HYDRO-HP-005", "hydro", 45.0, 31.10, 77.17, 170.0, 4),
]


def build_payload(index: int, base_time: datetime) -> CertificateIssueRequest:
    plant_id, kind, capacity, lat, lon, mwh, hours = PLANTS[index % len(PLANTS)]
    # Distinct per run and per index, so re-running never collides on the
    # contract's (plantId, energyMWh, generationTimestamp) uniqueness key.
    start = base_time + timedelta(hours=index * 6)
    return CertificateIssueRequest(
        plant=Plant(id=plant_id, type=kind, capacity_mw=capacity, lat=lat, lon=lon),
        generation=Generation(
            mwh_claimed=mwh,
            start=start,
            end=start + timedelta(hours=hours),
        ),
        issuer_id=f"SEED-ISSUER-{index % 3}",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Mint demo certificates on the REC registry.")
    parser.add_argument("--count", type=int, default=6, help="how many certificates to mint")
    parser.add_argument("--dry-run", action="store_true", help="show the plan without sending transactions")
    args = parser.parse_args()

    if not web3_client.is_chain_available():
        print(
            "Chain not available. Check GET / -> chain.ready, and that:\n"
            "  - a node is reachable at RPC_URL\n"
            "  - the contract is deployed for that chain (cd contracts && npm run deploy:local)\n"
            "  - BACKEND_PRIVATE_KEY is set to a funded, authorized issuer wallet",
            file=sys.stderr,
        )
        return 1

    info = web3_client.deployment_info()
    print(f"Network:  {info.get('network', '?')} (chainId {info.get('chainId', '?')})")
    print(f"Registry: {web3_client.deployed_address()}")
    print(f"Issuer:   {web3_client.get_backend_address()}")
    print()

    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0) - timedelta(days=30)

    if args.dry_run:
        for i in range(args.count):
            p = build_payload(i, base_time)
            print(f"  would mint {p.plant.id}: {p.generation.mwh_claimed} MWh ending {p.generation.end}")
        return 0

    init_db()
    db = SessionLocal()
    minted = []
    try:
        for i in range(args.count):
            payload = build_payload(i, base_time)
            try:
                row = onchain_service.issue_certificate(db, payload)
            except web3_client.DuplicateRecordError:
                print(f"  skip  {payload.plant.id}: already certified")
                continue
            minted.append(row)
            print(f"  mint  #{row.token_id} {row.plant_id}: risk {row.fraud_score}/100  tx {row.mint_tx_hash[:14]}…")

        # Exercise the rest of the lifecycle so the UI has non-"issued" rows to
        # render. Both are no-ops unless the backend still custodies the token.
        if len(minted) >= 2:
            target = minted[-1]
            try:
                onchain_service.retire_certificate(db, target.token_id)
                print(f"  retire #{target.token_id}")
            except web3_client.ChainError as exc:
                print(f"  retire #{target.token_id} skipped: {exc}")

        if len(minted) >= 3:
            target = minted[-2]
            # Hardhat account #1 — a stand-in counterparty on a local chain.
            recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
            try:
                onchain_service.transfer_certificate(db, target.token_id, recipient)
                print(f"  xfer   #{target.token_id} -> {recipient[:10]}…")
            except web3_client.ChainError as exc:
                print(f"  xfer   #{target.token_id} skipped: {exc}")
    finally:
        db.close()

    print(f"\nSeeded {len(minted)} certificates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

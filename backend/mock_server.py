"""
Standalone hour-1 demo server: boots the real FastAPI app pre-loaded with
five hardcoded fixtures (one clean cert, plus one each of over-capacity,
trading ring, night-time solar, and tampered ledger) so the rest of the team
has something to point a dashboard at before any real client is wired in.

Run from the repo root:
    python -m backend.mock_server
"""
from datetime import datetime, timedelta, timezone

from backend.app.clients import ledger_client
from backend.app.main import app
from backend.app.schemas import CertificateCreate, Generation, Plant, Transaction
from backend.app import service


def _dt(hour: int) -> datetime:
    return datetime(2026, 6, 1, hour, 0, tzinfo=timezone.utc)


FIXTURES = [
    # Clean: claim is well within capacity, daytime, no trading loop.
    CertificateCreate(
        certificate_id="REC-CLEAN-001",
        plant=Plant(id="PLANT-A", type="solar", capacity_mw=50, lat=23.03, lon=72.58),
        generation=Generation(mwh_claimed=120, start=_dt(10), end=_dt(14)),
        issuer_id="ISSUER-A",
        buyer_id="BUYER-B",
    ),
    # Over-capacity: 500 MWh claimed in 1 hour from a 20 MW plant.
    CertificateCreate(
        certificate_id="REC-OVERCAP-002",
        plant=Plant(id="PLANT-B", type="wind", capacity_mw=20, lat=26.9, lon=75.8),
        generation=Generation(mwh_claimed=500, start=_dt(9), end=_dt(10)),
        issuer_id="ISSUER-C",
        buyer_id="BUYER-D",
    ),
    # Trading ring: E -> F -> G -> E.
    CertificateCreate(
        certificate_id="REC-RING-003",
        plant=Plant(id="PLANT-C", type="hydro", capacity_mw=30, lat=19.07, lon=72.87),
        generation=Generation(mwh_claimed=80, start=_dt(11), end=_dt(15)),
        issuer_id="ISSUER-E",
        buyer_id="BUYER-F",
        transactions=[
            Transaction(from_party_id="ISSUER-E", to_party_id="BUYER-F", transfer_timestamp=_dt(16)),
            Transaction(from_party_id="BUYER-F", to_party_id="TRADER-G", transfer_timestamp=_dt(17)),
            Transaction(from_party_id="TRADER-G", to_party_id="ISSUER-E", transfer_timestamp=_dt(18)),
        ],
    ),
    # Night-time solar: generation window starts at 02:00 UTC.
    CertificateCreate(
        certificate_id="REC-NIGHT-004",
        plant=Plant(id="PLANT-D", type="solar", capacity_mw=40, lat=28.6, lon=77.2),
        generation=Generation(mwh_claimed=60, start=_dt(2), end=_dt(4)),
        issuer_id="ISSUER-H",
        buyer_id="BUYER-I",
    ),
    # Tampered ledger: clean at write time, then its stored ledger block is
    # retroactively edited below to demonstrate GET /verify catching it.
    CertificateCreate(
        certificate_id="REC-TAMPERED-005",
        plant=Plant(id="PLANT-E", type="solar", capacity_mw=25, lat=12.97, lon=77.59),
        generation=Generation(mwh_claimed=50, start=_dt(11), end=_dt(13)),
        issuer_id="ISSUER-J",
        buyer_id="BUYER-K",
    ),
]


def _preload():
    for fixture in FIXTURES:
        service.compose_and_store(fixture)

    # Retroactively edit REC-TAMPERED-005's stored ledger block without
    # recomputing its hash -> GET /verify/REC-TAMPERED-005 now returns False.
    ledger_client.debug_tamper("REC-TAMPERED-005", {"risk_score": 0.0, "risk_reasons": []})


_preload()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)

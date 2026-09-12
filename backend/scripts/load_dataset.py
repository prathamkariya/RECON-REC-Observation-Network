"""
Loads Role 1's real synthetic dataset (certificates.csv + transactions.csv,
see docs/schema_data.md on the `main`/`ml` branches — the canonical source
schema) and POSTs each certificate through this service's own /recs
endpoint, exercising the full pipeline (ML -> graph -> weather ->
explanation -> ledger) end to end on real data instead of hand-built
fixtures.

Usage:
    python backend/scripts/load_dataset.py \
        --certs path/to/certificates.csv \
        --txns path/to/transactions.csv \
        [--base-url http://localhost:8000] [--limit 200]

Mapping to CertificateCreate (app/schemas.py):
    certificate_id          -> certificate_id
    plant.id                -> generator_id
    plant.type              -> energy_source
    plant.lat / plant.lon   -> plant_lat / plant_lon
    plant.capacity_mw       -> plant_rated_capacity_mwh (passthrough value;
                               label/unit name differs, number is unaffected)
    generation.mwh_claimed  -> claimed_mwh
    generation.start        -> generation_timestamp (read as-is, no tz
                               conversion -- source data is IST throughout)
    generation.end          -> generation_timestamp + 1h. Role 1's own
                               capacity_utilization_ratio feature has no
                               duration term (claimed_mwh / rated_capacity
                               directly); a flat 1h window makes this
                               service's own ratio (claimed / (capacity *
                               duration)) numerically identical to theirs.
    issuer_id                -> generator_id (every transaction chain's
                               first row originates from generator_id)
    buyer_id                 -> the issuance row's to_party_id (the first
                               transaction where from_party_id ==
                               generator_id), i.e. who it was issued to
                               before any further market trading
    transactions[]            -> transactions.csv rows for this
                               certificate_id, passed through for graph
                               ring detection

is_fraud / fraud_type are intentionally dropped: they're eval-only ground
truth labels, never a model input (Role 1's own locked rule) and there's no
field for them in the Certificate contract anyway.

KNOWN GAP, not silently papered over: certificate_id is NOT unique in this
dataset -- duplicate_serial fraud rows intentionally clone an existing
certificate_id (docs/schema_data.md decision #4). The generator's clone
copies every field verbatim (including generation_timestamp), so there is
no reliable field in certificates.csv to tell which of a duplicate pair a
given transaction chain belongs to -- both instances' chains only differ by
random buyer selection. This script assigns the UNION of all transactions
for that certificate_id to every occurrence, and reports every collision
below rather than skipping or silently overwriting. Both occurrences are
still POSTed: the ledger hash-chains a block for each (so the audit trail
shows the certificate was issued/traded twice), even though GET /recs/{id}
only reflects the state from the last one processed.
"""
import argparse
import csv
import sys
from collections import defaultdict
from datetime import datetime, timedelta

import requests

_TIMESTAMP_FORMATS = ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S")


def parse_ts(value: str) -> datetime:
    for fmt in _TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unrecognized timestamp format: {value!r}")


def load_transactions_by_cert(txns_path: str) -> dict:
    by_cert = defaultdict(list)
    with open(txns_path, newline="") as f:
        for row in csv.DictReader(f):
            by_cert[row["certificate_id"]].append(row)
    for cert_id, rows in by_cert.items():
        rows.sort(key=lambda r: parse_ts(r["transfer_timestamp"]))
    return by_cert


def build_payload(cert_row: dict, txn_rows: list) -> dict:
    generator_id = cert_row["generator_id"]
    start = parse_ts(cert_row["generation_timestamp"])
    end = start + timedelta(hours=1)

    issuance_rows = [t for t in txn_rows if t["from_party_id"] == generator_id]
    if issuance_rows:
        buyer_id = issuance_rows[0]["to_party_id"]
    elif txn_rows:
        buyer_id = txn_rows[0]["to_party_id"]
    else:
        buyer_id = generator_id

    return {
        "certificate_id": cert_row["certificate_id"],
        "plant": {
            "id": generator_id,
            "type": cert_row["energy_source"],
            "capacity_mw": float(cert_row["plant_rated_capacity_mwh"]),
            "lat": float(cert_row["plant_lat"]),
            "lon": float(cert_row["plant_lon"]),
        },
        "generation": {
            "mwh_claimed": float(cert_row["claimed_mwh"]),
            "start": start.isoformat(),
            "end": end.isoformat(),
        },
        "issuer_id": generator_id,
        "buyer_id": buyer_id,
        "transactions": [
            {
                "from_party_id": t["from_party_id"],
                "to_party_id": t["to_party_id"],
                "transfer_timestamp": parse_ts(t["transfer_timestamp"]).isoformat(),
                "certificate_id": t["certificate_id"],
            }
            for t in txn_rows
        ],
    }


def print_risk_distribution(risk_scores: list):
    buckets = [("0.0-0.2", 0.0, 0.2), ("0.2-0.4", 0.2, 0.4), ("0.4-0.6", 0.4, 0.6),
               ("0.6-0.8", 0.6, 0.8), ("0.8-1.0", 0.8, 1.01)]
    counts = {label: 0 for label, _, _ in buckets}
    for s in risk_scores:
        for label, lo, hi in buckets:
            if lo <= s < hi:
                counts[label] += 1
                break

    print("\nrisk_score distribution:")
    total = len(risk_scores) or 1
    for label, _, _ in buckets:
        count = counts[label]
        bar = "#" * int(count / total * 50)
        print(f"  {label}: {count:5d} {bar}")
    print(f"\n  mean: {sum(risk_scores) / total:.3f}   min: {min(risk_scores):.3f}   max: {max(risk_scores):.3f}")


def preload_graph(cert_rows: list, txns_by_cert: dict, base_url: str) -> None:
    """
    Warms the server's real-graph batch cache (POST /admin/graph-preload)
    before the per-certificate load loop, so each individual POST /recs
    call hits an O(1) cached lookup instead of recomputing Role 2's
    Louvain community detection from scratch -- which gets progressively
    slower as the known graph grows (see backend/app/clients/graph_client.py).
    Harmless no-op if USE_REAL_GRAPH is off; safe to always call.
    """
    all_transactions = [t for rows in txns_by_cert.values() for t in rows]
    all_certificates = [
        {"certificate_id": row["certificate_id"], "generator_id": row["generator_id"]}
        for row in cert_rows
    ]
    try:
        resp = requests.post(
            f"{base_url}/admin/graph-preload",
            json={"transactions": all_transactions, "certificates": all_certificates},
            timeout=120,
        )
        resp.raise_for_status()
        print(f"Graph preload: {resp.json()}", file=sys.stderr)
    except requests.RequestException as e:
        print(f"Graph preload skipped (non-fatal): {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(
        description="Load Role 1's real synthetic dataset into this service via POST /recs.",
    )
    parser.add_argument("--certs", required=True, help="Path to certificates.csv")
    parser.add_argument("--txns", required=True, help="Path to transactions.csv")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--limit", type=int, default=None, help="Only load the first N rows")
    args = parser.parse_args()

    txns_by_cert = load_transactions_by_cert(args.txns)

    with open(args.certs, newline="") as f:
        rows = list(csv.DictReader(f))
    if args.limit:
        rows = rows[: args.limit]

    preload_graph(rows, txns_by_cert, args.base_url)

    seen_counts: dict = {}
    duplicates = []
    loaded = []
    failed = []
    risk_scores = []

    session = requests.Session()

    for i, cert_row in enumerate(rows, start=1):
        cert_id = cert_row["certificate_id"]
        seen_counts[cert_id] = seen_counts.get(cert_id, 0) + 1
        if seen_counts[cert_id] > 1:
            duplicates.append(cert_id)

        try:
            payload = build_payload(cert_row, txns_by_cert.get(cert_id, []))
        except Exception as e:
            failed.append((cert_id, f"payload build error: {e}"))
            continue

        try:
            resp = session.post(f"{args.base_url}/recs", json=payload, timeout=10)
        except requests.RequestException as e:
            failed.append((cert_id, f"request error: {e}"))
            continue

        if resp.status_code != 201:
            failed.append((cert_id, f"HTTP {resp.status_code}: {resp.text[:200]}"))
            continue

        body = resp.json()
        loaded.append(cert_id)
        risk_scores.append(body["risk_score"])

        if i % 200 == 0:
            print(f"  ...{i}/{len(rows)} rows processed", file=sys.stderr)

    print()
    print("=" * 60)
    print("LOAD SUMMARY")
    print("=" * 60)
    print(f"Total rows in source:     {len(rows)}")
    print(f"Loaded successfully:      {len(loaded)}")
    print(f"Failed:                   {len(failed)}")
    print(
        f"Duplicate certificate_id: {len(duplicates)} "
        f"(duplicate_serial fraud pattern, docs/schema_data.md decision #4 -- "
        f"both POSTed, ledger has a block for each, GET /recs/{{id}} reflects "
        f"only the latest)"
    )
    if duplicates:
        print(f"  -> {duplicates}")

    if failed:
        print("\nFailures:")
        for cert_id, reason in failed[:20]:
            print(f"  {cert_id}: {reason}")
        if len(failed) > 20:
            print(f"  ...and {len(failed) - 20} more")

    if risk_scores:
        print_risk_distribution(risk_scores)


if __name__ == "__main__":
    main()

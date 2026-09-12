"""
Role 1: Synthetic Dataset Generator — REC Fraud Detection
HackOut'26, Team Synapse'27
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

# ----------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------
SEED = 42
np.random.seed(SEED)

N_PARTIES = 400
N_GENERATORS = 180
FRAUD_RATE = 0.175
DATE_WINDOW_DAYS = 90
REFERENCE_DATE = datetime(2026, 9, 12)

INDIA_LAT_RANGE = (8.0, 37.0)
INDIA_LON_RANGE = (68.0, 97.0)

# BUGFIX (found via tail-of-distribution audit — 83/1242 certs, 6.7%, had
# coordinates in Afghanistan's Wakhan Corridor / Tajikistan / Chinese
# Tibet-Xinjiang / Myanmar, clustering at lat 35-37, lon 70-96):
#
# The old code drew plant_lat/plant_lon from a single rectangle
# (INDIA_LAT_RANGE x INDIA_LON_RANGE) built from India's four extreme
# points. India's outline is not a rectangle, so that box necessarily
# includes large chunks of neighboring countries in its corners and along
# its northern edge. This silently corrupts any downstream weather lookup
# (Open-Meteo/NASA POWER) for ~1 in 15 certificates, since those APIs
# return valid weather for whatever coordinates they're given — no error,
# just wrong-country irradiance/cloud-cover data feeding Role 2's physical-
# plausibility check.
#
# Fix: keep the same bounding rectangle as a fast pre-filter, but add a
# point-in-polygon test against a simplified India mainland outline and
# rejection-sample until a point actually lands inside it. The polygon
# below is a hand-traced approximation (not survey-grade / not a legal
# boundary statement) good enough to eliminate the neighboring-country
# leakage for synthetic hackathon data. Mainland only — Andaman/Nicobar
# and Lakshadweep are out of scope since plant siting there is unrealistic
# for this dataset anyway.
INDIA_POLYGON = [
    (74.0, 32.5), (78.0, 34.5), (79.5, 33.0), (81.0, 30.5), (88.0, 27.9),
    (95.0, 29.0), (97.3, 27.0), (95.0, 23.5), (93.0, 24.0), (92.5, 21.5),
    (88.5, 22.0), (86.5, 20.0), (80.3, 13.1), (79.8, 8.9), (77.5, 8.1),
    (76.0, 9.0), (73.0, 15.5), (72.8, 19.0), (70.0, 22.5), (68.2, 23.7),
    (69.5, 26.0), (70.5, 28.0), (74.0, 32.5),
]


def _point_in_polygon(lon, lat, polygon):
    """Ray-casting point-in-polygon test. polygon is a list of (lon, lat)."""
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / (yj - yi) + xi
        ):
            inside = not inside
        j = i
    return inside


def _sample_india_coords(max_attempts=200):
    """Rejection-sample a (lat, lon) pair that actually falls within India's
    outline, not just its bounding rectangle."""
    for _ in range(max_attempts):
        lat = float(np.random.uniform(*INDIA_LAT_RANGE))
        lon = float(np.random.uniform(*INDIA_LON_RANGE))
        if _point_in_polygon(lon, lat, INDIA_POLYGON):
            return lat, lon
    # Fallback (should be unreachable given polygon fill ratio): clamp to a
    # known-interior point rather than silently returning an outside-India draw.
    return 22.0, 79.0

FRAUD_TYPES = [
    "duplicate_serial",
    "over_capacity",
    "impossible_timing",
    "timestamp_collision",
    "circular_trading",
]

ROUND_NUMBER_CHOICES = [10, 20, 25, 50, 75, 100, 120, 150, 200, 250, 300, 500]

party_ids = [f"PTY{str(i).zfill(5)}" for i in range(1, N_PARTIES + 1)]
generator_ids = party_ids[:N_GENERATORS]
trader_only_ids = party_ids[N_GENERATORS:]
party_id_index = {pid: i for i, pid in enumerate(party_ids)}

plant_attrs = {}
for gid in generator_ids:
    energy_source = np.random.choice(["solar", "wind"], p=[0.6, 0.4])
    rated_capacity = max(1.0, float(np.random.lognormal(mean=3.5, sigma=0.8)))
    lat, lon = _sample_india_coords()
    plant_attrs[gid] = {
        "energy_source": energy_source,
        "plant_lat": round(lat, 5),
        "plant_lon": round(lon, 5),
        "plant_rated_capacity_mwh": round(rated_capacity, 3),
    }

zipf_ranks = np.arange(1, N_PARTIES + 1)
buyer_weights_base = 1.0 / np.power(zipf_ranks, 1.3)
buyer_weights_base = buyer_weights_base / buyer_weights_base.sum()


def _pick_buyer(exclude=None):
    weights = buyer_weights_base.copy()
    if exclude is not None:
        weights[party_id_index[exclude]] = 0.0
        weights = weights / weights.sum()
    return np.random.choice(party_ids, p=weights)


def _random_generation_hour(energy_source, force_impossible=False):
    if energy_source == "solar":
        if force_impossible:
            return int(np.random.choice([0, 1, 2, 3, 4, 22, 23]))
        hour = np.clip(np.random.normal(loc=12, scale=2.5), 6, 18)
        return int(round(hour))
    return int(np.random.randint(0, 24))


def _random_date_within_window():
    offset_days = np.random.uniform(0, DATE_WINDOW_DAYS)
    return REFERENCE_DATE - timedelta(days=offset_days)


def generate_mock_certificates(count: int = 1200) -> pd.DataFrame:
    certificates = []
    for i in range(1, count + 1):
        cert_id = f"CERT{str(i).zfill(6)}"
        gid = np.random.choice(generator_ids)
        attrs = plant_attrs[gid]

        base_date = _random_date_within_window()
        hour = _random_generation_hour(attrs["energy_source"])
        generation_ts = base_date.replace(
            hour=hour, minute=int(np.random.randint(0, 60)),
            second=int(np.random.randint(0, 60)), microsecond=0,
        )

        issuance_gap_hours = min(float(np.random.exponential(scale=20)), 240)
        issuance_ts = generation_ts + timedelta(hours=issuance_gap_hours)

        if attrs["energy_source"] == "solar":
            capacity_factor = 0.10 + np.random.beta(2, 6) * 0.25
        else:
            capacity_factor = 0.15 + np.random.beta(3, 5) * 0.40

        claimed_mwh = round(capacity_factor * attrs["plant_rated_capacity_mwh"], 3)

        certificates.append({
            "certificate_id": cert_id,
            "generator_id": gid,
            "plant_lat": attrs["plant_lat"],
            "plant_lon": attrs["plant_lon"],
            "energy_source": attrs["energy_source"],
            "claimed_mwh": claimed_mwh,
            "plant_rated_capacity_mwh": attrs["plant_rated_capacity_mwh"],
            "generation_timestamp": generation_ts,
            "issuance_timestamp": issuance_ts,
            "is_fraud": False,
            "fraud_type": None,
        })

    certs_df = pd.DataFrame(certificates)
    certs_df = _inject_certificate_fraud(certs_df, count)
    return certs_df


def _inject_certificate_fraud(certs_df: pd.DataFrame, count: int) -> pd.DataFrame:
    n_fraud_total = int(round(count * FRAUD_RATE))
    n_per_type = max(1, n_fraud_total // len(FRAUD_TYPES))

    rng = np.random.default_rng(SEED)
    all_idx = certs_df.index.to_numpy().copy()
    rng.shuffle(all_idx)

    pools, cursor = {}, 0
    for ft in FRAUD_TYPES:
        pools[ft] = all_idx[cursor: cursor + n_per_type]
        cursor += n_per_type

    for j, idx in enumerate(pools["over_capacity"]):
        row = certs_df.loc[idx]
        bucket = j % 3
        if bucket == 0:
            ratio = np.random.uniform(3.0, 5.0)
            new_claimed = round(ratio * row["plant_rated_capacity_mwh"], 3)
        elif bucket == 1:
            ratio = np.random.uniform(1.10, 1.30)
            new_claimed = round(ratio * row["plant_rated_capacity_mwh"], 3)
        else:
            new_claimed = float(np.random.choice(ROUND_NUMBER_CHOICES))
            if new_claimed <= row["plant_rated_capacity_mwh"]:
                new_claimed = float(np.random.choice(
                    [v for v in ROUND_NUMBER_CHOICES if v > row["plant_rated_capacity_mwh"]]
                    or [row["plant_rated_capacity_mwh"] * 2]
                ))
        certs_df.at[idx, "claimed_mwh"] = new_claimed
        certs_df.at[idx, "is_fraud"] = True
        certs_df.at[idx, "fraud_type"] = "over_capacity"

    solar_pool = certs_df[certs_df["energy_source"] == "solar"].index.to_numpy()
    solar_pool = np.setdiff1d(solar_pool, np.concatenate(list(pools.values())))
    fixed_it_idx, extra_needed = [], 0
    for idx in pools["impossible_timing"]:
        if certs_df.at[idx, "energy_source"] == "solar":
            fixed_it_idx.append(idx)
        else:
            extra_needed += 1
    if extra_needed > 0 and len(solar_pool) >= extra_needed:
        fixed_it_idx.extend(np.random.choice(solar_pool, size=extra_needed, replace=False).tolist())
    for idx in fixed_it_idx:
        gen_ts = certs_df.at[idx, "generation_timestamp"]
        bad_hour = _random_generation_hour("solar", force_impossible=True)
        new_gen_ts = gen_ts.replace(hour=bad_hour)
        certs_df.at[idx, "generation_timestamp"] = new_gen_ts
        # BUGFIX: same issue as timestamp_collision — changing generation_timestamp's
        # hour can push it past the already-computed issuance_timestamp, producing a
        # negative gap. Recompute issuance_timestamp relative to the new generation time.
        gap_hours = min(float(np.random.exponential(scale=20)), 240)
        certs_df.at[idx, "issuance_timestamp"] = new_gen_ts + timedelta(hours=gap_hours)
        certs_df.at[idx, "is_fraud"] = True
        certs_df.at[idx, "fraud_type"] = "impossible_timing"

    tc_idx = pools["timestamp_collision"]
    for k in range(0, len(tc_idx) - 1, 2):
        idx_a, idx_b = tc_idx[k], tc_idx[k + 1]
        row_a = certs_df.loc[idx_a]
        for field in ("generator_id", "plant_lat", "plant_lon", "energy_source",
                      "plant_rated_capacity_mwh", "generation_timestamp"):
            certs_df.at[idx_b, field] = row_a[field]
        # BUGFIX: generation_timestamp was just overwritten on idx_b (and idx_a keeps
        # its own), but issuance_timestamp on BOTH rows was computed earlier against
        # whatever their original generation_timestamp was — now stale. Recompute
        # issuance_timestamp on both so it stays internally consistent (and non-negative)
        # relative to the now-shared generation_timestamp, using the same
        # exponential-gap logic used for every other certificate.
        shared_gen_ts = certs_df.at[idx_a, "generation_timestamp"]
        for idx in (idx_a, idx_b):
            gap_hours = min(float(np.random.exponential(scale=20)), 240)
            certs_df.at[idx, "issuance_timestamp"] = shared_gen_ts + timedelta(hours=gap_hours)
            certs_df.at[idx, "is_fraud"] = True
            certs_df.at[idx, "fraud_type"] = "timestamp_collision"

    for idx in pools["circular_trading"]:
        certs_df.at[idx, "is_fraud"] = True
        certs_df.at[idx, "fraud_type"] = "circular_trading"

    dup_rows = []
    for idx in pools["duplicate_serial"]:
        clone = certs_df.loc[idx].to_dict()
        clone["is_fraud"] = True
        clone["fraud_type"] = "duplicate_serial"
        dup_rows.append(clone)
    certs_df = pd.concat([certs_df, pd.DataFrame(dup_rows)], ignore_index=True)

    return certs_df


def generate_mock_transactions(certificates: pd.DataFrame, count: int = None) -> pd.DataFrame:
    transactions = []
    txn_counter = 1

    for _, row in certificates.iterrows():
        cert_id = row["certificate_id"]
        gid = row["generator_id"]
        gen_ts = row["generation_timestamp"]
        is_circular = row["fraud_type"] == "circular_trading"

        n_transfers = np.random.randint(2, 5)
        if is_circular:
            n_transfers = max(n_transfers, 3)
        first_buyer = _pick_buyer(exclude=gid)
        issuance_ts = gen_ts + timedelta(hours=np.random.uniform(0.1, 6))

        transactions.append({
            "transaction_id": f"TXN{str(txn_counter).zfill(7)}",
            "certificate_id": cert_id,
            "from_party_id": gid,
            "to_party_id": first_buyer,
            "transfer_timestamp": issuance_ts,
        })
        txn_counter += 1

        current_owner, t = first_buyer, issuance_ts

        if is_circular and n_transfers >= 3:
            loop_len = min(n_transfers, 4)
            chain = [current_owner]
            for _ in range(loop_len - 2):
                chain.append(_pick_buyer(exclude=chain[-1]))
            chain.append(gid)

            for a, b in zip(chain, chain[1:]):
                t = t + timedelta(hours=np.random.uniform(1, 48))
                transactions.append({
                    "transaction_id": f"TXN{str(txn_counter).zfill(7)}",
                    "certificate_id": cert_id,
                    "from_party_id": a,
                    "to_party_id": b,
                    "transfer_timestamp": t,
                })
                txn_counter += 1
        else:
            for _ in range(n_transfers - 1):
                nxt = _pick_buyer(exclude=current_owner)
                t = t + timedelta(hours=np.random.uniform(1, 72))
                transactions.append({
                    "transaction_id": f"TXN{str(txn_counter).zfill(7)}",
                    "certificate_id": cert_id,
                    "from_party_id": current_owner,
                    "to_party_id": nxt,
                    "transfer_timestamp": t,
                })
                current_owner = nxt
                txn_counter += 1

    return pd.DataFrame(transactions)


if __name__ == "__main__":
    certs_df = generate_mock_certificates(count=1200)
    txns_df = generate_mock_transactions(certs_df)

    # Portable across Windows/Mac/Linux, and relative to wherever this script
    # lives (not the current working directory) so it works regardless of how
    # it's invoked. Writes to a "data" folder next to this script, creating it
    # if it doesn't already exist.
    output_dir = Path(__file__).resolve().parent / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    certs_df.to_csv(output_dir / "certificates.csv", index=False)
    txns_df.to_csv(output_dir / "transactions.csv", index=False)

    print("=== CERTIFICATES ===")
    print(f"Total rows: {len(certs_df)}")
    print(f"Unique certificate_id count: {certs_df['certificate_id'].nunique()}")
    print(f"Fraud rows: {certs_df['is_fraud'].sum()} "
          f"({certs_df['is_fraud'].mean()*100:.1f}%)")
    print("\nFraud type breakdown:")
    print(certs_df.loc[certs_df["is_fraud"], "fraud_type"].value_counts())

    n_outside = sum(
        0 if _point_in_polygon(lon, lat, INDIA_POLYGON) else 1
        for lat, lon in zip(
            [plant_attrs[g]["plant_lat"] for g in generator_ids],
            [plant_attrs[g]["plant_lon"] for g in generator_ids],
        )
    )
    print(f"\nPlants with coords outside India polygon (should be 0): {n_outside} / {len(generator_ids)}")

    print("\n=== TRANSACTIONS ===")
    print(f"Total rows: {len(txns_df)}")
    print(f"Avg transfers per certificate: {len(txns_df) / certs_df['certificate_id'].nunique():.2f}")

    gen_map = certs_df.drop_duplicates("certificate_id").set_index("certificate_id")["generator_id"]
    issuance_check = txns_df.groupby("certificate_id").apply(
        lambda g: (g["from_party_id"] == gen_map.get(g.name)).any(), include_groups=False
    )
    print(f"\nCertificates WITHOUT a valid issuance row (should be 0): {(~issuance_check).sum()}")

    oc_rows = certs_df[certs_df["fraud_type"] == "over_capacity"]
    round_padded = oc_rows["claimed_mwh"].apply(lambda v: v == int(v) and v in
                                                 [float(x) for x in ROUND_NUMBER_CHOICES])
    print(f"over_capacity rows using round-number padding: {round_padded.sum()} / {len(oc_rows)}")

    circular_certs = certs_df[certs_df["fraud_type"] == "circular_trading"]["certificate_id"]
    n_missing_cycle = 0
    for cert_id in circular_certs:
        gid = gen_map.get(cert_id)
        chain = txns_df[txns_df["certificate_id"] == cert_id].sort_values("transfer_timestamp")
        has_cycle = (chain.iloc[1:]["to_party_id"] == gid).any()
        if not has_cycle:
            n_missing_cycle += 1
    print(f"\ncircular_trading certs WITHOUT an actual cycle (should be 0): {n_missing_cycle} / {len(circular_certs)}")
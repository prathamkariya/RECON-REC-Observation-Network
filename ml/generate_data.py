"""
Role 1: Synthetic Dataset Generator — REC Fraud Detection
HackOut'26, Team Synapse'27

Generates `certificates` and `transactions` tables with seeded fraud patterns.
This is the single source of truth for data generation — supersedes any earlier
draft versions (generate_data.py / dataset_generator.py stub).

Locked team decisions this implements:
  - All timestamps stored directly in IST (UTC+5:30), no conversion.
  - generator_id and party_id share one ID namespace; issuance is always
    transaction row #1 for a certificate (from_party_id == generator_id).
  - is_fraud / fraud_type are ground-truth labels for EVALUATION ONLY —
    never to be used as a model feature by any role.

Design note on over_capacity fraud (added after Benford's Law discussion):
  Fraud is split into three sub-patterns, not two — obvious, subtle, AND a
  "round-number padding" variant. Purely random continuous over-capacity
  ratios don't violate Benford's Law (a leading-digit statistical check
  planned for feature engineering); a fabricator manually padding a report
  tends to pick suspiciously round figures (e.g. exactly 50.0, 100.0, 120.0
  MWh), which DOES produce an unnatural leading-digit distribution. Without
  this, the Benford feature would have nothing real to detect on this
  synthetic dataset.

Reproducible: seed=42 throughout.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ----------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------
SEED = 42
np.random.seed(SEED)

N_PARTIES = 400                # shared ID namespace: generators + traders/brokers/consumers
N_GENERATORS = 180             # subset of parties that are actual power plants
FRAUD_RATE = 0.175             # within the 15-20% target band
DATE_WINDOW_DAYS = 90
REFERENCE_DATE = datetime(2026, 9, 12)   # "today", IST assumed, no tz conversion

INDIA_LAT_RANGE = (8.0, 37.0)
INDIA_LON_RANGE = (68.0, 97.0)

FRAUD_TYPES = [
    "duplicate_serial",
    "over_capacity",
    "impossible_timing",
    "timestamp_collision",
    "circular_trading",
]

# Round-number values a fabricator might plausibly pad a report to.
# Used only for the "round-number padding" over_capacity sub-pattern.
ROUND_NUMBER_CHOICES = [10, 20, 25, 50, 75, 100, 120, 150, 200, 250, 300, 500]

# ----------------------------------------------------------------------
# Party / generator ID pool (shared namespace, per locked decision)
# ----------------------------------------------------------------------
party_ids = [f"PTY{str(i).zfill(5)}" for i in range(1, N_PARTIES + 1)]
generator_ids = party_ids[:N_GENERATORS]           # can appear as generator_id
trader_only_ids = party_ids[N_GENERATORS:]         # pure downstream market participants
party_id_index = {pid: i for i, pid in enumerate(party_ids)}

# Fixed physical attributes per plant — consistent across every certificate
# it issues (needed for the per_plant_utilization_zscore feature later).
plant_attrs = {}
for gid in generator_ids:
    energy_source = np.random.choice(["solar", "wind"], p=[0.6, 0.4])
    rated_capacity = max(1.0, float(np.random.lognormal(mean=3.5, sigma=0.8)))  # MWh
    plant_attrs[gid] = {
        "energy_source": energy_source,
        "plant_lat": round(float(np.random.uniform(*INDIA_LAT_RANGE)), 5),
        "plant_lon": round(float(np.random.uniform(*INDIA_LON_RANGE)), 5),
        "plant_rated_capacity_mwh": round(rated_capacity, 3),
    }

# Buyer concentration: power-law weighting so a handful of parties dominate
# as buyers (Zipf-like), per the buyer_concentration distribution.
zipf_ranks = np.arange(1, N_PARTIES + 1)
buyer_weights_base = 1.0 / np.power(zipf_ranks, 1.3)
buyer_weights_base = buyer_weights_base / buyer_weights_base.sum()


def _pick_buyer(exclude=None):
    """Pick a counterparty using the power-law buyer-concentration weights."""
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
    return int(np.random.randint(0, 24))  # wind — uniform across 24 hours


def _random_date_within_window():
    offset_days = np.random.uniform(0, DATE_WINDOW_DAYS)
    return REFERENCE_DATE - timedelta(days=offset_days)


# ----------------------------------------------------------------------
# Certificates
# ----------------------------------------------------------------------
def generate_mock_certificates(count: int = 1200) -> pd.DataFrame:
    """
    Generates synthetic certificates with seeded fraud patterns.

    Injects all 5 fraud types at ~17.5% of `count`, roughly evenly split.
    Note: duplicate_serial adds extra rows sharing an existing certificate_id,
    so the returned DataFrame will have slightly more rows than `count`.
    """
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

        # issuance_velocity: generation -> issuance gap, exponential
        issuance_gap_hours = min(float(np.random.exponential(scale=20)), 240)
        issuance_ts = generation_ts + timedelta(hours=issuance_gap_hours)

        # claimed_mwh as a capacity factor, beta distribution, scaled by rated capacity
        if attrs["energy_source"] == "solar":
            capacity_factor = 0.10 + np.random.beta(2, 6) * 0.25       # ~10-35%
        else:
            capacity_factor = 0.15 + np.random.beta(3, 5) * 0.40       # ~15-55%

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

    # --- over_capacity: 3 sub-patterns — obvious / subtle / round-number padding ---
    for j, idx in enumerate(pools["over_capacity"]):
        row = certs_df.loc[idx]
        bucket = j % 3
        if bucket == 0:
            # obvious continuous fraud
            ratio = np.random.uniform(3.0, 5.0)
            new_claimed = round(ratio * row["plant_rated_capacity_mwh"], 3)
        elif bucket == 1:
            # subtle continuous fraud
            ratio = np.random.uniform(1.10, 1.30)
            new_claimed = round(ratio * row["plant_rated_capacity_mwh"], 3)
        else:
            # round-number padding — the pattern Benford's Law can actually catch
            new_claimed = float(np.random.choice(ROUND_NUMBER_CHOICES))
            # ensure it's still genuinely over capacity, bump up if not
            if new_claimed <= row["plant_rated_capacity_mwh"]:
                new_claimed = float(np.random.choice(
                    [v for v in ROUND_NUMBER_CHOICES if v > row["plant_rated_capacity_mwh"]]
                    or [row["plant_rated_capacity_mwh"] * 2]
                ))
        certs_df.at[idx, "claimed_mwh"] = new_claimed
        certs_df.at[idx, "is_fraud"] = True
        certs_df.at[idx, "fraud_type"] = "over_capacity"

    # --- impossible_timing: solar plants only ---
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
        certs_df.at[idx, "generation_timestamp"] = gen_ts.replace(hour=bad_hour)
        certs_df.at[idx, "is_fraud"] = True
        certs_df.at[idx, "fraud_type"] = "impossible_timing"

    # --- timestamp_collision: pair certs onto the same plant + exact timestamp ---
    tc_idx = pools["timestamp_collision"]
    for k in range(0, len(tc_idx) - 1, 2):
        idx_a, idx_b = tc_idx[k], tc_idx[k + 1]
        row_a = certs_df.loc[idx_a]
        for field in ("generator_id", "plant_lat", "plant_lon", "energy_source",
                      "plant_rated_capacity_mwh", "generation_timestamp"):
            certs_df.at[idx_b, field] = row_a[field]
        for idx in (idx_a, idx_b):
            certs_df.at[idx, "is_fraud"] = True
            certs_df.at[idx, "fraud_type"] = "timestamp_collision"

    # --- circular_trading: flag now, loop is built in generate_mock_transactions ---
    for idx in pools["circular_trading"]:
        certs_df.at[idx, "is_fraud"] = True
        certs_df.at[idx, "fraud_type"] = "circular_trading"

    # --- duplicate_serial: clone rows under the SAME certificate_id ---
    dup_rows = []
    for idx in pools["duplicate_serial"]:
        clone = certs_df.loc[idx].to_dict()
        clone["is_fraud"] = True
        clone["fraud_type"] = "duplicate_serial"
        dup_rows.append(clone)
    certs_df = pd.concat([certs_df, pd.DataFrame(dup_rows)], ignore_index=True)

    return certs_df


# ----------------------------------------------------------------------
# Transactions
# ----------------------------------------------------------------------
def generate_mock_transactions(certificates: pd.DataFrame, count: int = None) -> pd.DataFrame:
    """
    Generates synthetic transactions with seeded circular rings.

    Takes the certificates DataFrame from generate_mock_certificates() — transactions
    are derived from real certificates, not generated independently, since every
    transaction needs a real certificate_id/generator_id/generation_timestamp to
    attach to. `count` is accepted for interface compatibility but unused: the
    number of transactions is determined by certificates * (2-4 transfers each).
    """
    transactions = []
    txn_counter = 1

    for _, row in certificates.iterrows():
        cert_id = row["certificate_id"]
        gid = row["generator_id"]
        gen_ts = row["generation_timestamp"]
        is_circular = row["fraud_type"] == "circular_trading"

        n_transfers = np.random.randint(2, 5)  # 2-4 transfers
        if is_circular:
            # A cycle needs at least 3 transfers (buyer -> ... -> back to generator).
            # Without this floor, ~1/3 of circular_trading-labeled certs would draw
            # n_transfers == 2, fall into the linear branch below, and end up with
            # NO actual cycle despite the label — silently corrupting recall on this
            # fraud type. Every circular_trading cert must contain a real cycle.
            n_transfers = max(n_transfers, 3)
        first_buyer = _pick_buyer(exclude=gid)
        issuance_ts = gen_ts + timedelta(hours=np.random.uniform(0.1, 6))

        # Transaction row #1 is always issuance: from_party_id == generator_id
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
            chain.append(gid)  # close the loop back to the original generator

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


# ----------------------------------------------------------------------
# Main — generate, export, sanity-check
# ----------------------------------------------------------------------
if __name__ == "__main__":
    certs_df = generate_mock_certificates(count=1200)
    txns_df = generate_mock_transactions(certs_df)

    certs_df.to_csv("/mnt/user-data/outputs/certificates.csv", index=False)
    txns_df.to_csv("/mnt/user-data/outputs/transactions.csv", index=False)

    print("=== CERTIFICATES ===")
    print(f"Total rows: {len(certs_df)}")
    print(f"Unique certificate_id count: {certs_df['certificate_id'].nunique()}")
    print(f"Fraud rows: {certs_df['is_fraud'].sum()} "
          f"({certs_df['is_fraud'].mean()*100:.1f}%)")
    print("\nFraud type breakdown:")
    print(certs_df.loc[certs_df["is_fraud"], "fraud_type"].value_counts())

    print("\n=== TRANSACTIONS ===")
    print(f"Total rows: {len(txns_df)}")
    print(f"Avg transfers per certificate: {len(txns_df) / certs_df['certificate_id'].nunique():.2f}")

    # Every certificate must have at least one row where from_party_id == generator_id
    gen_map = certs_df.drop_duplicates("certificate_id").set_index("certificate_id")["generator_id"]
    issuance_check = txns_df.groupby("certificate_id").apply(
        lambda g: (g["from_party_id"] == gen_map.get(g.name)).any(), include_groups=False
    )
    print(f"\nCertificates WITHOUT a valid issuance row (should be 0): {(~issuance_check).sum()}")

    # Quick check: how many over_capacity frauds landed on a round claimed_mwh value
    oc_rows = certs_df[certs_df["fraud_type"] == "over_capacity"]
    round_padded = oc_rows["claimed_mwh"].apply(lambda v: v == int(v) and v in
                                                 [float(x) for x in ROUND_NUMBER_CHOICES])
    print(f"over_capacity rows using round-number padding: {round_padded.sum()} / {len(oc_rows)}")

    # Every circular_trading-labeled certificate must actually contain a cycle
    # back to its own generator_id — otherwise the label is meaningless for eval.
    circular_certs = certs_df[certs_df["fraud_type"] == "circular_trading"]["certificate_id"]
    n_missing_cycle = 0
    for cert_id in circular_certs:
        gid = gen_map.get(cert_id)
        chain = txns_df[txns_df["certificate_id"] == cert_id].sort_values("transfer_timestamp")
        # a real cycle means some row (after the first) has to_party_id == gid
        has_cycle = (chain.iloc[1:]["to_party_id"] == gid).any()
        if not has_cycle:
            n_missing_cycle += 1
    print(f"\ncircular_trading certs WITHOUT an actual cycle (should be 0): {n_missing_cycle} / {len(circular_certs)}")
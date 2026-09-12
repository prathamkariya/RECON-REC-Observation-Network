"""
Role 1: Feature Engineering — REC Fraud Detection
HackOut'26, Team Synapse'27

Builds the 7 engineered features from certificates.csv + transactions.csv:
  1. capacity_utilization_ratio
  2. time_of_day_plausibility
  3. issuance_velocity
  4. buyer_concentration
  5. serial_duplicate_flag
  6. per_plant_utilization_zscore
  7. generator_benford_deviation

Outputs TWO separate files, deliberately:
  - features.csv  -> certificate_id + engineered features only (model input, X)
  - labels.csv    -> certificate_id + is_fraud + fraud_type (evaluation only, y)

Keeping these physically separate (not just separate columns in one file) makes it
harder to accidentally wire is_fraud/fraud_type into a training pipeline later —
per the team's locked rule that these labels are eval-only.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from scipy.stats import chisquare

# Portable across Windows/Mac/Linux, and relative to wherever this script lives
# (not the current working directory). Expects generate_data.py's "data" folder
# to sit next to this script (or adjust DATA_DIR if your layout differs).
DATA_DIR = Path(__file__).resolve().parent / "data"
INPUT_CERTS = DATA_DIR / "certificates.csv"
INPUT_TXNS = DATA_DIR / "transactions.csv"
OUTPUT_FEATURES = DATA_DIR / "features.csv"
OUTPUT_LABELS = DATA_DIR / "labels.csv"

BENFORD_EXPECTED = {d: np.log10(1 + 1 / d) for d in range(1, 10)}
MIN_SAMPLES_FOR_BENFORD = 15  # below this, the chi-square test isn't meaningful


# ----------------------------------------------------------------------
# Feature 1 — capacity_utilization_ratio
# ----------------------------------------------------------------------
def add_capacity_utilization_ratio(certs_df: pd.DataFrame) -> pd.DataFrame:
    certs_df["capacity_utilization_ratio"] = (
        certs_df["claimed_mwh"] / certs_df["plant_rated_capacity_mwh"]
    )
    return certs_df


# ----------------------------------------------------------------------
# Feature 2 — time_of_day_plausibility
# ----------------------------------------------------------------------
def add_time_of_day_plausibility(certs_df: pd.DataFrame) -> pd.DataFrame:
    """
    Binary flag: 1 = implausible generation hour, 0 = plausible.
    Solar outside 06:00-18:00 is implausible. Wind has no timing constraint
    (uniform across 24h is the expected/legitimate pattern for wind).
    """
    gen_hour = pd.to_datetime(certs_df["generation_timestamp"]).dt.hour

    def flag(row_source, hour):
        energy_source, h = row_source
        if energy_source == "solar":
            return int(h < 6 or h > 18)
        return 0  # wind — no implausible hour

    certs_df["time_of_day_plausibility"] = [
        flag((es, h), h) for es, h in zip(certs_df["energy_source"], gen_hour)
    ]
    return certs_df


# ----------------------------------------------------------------------
# Feature 3 — issuance_velocity
# ----------------------------------------------------------------------
def add_issuance_velocity(certs_df: pd.DataFrame) -> pd.DataFrame:
    """Hours between generation_timestamp and issuance_timestamp."""
    gen_ts = pd.to_datetime(certs_df["generation_timestamp"])
    iss_ts = pd.to_datetime(certs_df["issuance_timestamp"])
    certs_df["issuance_velocity"] = (iss_ts - gen_ts).dt.total_seconds() / 3600.0
    return certs_df


# ----------------------------------------------------------------------
# Feature 4 — buyer_concentration
# ----------------------------------------------------------------------
def add_buyer_concentration(certs_df: pd.DataFrame, txns_df: pd.DataFrame) -> pd.DataFrame:
    """
    Global frequency share of each party as a buyer (to_party_id) across ALL
    transactions. For each certificate, take the MAX concentration among every
    party that ever held it in its chain — if any party in the chain is a
    disproportionately frequent buyer (potential wash-trading hub), the
    certificate inherits that elevated risk.
    """
    buyer_counts = txns_df["to_party_id"].value_counts()
    buyer_share = buyer_counts / buyer_counts.sum()

    # every party that received this certificate at any point in its chain
    chain_buyers = txns_df.groupby("certificate_id")["to_party_id"].apply(list)

    def max_concentration(cert_id):
        parties = chain_buyers.get(cert_id, [])
        if not parties:
            return 0.0
        return max(buyer_share.get(p, 0.0) for p in parties)

    certs_df["buyer_concentration"] = certs_df["certificate_id"].apply(max_concentration)
    return certs_df


# ----------------------------------------------------------------------
# Feature 5 — serial_duplicate_flag
# ----------------------------------------------------------------------
def add_serial_duplicate_flag(certs_df: pd.DataFrame) -> pd.DataFrame:
    dup_counts = certs_df["certificate_id"].value_counts()
    certs_df["serial_duplicate_flag"] = certs_df["certificate_id"].apply(
        lambda cid: int(dup_counts.get(cid, 1) > 1)
    )
    return certs_df


# ----------------------------------------------------------------------
# Feature 6 — per_plant_utilization_zscore
# ----------------------------------------------------------------------
def add_per_plant_utilization_zscore(certs_df: pd.DataFrame) -> pd.DataFrame:
    """
    A plant's capacity_utilization_ratio relative to ITS OWN historical mean/std,
    not a global threshold — catches serial offenders hiding under a global average.
    """
    def zscore_group(group):
        mean = group.mean()
        std = group.std()
        if std == 0 or pd.isna(std):
            return pd.Series(0.0, index=group.index)
        return (group - mean) / std

    certs_df["per_plant_utilization_zscore"] = (
        certs_df.groupby("generator_id")["capacity_utilization_ratio"]
        .transform(lambda g: zscore_group(g))
    )
    return certs_df


# ----------------------------------------------------------------------
# Feature 7 — generator_benford_deviation
# ----------------------------------------------------------------------
def _leading_digit(value):
    value = abs(value)
    if value == 0:
        return None
    while value < 1:
        value *= 10
    while value >= 10:
        value /= 10
    return int(value)


def _benford_deviation_score(claimed_values):
    digits = [_leading_digit(v) for v in claimed_values if v and v > 0]
    n = len(digits)
    if n < MIN_SAMPLES_FOR_BENFORD:
        return np.nan

    observed_counts = pd.Series(digits).value_counts().reindex(range(1, 10), fill_value=0)
    expected_counts = pd.Series(BENFORD_EXPECTED) * n

    _, p_value = chisquare(observed_counts, expected_counts)
    return 1 - p_value  # higher = more suspicious (further from Benford's expected curve)


def add_generator_benford_deviation(certs_df: pd.DataFrame) -> pd.DataFrame:
    scores = {
        gid: _benford_deviation_score(group["claimed_mwh"].values)
        for gid, group in certs_df.groupby("generator_id")
    }
    certs_df["generator_benford_deviation"] = certs_df["generator_id"].map(scores)
    # generators with too few certs to test get NaN -> impute 0 (no evidence either way)
    certs_df["generator_benford_deviation"] = certs_df["generator_benford_deviation"].fillna(0.0)
    return certs_df


# ----------------------------------------------------------------------
# Main pipeline
# ----------------------------------------------------------------------
def main():
    if not INPUT_CERTS.exists() or not INPUT_TXNS.exists():
        raise FileNotFoundError(
            f"Expected input files not found at {DATA_DIR}. "
            f"Run generate_data.py first — it writes certificates.csv and "
            f"transactions.csv into a 'data' folder next to itself."
        )

    certs_df = pd.read_csv(INPUT_CERTS)
    txns_df = pd.read_csv(INPUT_TXNS)

    certs_df = add_capacity_utilization_ratio(certs_df)
    certs_df = add_time_of_day_plausibility(certs_df)
    certs_df = add_issuance_velocity(certs_df)
    certs_df = add_buyer_concentration(certs_df, txns_df)
    certs_df = add_serial_duplicate_flag(certs_df)
    certs_df = add_per_plant_utilization_zscore(certs_df)
    certs_df = add_generator_benford_deviation(certs_df)

    feature_cols = [
        "capacity_utilization_ratio",
        "time_of_day_plausibility",
        "issuance_velocity",
        "buyer_concentration",
        "serial_duplicate_flag",
        "per_plant_utilization_zscore",
        "generator_benford_deviation",
    ]

    # --- leakage guard: confirm none of the 7 features trivially encode is_fraud ---
    for col in feature_cols:
        # a feature is suspicious if it perfectly separates fraud from non-fraud
        corr = certs_df[col].astype(float).corr(certs_df["is_fraud"].astype(float))
        if abs(corr) > 0.95:
            print(f"WARNING: '{col}' has suspiciously high correlation with is_fraud "
                  f"({corr:.3f}) — check for label leakage before using this feature.")

    # --- normalize features onto comparable ranges (z-score standardization) ---
    features_out = certs_df[["certificate_id"] + feature_cols].copy()
    for col in feature_cols:
        mean, std = features_out[col].mean(), features_out[col].std()
        if std > 0:
            features_out[col + "_scaled"] = (features_out[col] - mean) / std
        else:
            features_out[col + "_scaled"] = 0.0

    labels_out = certs_df[["certificate_id", "is_fraud", "fraud_type"]].copy()

    features_out.to_csv(OUTPUT_FEATURES, index=False)
    labels_out.to_csv(OUTPUT_LABELS, index=False)

    # --- summary ---
    print("=== FEATURES ===")
    print(f"Rows: {len(features_out)}  |  Columns: {list(features_out.columns)}")
    print("\nRaw feature stats:")
    print(certs_df[feature_cols].describe().T[["mean", "std", "min", "max"]])

    print("\n=== LABELS (eval-only, not joined into features.csv) ===")
    print(f"Rows: {len(labels_out)}")
    print(f"Fraud rate: {labels_out['is_fraud'].mean()*100:.1f}%")

    print("\n=== SAMPLE ===")
    print(features_out.head(3).to_string())


if __name__ == "__main__":
    main()
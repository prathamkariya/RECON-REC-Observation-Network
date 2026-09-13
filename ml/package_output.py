"""
Role 1: Final Output Packaging — REC Fraud Detection
HackOut'26, Team Synapse'27

Implements Step 5 from role1-final-status-and-remaining-work.md:

Step 5: Package the output and hand off
  Final per-certificate output, exact shape to agree with Roles 3 & 4:
    { "certificate_id": "...", "statistical_risk": 0.0 }
  - Role 3 (Ledger & Cloud): this becomes a column in their hash-chained record.
  - Role 4 (Backend API): give them a mock version (a handful of fake rows)
    immediately, don't make them wait for your trained model.
  - Role 2 (Graph, Physical & Explainability): needs the *meaning* of your
    score explained (what does 0.9 vs 0.5 indicate), since it feeds their
    Claude explanation prompt.

NOTE - one deliberate deviation from train_model.py, called out explicitly:
Steps 1-3 held out 20% of the data purely to get an honest, non-overfit
read on precision/recall/F1 before picking contamination=0.17. That
holdout split was for MODEL VALIDATION, not for producing final scores -
once the model choice is validated, the final delivered statistical_risk
values are produced by retraining IsolationForest on the FULL dataset
(all 1242 rows), so Roles 3/4 get a score for every certificate, not just
the 20% that happened to land in the eval holdout. Same contamination
(0.17), same n_estimators (100), same random_state (42) as train_model.py -
only the training data changes (full set vs. 80% split).
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
if not DATA_DIR.exists():
    DATA_DIR = Path(__file__).resolve().parent / "data"
FEATURES_PATH = DATA_DIR / "features.csv"
LABELS_PATH = DATA_DIR / "labels.csv"

CONTAMINATION = 0.17
MAX_SAMPLES = 512
N_ESTIMATORS = 100
RANDOM_STATE = 42

def main():
    features_df = pd.read_csv(FEATURES_PATH)
    labels_df = pd.read_csv(LABELS_PATH)
    scaled_cols = [c for c in features_df.columns if c.endswith("_scaled")]

    # --- Step 1: Fit Isolation Forest on FULL dataset ---
    model = IsolationForest(
        n_estimators=N_ESTIMATORS,
        max_samples=MAX_SAMPLES,
        contamination=CONTAMINATION,
        random_state=RANDOM_STATE,
    )
    model.fit(features_df[scaled_cols])

    raw_scores = -model.decision_function(features_df[scaled_cols])

    # --- Step 2: Platt Scaling (Probability Calibration) ---
    y_full = labels_df["is_fraud"].astype(int).values
    platt = LogisticRegression(random_state=RANDOM_STATE)
    platt.fit(raw_scores.reshape(-1, 1), y_full)
    prob_full = platt.predict_proba(raw_scores.reshape(-1, 1))[:, 1]

    # --- Step 3: Deterministic Physical Anchors ---
    col_flag = features_df["timestamp_collision_flag"].values
    serial_flag = features_df["serial_duplicate_flag"].values
    statistical_risk = np.maximum.reduce([prob_full, col_flag, serial_flag])

    output_df = pd.DataFrame({
        "certificate_id": features_df["certificate_id"],
        "statistical_risk": statistical_risk.round(4),
    })

    # --- Write to handoff folder (used by Role 3 Ledger & Role 4 Backend) ---
    handoff_dir = Path(__file__).resolve().parent / "handoff"
    handoff_dir.mkdir(exist_ok=True)

    records = output_df.to_dict(orient="records")

    output_df.to_csv(handoff_dir / "final_stat_risk.csv", index=False)
    with open(handoff_dir / "final_stat_risk.json", "w") as f:
        json.dump(records, f, indent=2)

    print("=== FINAL PACKAGED OUTPUT ===")
    print(f"Rows: {len(output_df)}")
    print(f"statistical_risk range: {statistical_risk.min():.4f} - {statistical_risk.max():.4f}")
    print(f"Mean: {statistical_risk.mean():.4f}  |  Median: {np.median(statistical_risk):.4f}")
    print("\nSample rows:")
    print(output_df.head(5).to_string(index=False))
    print(f"\nSaved to: {handoff_dir}")

    # --- Mock handoff sample for Role 4, so they don't wait on the real model ---
    mock_rows = [
        {"certificate_id": "CERT_MOCK_001", "statistical_risk": 0.04},
        {"certificate_id": "CERT_MOCK_002", "statistical_risk": 0.12},
        {"certificate_id": "CERT_MOCK_003", "statistical_risk": 0.31},
        {"certificate_id": "CERT_MOCK_004", "statistical_risk": 0.48},
        {"certificate_id": "CERT_MOCK_005", "statistical_risk": 0.55},
        {"certificate_id": "CERT_MOCK_006", "statistical_risk": 0.67},
        {"certificate_id": "CERT_MOCK_007", "statistical_risk": 0.82},
        {"certificate_id": "CERT_MOCK_008", "statistical_risk": 0.94},
    ]
    with open(handoff_dir / "mock_risk_for4.json", "w") as f:
        json.dump(mock_rows, f, indent=2)


if __name__ == "__main__":
    main()
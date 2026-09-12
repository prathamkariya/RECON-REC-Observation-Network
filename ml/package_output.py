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

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FEATURES_PATH = DATA_DIR / "features.csv"

CONTAMINATION = 0.17
N_ESTIMATORS = 100
RANDOM_STATE = 42

OUTPUT_DIR = Path(__file__).resolve().parent / "handoff"


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    features_df = pd.read_csv(FEATURES_PATH)
    scaled_cols = [c for c in features_df.columns if c.endswith("_scaled")]

    # --- Retrain on FULL dataset for final delivered scores (see module docstring) ---
    model = IsolationForest(
        n_estimators=N_ESTIMATORS,
        contamination=CONTAMINATION,
        random_state=RANDOM_STATE,
    )
    model.fit(features_df[scaled_cols])

    raw_scores = model.decision_function(features_df[scaled_cols])  # higher = more normal
    anomaly_scores = -raw_scores  # higher = more suspicious

    # Min-max normalize to [0, 1] so Role 3/Role 2 get a stable, bounded scale
    # rather than an unbounded/unintuitive raw decision_function value.
    min_s, max_s = anomaly_scores.min(), anomaly_scores.max()
    statistical_risk = (anomaly_scores - min_s) / (max_s - min_s)

    output_df = pd.DataFrame({
        "certificate_id": features_df["certificate_id"],
        "statistical_risk": statistical_risk.round(4),
    })

    # --- Exact shape from the doc: { "certificate_id": ..., "statistical_risk": ... } ---
    output_df.to_csv(OUTPUT_DIR / "final_statistical_risk.csv", index=False)
    with open(OUTPUT_DIR / "final_statistical_risk.json", "w") as f:
        json.dump(output_df.to_dict(orient="records"), f, indent=2)

    print("=== FINAL PACKAGED OUTPUT ===")
    print(f"Rows: {len(output_df)}")
    print(f"statistical_risk range: {statistical_risk.min():.4f} - {statistical_risk.max():.4f}")
    print(f"Mean: {statistical_risk.mean():.4f}  |  Median: {np.median(statistical_risk):.4f}")
    print("\nSample rows:")
    print(output_df.head(5).to_string(index=False))
    print(f"\nSaved: {OUTPUT_DIR / 'final_statistical_risk.csv'}")
    print(f"Saved: {OUTPUT_DIR / 'final_statistical_risk.json'}")

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
    with open(OUTPUT_DIR / "mock_statistical_risk_for_role4.json", "w") as f:
        json.dump(mock_rows, f, indent=2)
    pd.DataFrame(mock_rows).to_csv(OUTPUT_DIR / "mock_statistical_risk_for_role4.csv", index=False)
    print(f"\nSaved (Role 4 mock, doesn't depend on the trained model): "
          f"{OUTPUT_DIR / 'mock_statistical_risk_for_role4.json'}")


if __name__ == "__main__":
    main()
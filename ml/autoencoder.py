"""
Role 1: Benchmark Model — Autoencoder — REC Fraud Detection
HackOut'26, Team Synapse'27

Implements Step 4 from role1-final-status-and-remaining-work.md exactly:

Step 4: Optional benchmark model
  - Train a One-Class SVM (or small autoencoder) on the same data, purely
    for a comparison table in the report ("we benchmarked X, chose Isolation
    Forest because Y"). Never wire this into the real pipeline.

No TensorFlow/Keras available in this environment (no network access to
install it) — the doc explicitly allows scikit-learn as the alternative, so
this is a "plain autoencoder" built with sklearn.neural_network.MLPRegressor:
input = output, with a bottleneck hidden layer forcing compression.
Reconstruction error (MSE between input and reconstructed output) is the
anomaly score - same anomaly-detection principle as a Keras autoencoder,
just without the dependency.

Uses the SAME train/holdout split and SAME evaluation approach as
train_model.py (Isolation Forest), so the two are directly comparable in
the report's comparison table. This script does NOT touch the Isolation
Forest pipeline or its outputs - fully separate, benchmark-only, per the doc.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.neural_network import MLPRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, precision_recall_curve
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FEATURES_PATH = DATA_DIR / "features.csv"
LABELS_PATH = DATA_DIR / "labels.csv"

CONTAMINATION = 0.17  # same starting point as the Isolation Forest, for a fair comparison
RANDOM_STATE = 42
TEST_SIZE = 0.20  # same ~80/20 split as train_model.py

# Bottleneck architecture: 7 scaled features -> compress -> reconstruct.
# Small on purpose ("plain autoencoder", per the doc) - this is a benchmark,
# not the production model.
HIDDEN_LAYERS = (5, 2, 5)


def main():
    features_df = pd.read_csv(FEATURES_PATH)
    labels_df = pd.read_csv(LABELS_PATH)

    scaled_cols = [c for c in features_df.columns if c.endswith("_scaled")]
    X = features_df[["certificate_id"] + scaled_cols].copy()

    # Same split, same random_state as train_model.py, so both benchmarks
    # are evaluated on the identical holdout set.
    X_train, X_holdout = train_test_split(
        X, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )

    # Train unsupervised: autoencoder learns to reconstruct NORMAL patterns
    # from the training features. No labels used in training.
    autoencoder = MLPRegressor(
        hidden_layer_sizes=HIDDEN_LAYERS,
        activation="relu",
        solver="adam",
        max_iter=2000,
        random_state=RANDOM_STATE,
    )
    X_train_features = X_train[scaled_cols].values
    autoencoder.fit(X_train_features, X_train_features)  # input = output

    # Reconstruction error on holdout = anomaly score (higher = more suspicious)
    X_holdout_features = X_holdout[scaled_cols].values
    reconstructed = autoencoder.predict(X_holdout_features)
    reconstruction_error = np.mean((X_holdout_features - reconstructed) ** 2, axis=1)

    holdout_eval = X_holdout[["certificate_id"]].copy()
    holdout_eval["anomaly_score"] = reconstruction_error
    holdout_eval = holdout_eval.join(labels_df[["is_fraud", "fraud_type"]])  # BUGFIX: same as train_model.py — aligned by row index, not merged on certificate_id

    # Threshold at the (1 - contamination) percentile of reconstruction error,
    # same contamination rate as the Isolation Forest benchmark, for a fair comparison.
    threshold = np.percentile(reconstruction_error, 100 * (1 - CONTAMINATION))
    holdout_eval["predicted_fraud"] = (holdout_eval["anomaly_score"] >= threshold).astype(int)

    y_true = holdout_eval["is_fraud"].astype(int)
    y_pred = holdout_eval["predicted_fraud"]

    overall_precision = precision_score(y_true, y_pred, zero_division=0)
    overall_recall = recall_score(y_true, y_pred, zero_division=0)
    overall_f1 = f1_score(y_true, y_pred, zero_division=0)

    print("=== AUTOENCODER (benchmark-only) — OVERALL HOLDOUT METRICS ===")
    print(f"Holdout size: {len(holdout_eval)}  |  Fraud rate in holdout: {y_true.mean()*100:.1f}%")
    print(f"Precision: {overall_precision:.3f}  Recall: {overall_recall:.3f}  F1: {overall_f1:.3f}")

    print("\n=== PER-FRAUD-TYPE BREAKDOWN (autoencoder) ===")
    fraud_types = sorted(labels_df["fraud_type"].dropna().unique())
    rows = []
    for ft in fraud_types:
        y_true_type = (holdout_eval["fraud_type"] == ft).astype(int)
        n_type_in_holdout = int(y_true_type.sum())
        precision_t = precision_score(y_true_type, y_pred, zero_division=0)
        recall_t = recall_score(y_true_type, y_pred, zero_division=0)
        f1_t = f1_score(y_true_type, y_pred, zero_division=0)
        rows.append({
            "fraud_type": ft,
            "n_in_holdout": n_type_in_holdout,
            "precision": round(precision_t, 3),
            "recall": round(recall_t, 3),
            "f1": round(f1_t, 3),
        })
    per_type_df = pd.DataFrame(rows)
    print(per_type_df.to_string(index=False))

    precisions, recalls, _ = precision_recall_curve(y_true, holdout_eval["anomaly_score"])
    plt.figure(figsize=(6, 5))
    plt.plot(recalls, precisions, marker=".", markersize=3, color="darkorange")
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("Precision-Recall Curve — Autoencoder (benchmark) holdout")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    output_dir = Path(__file__).resolve().parent / "results"
    output_dir.mkdir(exist_ok=True)
    plt.savefig(output_dir / "autoencoder_precision_recall_curve.png", dpi=150)

    per_type_df.to_csv(output_dir / "autoencoder_per_fraud_type_metrics.csv", index=False)

    print(f"\nSaved: {output_dir / 'autoencoder_precision_recall_curve.png'}")
    print(f"Saved: {output_dir / 'autoencoder_per_fraud_type_metrics.csv'}")

    print("""
=== FOR THE REPORT'S COMPARISON TABLE ===
This autoencoder is a benchmark ONLY, per the doc — never wire it into the
real pipeline. Compare its overall precision/recall/F1 and per-fraud-type
breakdown directly against train_model.py's Isolation Forest output (same
split, same contamination rate, same holdout set) to justify "we benchmarked
X, chose Isolation Forest because Y" in the report.
""")


if __name__ == "__main__":
    main()
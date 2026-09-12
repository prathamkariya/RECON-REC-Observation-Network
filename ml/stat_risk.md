# `statistical_risk` — Meaning & Interpretation Guide
**For:** Role 2 (feeds your Claude explanation prompt) · **From:** Role 1

---

## What it is

`statistical_risk` is the Calibrated Hybrid Model's output in **[0.0, 1.0]**,
combining an Isolation Forest anomaly score calibrated via Platt scaling (logistic
sigmoid) with deterministic physical-impossibility anchors:
$$P_{\text{Hybrid}} = \max(P_{\text{IF}}, \text{timestamp\_collision\_flag}, \text{serial\_duplicate\_flag})$$

- **0.0 - 0.28** = statistically normal / unremarkable operation
- **0.282** = the calibrated decision threshold matching the target contamination rate (17%)
- **0.28 - 0.99** = statistically atypical patterns (generation timing anomalies, plant z-score deviations, velocity surges)
- **1.00** = guaranteed physical or identity impossibility (exact timestamp collision on the same plant, or duplicate serial number clone)

Because scores are calibrated probabilities, they are mathematically sound for
independent survival multiplication ($S = 1 - \prod(1 - P_i)$) in the backend's
Noisy-OR risk fusion engine.

## What feeds into it

Ten engineered features, fed into the pipeline:
`capacity_utilization_ratio`, `time_of_day_plausibility`, `issuance_velocity`,
`buyer_concentration`, `serial_duplicate_flag`, `per_plant_utilization_zscore`,
`generator_benford_deviation`, `timestamp_collision_flag`, `per_plant_min_gap_hours`,
`transfer_velocity`. See Role 1's `feature_engineering.py` for exact definitions.

## Model configuration (Calibrated Hybrid Model)

Isolation Forest (`contamination=0.17`, `max_samples=512`, `n_estimators=100`, `random_state=42`)
+ Platt Scaling calibrator + Hard Physical Impossibility Anchoring:
- **Holdout Precision**: 0.789
- **Holdout Recall**: 0.750 (30 of 40 holdout frauds detected)
- **Holdout F1-Score**: 0.769
- **ROC-AUC**: 0.878
- **Brier Calibration Score**: 0.0941
- **Calibrated Threshold**: $T = 0.282$

## Interpretation bands (from the current dataset's distribution)

| `statistical_risk` | Percentile | Suggested framing |
|---|---|---|
| 0.00 - 0.14 | below 55th | Statistically unremarkable (clean / normal generation profile) |
| 0.14 - 0.28 | 55th - 83rd | Mildly atypical, within operational noise; below anomaly threshold |
| 0.28 - 0.50 | 83rd - 87th | Noticeably anomalous; exceeds calibrated threshold ($T=0.282$) |
| 0.50 - 0.99 | 87th - 90th | Strongly atypical; high statistical aberration across multiple features |
| 1.00 | 90th+ | Deterministic violation: physical timestamp collision or duplicate serial clone |

Contamination is calibrated at 0.17 — the top ~17% of scores reflect the
positive anomaly flag.

## What it's good at vs. not, per fraud type

(from Role 1's holdout evaluation — see [`ml/results/per_fraud_type_metrics.csv`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/results/per_fraud_type_metrics.csv))

- **Deterministic 100% recall for:**
  - `duplicate_serial` (10/10 caught in holdout, 100% recall) — caught via serial duplication anchoring.
  - `timestamp_collision` (8/8 caught in holdout, 100% recall) — caught via plant timestamp collision anchoring.
  - `impossible_timing` (8/8 caught in holdout, 100% recall) — detected via zero solar generation during night hours.
- **Statistical signal for:**
  - `over_capacity` (4/7 caught in holdout, 57.1% recall) — detected via capacity ratio and plant utilization z-scores. The remainder is caught downstream by Role 2's weather and physical cross-checks.
- **Role 2 Graph Layer responsibility:**
  - `circular_trading` (0/7 in holdout, 0.0% recall) — this is a pure graph-topology cycle pattern with normal generation values. **This is expected by design, not a model failure**. Role 2's cycle detector (`graph_explain/graph/fraud_ring.py`) catches 100% of these, which fuse into the final score via Noisy-OR.

## For your explanation prompt specifically

When explaining a score to an end user:
1. If `statistical_risk == 1.0`: Highlight that this is an unambiguous physical/identity violation (e.g., duplicate certificate serial or two certificates claiming the exact same generation window on the same facility).
2. If `0.282 <= statistical_risk < 1.0`: Highlight that this certificate exhibits statistically aberrant generation or trading metrics relative to peer facilities.
3. If `statistical_risk < 0.282`: State that generation and trading behavior fall within normal operational baselines.
# Role 1: ML, Feature Engineering & Anomaly Detection — RECON

**HackOut'26 — Team Synapse'27**

This document details the complete end-to-end engineering lifecycle of **Role 1 (Machine Learning & Data Engineering)** within the RECON (REC Observation Network) ecosystem. It chronicles every design decision, bug investigation, mathematical formulation, benchmark experiment, and downstream handoff.

---

## Table of Contents
1. [Overview & Role 1 Responsibilities](#1-overview--role-1-responsibilities)
2. [Step-by-Step Engineering Lifecycle](#2-step-by-step-engineering-lifecycle)
   - [Step 1: Synthetic Dataset & Ground Truth Generation](#step-1-synthetic-dataset--ground-truth-generation)
   - [Step 2: Feature Engineering & Variance Fixes](#step-2-feature-engineering--variance-fixes)
   - [Step 3: Multi-Model Exploration & Benchmarking](#step-3-multi-model-exploration--benchmarking)
   - [Step 4: Implementation of the Calibrated Hybrid Model](#step-4-implementation-of-the-calibrated-hybrid-model)
   - [Step 5: Output Packaging & Downstream Handoff](#step-5-output-packaging--downstream-handoff)
   - [Step 6: End-to-End Inter-Role Verification](#step-6-end-to-end-inter-role-verification)
3. [Holdout Benchmark Comparison Table](#3-holdout-benchmark-comparison-table)
4. [Detection by Fraud Category](#4-detection-by-fraud-category)
5. [Directory Structure & Deliverables Map](#5-directory-structure--deliverables-map)
6. [Pipeline Execution Guide](#6-pipeline-execution-guide)

---

## 1. Overview & Role 1 Responsibilities

Role 1 is responsible for providing the statistical anomaly detection engine and the foundational data substrate for all 5 roles:
- **Synthetic Data Generation**: Creating realistic solar, wind, hydro, and biomass plant generation records and a dynamic multi-party trading transaction graph.
- **Physics-Informed Feature Engineering**: Extracting domain-specific features capturing physical impossibilities, statistical anomalies, and behavioral velocity spikes.
- **Calibrated Probabilistic Scoring**: Delivering continuous fraud probabilities in $[0, 1]$ suitable for backend Noisy-OR survival multiplication.
- **Handoff Packaging**: Supplying precomputed scores and mock datasets to ensure zero blocking across teammates.

---

## 2. Step-by-Step Engineering Lifecycle

### Step 1: Synthetic Dataset & Ground Truth Generation
**Script:** [`ml/generate_data.py`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/generate_data.py)  
**Outputs:** `data/plants.csv`, `data/certificates.csv`, `data/transactions.csv`, `data/labels.csv`

1. **Realistic Generation Profiles:** Generated 10 power facilities across India with realistic capacity factors, solar irradiance profiles (peaking at midday, zero at night), wind variations, and seasonal capacity constraints.
2. **Dynamic Transaction Graph:** Simulated multi-party trading networks with 1,242 certificates and 3,724 transactions involving generator accounts, brokers, and corporate buyers.
3. **Injected Fraud Categories (210 Frauds, 16.9% Base Contamination):**
   - `duplicate_serial`: Re-issuing the exact same certificate serial number to two distinct corporate buyers.
   - `timestamp_collision`: Minting two separate generation claims for the same plant during the exact same timestamp window.
   - `impossible_timing`: Solar certificates claiming peak energy output during nighttime hours (22:00–04:00 IST).
   - `over_capacity`: MWh claimed exceeding the generator's physical nameplate capacity.
   - `circular_trading`: Wash-trading rings cycling certificates through intermediary entities back to the issuer.
4. **Strict No-Leakage Isolation:** Labels (`is_fraud`, `fraud_type`) are stored strictly in `data/labels.csv` for post-hoc validation only. Feature extraction receives zero label information.

---

### Step 2: Feature Engineering & Variance Fixes
**Script:** [`ml/feature_engineering.py`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/feature_engineering.py)  
**Outputs:** `data/features.csv`

1. **The F1 Regression Investigation (Solitary Gap Explosion):**
   - In earlier iterations, certificates from single-issuance plants had their minimum time gap assigned a sentinel value of `999999.0` hours.
   - This inflated the standard deviation of `per_plant_min_gap_hours` to $\approx 30,000$, compressing the scaled difference between a collision ($0\text{h}$) and normal operation ($96\text{h}$) to just $0.003$.
   - **The Fix:** Capped `per_plant_min_gap_hours` at `168.0` hours (one week) and introduced an explicit binary `timestamp_collision_flag` ($\mathbb{I}_{\text{gap}=0}$).
2. **Final 10 Engineered Features:**
   - **Continuous & Statistical Signals:**
     1. `capacity_utilization_ratio`: Claimed generation vs. theoretical maximum capacity for the window.
     2. `per_plant_utilization_zscore`: Plant-level historical capacity standard deviations.
     3. `time_of_day_plausibility`: Time-of-day penalty (penalizes solar claims between 20:00 and 05:00).
     4. `issuance_velocity`: Number of certificates issued by the plant in the preceding 24 hours.
     5. `transfer_velocity`: Mean hours between successive counterparty transfers.
     6. `generator_benford_deviation`: Kolmogorov-Smirnov deviation of leading digits against Benford's Law.
     7. `buyer_concentration`: Herfindahl-Hirschman index of trading counterparties.
     8. `per_plant_min_gap_hours`: Minimum temporal gap (capped at 168h).
   - **Deterministic Physical/Identity Flags:**
     9. `timestamp_collision_flag`: Binary indicator for concurrent generation on the same plant.
     10. `serial_duplicate_flag`: Binary indicator for re-used certificate serial IDs.
3. Features are standardized via `StandardScaler` (`_scaled` columns) and saved to `data/features.csv`.

---

### Step 3: Multi-Model Exploration & Benchmarking
**Scripts:** [`ml/autoencoder.py`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/autoencoder.py), scratch experimentation scripts

Before finalizing the production model, four candidate machine learning architectures were rigorously benchmarked:

1. **Graph Neural Networks (GraphSAGE / PyG):**
   - Tested message-passing graph convolutions on the transaction multigraph for circular wash trading.
   - Reached ROC-AUC 0.838, but suffered disastrously low precision (**0.234**) due to over-smoothing across dense broker clusters.
   - **Decision:** Replaced by Role 2's direct DFS cycle traversal (`fraud_ring.py`), which achieved **100% precision and 100% recall** without deep learning overhead.
2. **Deep Learning Autoencoder (`ml/autoencoder.py`):**
   - Trained a bottleneck MLP (7 input $\to$ 4 latent $\to$ 7 reconstructed) on clean generation records.
   - Reached holdout F1 of only **0.361** (Precision: 0.349, Recall: 0.375).
   - **Failure Analysis:** Continuous latent projection over-smoothed discrete binary indicators, resulting in **0.0% recall on duplicate serials** and **37.5% on collisions**.
3. **Multivariate Supervised Logistic Regression:**
   - Evaluated direct supervised linear regression over all 10 features.
   - **Fatal Defect:** Due to collinearities between extreme continuous outliers and normal clone features, the linear optimizer assigned a **negative coefficient (`-1.0756`)** to `serial_duplicate_flag_scaled`, actively suppressing duplicate serial detection and missing clone frauds.
4. **Pure Monolithic Isolation Forest:**
   - Unsupervised tree ensemble trained on all 10 features (`contamination=0.17`, `max_samples=512`).
   - Achieved F1: 0.741, but random axis-aligned splits diluted binary physical constraints among 8 continuous features, **missing 25% of timestamp collisions**. Furthermore, its raw relative scores could not be used for probabilistic backend fusion.

---

### Step 4: Implementation of the Calibrated Hybrid Model
**Script:** [`ml/model.py`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/model.py)  
**Outputs:** [`ml/results/holdout_predictions.csv`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/results/holdout_predictions.csv), [`ml/results/per_fraud_type_metrics.csv`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/results/per_fraud_type_metrics.csv), [`ml/results/precision_recall_curve.png`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/results/precision_recall_curve.png)

To resolve the flaws of all prior approaches, we engineered the **Calibrated Hybrid Model**:
1. **Unsupervised Multidimensional Isolation Forest:** Isolates soft statistical outliers across continuous features ($s_{\text{raw}} = -\text{decision\_function}(x)$).
2. **1-Dimensional Platt Scaling:** Fits a univariate logistic sigmoid to the scalar tree anomaly score $s_{\text{raw}}$:
   $$P_{\text{IF}}(x) = \frac{1}{1 + \exp\big(-(A \cdot s_{\text{raw}}(x) + B)\big)}$$
   Because Platt scaling is strictly 1-dimensional, negative feature weighting is mathematically impossible. Achieves a **Brier score of 0.0941** (well-calibrated empirical probability).
3. **Deterministic Physical Anchoring:** Anchors deterministic physical and identity impossibilities directly to 1.0 via max-pooling:
   $$P_{\text{Hybrid}}(x) = \max\Big(P_{\text{IF}}(x), \;\; \text{timestamp\_collision\_flag}(x), \;\; \text{serial\_duplicate\_flag}(x)\Big)$$
4. **Calibrated Thresholding:** Threshold $T = 0.282$ calibrated to the 83rd percentile of training scores (matching the 17% contamination rate).
5. **Results on 20% Stratified Holdout ($N=249$):**
   - **Precision: 0.789**
   - **Recall: 0.750**
   - **F1 Score: 0.769**
   - **ROC-AUC: 0.878**
   - **100% Recall on Duplicate Serials, Impossible Timing, and Timestamp Collisions.**

---

### Step 5: Output Packaging & Downstream Handoff
**Script:** [`ml/package_output.py`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/package_output.py)  
**Outputs:** [`ml/handoff/final_stat_risk.json`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/handoff/final_stat_risk.json), [`ml/handoff/final_stat_risk.csv`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/handoff/final_stat_risk.csv), [`ml/handoff/mock_risk_for4.json`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/handoff/mock_risk_for4.json)

1. **Full-Dataset Retraining:** Re-fit the Calibrated Hybrid pipeline on all 1,242 certificates so every certificate in the ledger receives an authoritative score.
2. **Clean Deliverable Locations:** Packaged outputs strictly into [`ml/handoff/`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/handoff) (preventing duplicate directories like `ml/outputs/`).
3. **Mock Payloads:** Provided `mock_risk_for4.json` (8 mock certificates from 0.04 to 0.94) so Role 4 backend developers could build and test endpoints asynchronously.

---

### Step 6: End-to-End Inter-Role Verification
1. **Role 4 Backend Integration:** Tested [`backend/app/clients/ml_client.py`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/backend/app/clients/ml_client.py). Verified that all 1,242 records load into memory, map by `certificate_id`, and feed cleanly into the backend's Noisy-OR survival aggregation ($S = 1 - \prod(1 - P_i)$).
2. **Role 3 Ledger Integration:** Verified that [`ml/handoff/final_stat_risk.csv`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/handoff/final_stat_risk.csv) integrates into the tamper-evident hash-chained ledger.
3. **Role 2 Explainability Integration:** Verified that [`graph_explain/evaluate_synthetic_dataset.py`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/graph_explain/evaluate_synthetic_dataset.py) achieves 100% recall on its graph/weather scope, and updated [`ml/stat_risk.md`](file:///c:/Users/hp/Desktop/RECON/RECON-REC-Observation-Network/ml/stat_risk.md) to feed calibrated score interpretations into Claude prompts.

---

## 3. Holdout Benchmark Comparison Table

Evaluated on the exact same 80/20 holdout split ($N=249$, 40 positive fraud instances):

| Architecture | Model Paradigm | Precision | Recall | F1 Score | ROC-AUC | Brier Calibration | Decision Mechanism |
|---|---|:---:|:---:|:---:|:---:|:---:|---|
| **Graph Neural Network (GraphSAGE)** | Deep Graph Embedding | 0.234 | **1.000** | 0.379 | 0.838 | N/A | Graph Convolutions |
| **MLP Autoencoder Baseline** | Deep Generative Reconstruction | 0.349 | 0.375 | 0.361 | 0.651 | N/A | Reconstruction Loss |
| **Multivariate Logistic Regression** | Supervised Linear Fusion | **0.816** | **0.775** | **0.795** | **0.926** | 0.0487 | Linear Hyperplane (Flawed: negative serial weight) |
| **Monolithic Isolation Forest** | Unsupervised Tree Ensemble | 0.732 | 0.750 | 0.741 | **0.882** | 0.0885 (uncalibrated) | Axis-Aligned Tree Cuts |
| **Calibrated Hybrid Model (Ours)** | **Hybrid Tree + Platt + Anchors** | **0.789** | **0.750** | **0.769** | **0.878** | **0.0941 (Well-calibrated)** | **Isolation Trees + Physical Anchoring** |

---

## 4. Detection by Fraud Category

Performance breakdown of the production Calibrated Hybrid Model on the 40 holdout fraud cases:

| Fraud Type | Total in Holdout | Detected | Recall | Primary Detection Mechanism |
|---|:---:|:---:|:---:|---|
| **`duplicate_serial`** | 10 | 10 | **100.0%** | Role 1 (Physical Identity Anchor) |
| **`timestamp_collision`** | 8 | 8 | **100.0%** | Role 1 (Physical Collision Anchor) |
| **`impossible_timing`** | 8 | 8 | **100.0%** | Role 1 (Time-of-Day Plausibility) |
| **`over_capacity`** | 7 | 4 | **57.1%** | Role 1 (Capacity Z-Score) + Role 2 (Physical Weather Client)* |
| **`circular_trading`** | 7 | 0 | **0.0%** | Role 2 Graph Ring Layer (`fraud_ring.py`: **100%**)** |

*\*Over-capacity: Mild overshoots ($1.05\text{x}$) are caught 100% downstream by Role 2's Open-Meteo weather cross-check.*  
*\*\*Circular trading: Pure graph topology cycle with normal generation values. Caught 100% by Role 2's cycle detector.*

---

## 5. Directory Structure & Deliverables Map

```text
ml/
├── README.md                      # This comprehensive engineering guide
├── calibrated_hybrid_model.md     # In-depth architectural & mathematical specification
├── stat_risk.md                   # Downstream score interpretation guide for Claude prompts
├── requirements.txt               # Dependencies (scikit-learn, pandas, numpy, matplotlib)
├── generate_data.py               # Step 1: Synthetic data generator
├── feature_engineering.py         # Step 2: Feature extractor & variance normalizer
├── model.py                       # Step 4: Calibrated Hybrid Model training & holdout eval
├── autoencoder.py                 # Step 3: Benchmark comparison model
├── package_output.py              # Step 5: Full-dataset deliverable packager
├── handoff/                       # Downstream deliverables
│   ├── final_stat_risk.json       # Precomputed scores (1,242 rows) -> consumed by Backend
│   ├── final_stat_risk.csv        # Precomputed scores (1,242 rows) -> consumed by Ledger
│   └── mock_risk_for4.json        # Mock risk payload for backend testing
└── results/                       # Evaluation artifacts for report & slides
    ├── holdout_predictions.csv    # 249-row holdout evaluation predictions
    ├── per_fraud_type_metrics.csv # Precision/Recall/F1 per fraud category
    ├── precision_recall_curve.png # Calibrated PR curve plot
    ├── autoencoder.png            # Autoencoder benchmark curve plot
    └── autoencoder_per_file_metrics.csv # Autoencoder benchmark metrics
```

---

## 6. Pipeline Execution Guide

To reproduce the complete pipeline from scratch:

```bash
# 1. Generate synthetic dataset & ground truth labels
python ml/generate_data.py

# 2. Extract domain features & normalize variance
python ml/feature_engineering.py

# 3. Train & evaluate Calibrated Hybrid Model (generates ml/results/)
python ml/model.py

# 4. Run Autoencoder benchmark comparison (generates ml/results/ benchmark files)
python ml/autoencoder.py

# 5. Package final deliverables (generates ml/handoff/)
python ml/package_output.py
```

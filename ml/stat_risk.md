# `statistical_risk` — Meaning & Interpretation Guide
**For:** Role 2 (feeds your Claude explanation prompt) · **From:** Role 1

---

## What it is

`statistical_risk` is the Isolation Forest's anomaly score, min-max normalized
to **[0.0, 1.0]**. It answers one question: *"how statistically unusual is
this certificate's feature profile, compared to the rest of the dataset?"*

- **0.0** = the least anomalous certificate in the dataset (fits typical
  patterns most closely)
- **1.0** = the most anomalous certificate in the dataset
- It is **relative to this dataset**, not an absolute fraud probability. A
  score of 0.9 does not mean "90% chance of fraud" — it means "more
  statistically unusual than ~90% of certificates in this batch."

## What feeds into it

Seven engineered features, fed into the Isolation Forest:
`capacity_utilization_ratio`, `time_of_day_plausibility`, `issuance_velocity`,
`buyer_concentration`, `serial_duplicate_flag`, `per_plant_utilization_zscore`,
`generator_benford_deviation`. See Role 1's feature_engineering.py for exact
definitions.

## Model configuration (tuned)

Isolation Forest with `contamination=0.15`, `max_samples=512`,
`n_estimators=100`. Tuned via a swept comparison against the doc's original
starting point (`contamination=0.17`, `max_samples='auto'`) — this
combination improved holdout F1 from 0.658 to 0.701 with no per-fraud-type
regression. See `contamination_sweep.py` and
`sweep_max_samples_n_estimators.py` for the full sweep results.

## Rough interpretation bands (from the current dataset's distribution)

| `statistical_risk` | Percentile | Suggested framing |
|---|---|---|
| 0.00 - 0.14 | below 50th | Statistically unremarkable |
| 0.14 - 0.26 | 50th - 70th | Mildly atypical, not independently concerning |
| 0.26 - 0.45 | 70th - 83rd | Noticeably atypical, worth a secondary look if other signals agree |
| 0.45 - 0.56 | 83rd - 90th | Strongly atypical, resembles the profile of injected fraud patterns |
| 0.56 - 1.00 | 90th+ | Highly atypical, closely resembles known fraud patterns in this dataset |

These bands are **descriptive of the current dataset**, not fixed thresholds —
they will shift if the dataset changes (new certificates, different fraud
mix). Contamination was set at 0.15 (tuned, see above) — roughly the top 15%
of scores are what the model itself would flag as anomalous under its own
decision boundary.

## What it's good at vs. not, per fraud type

(from Role 1's holdout evaluation — see `per_fraud_type_metrics.csv`)

- **Strong signal for:** `impossible_timing`, `over_capacity`,
  `duplicate_serial` — these are directly feature-driven (timing
  plausibility, capacity ratio, serial duplication flag all feed the model
  explicitly).
- **Weak signal for:** `circular_trading`, `timestamp_collision` — these are
  graph-topology and cross-certificate patterns that don't show up cleanly
  in per-certificate feature space. **This is expected, not a model failure**
  — it's why `statistical_risk` is one of three independent signals (yours,
  Role 2's graph check, Role 2's weather check), not the whole answer.
  If a certificate has low `statistical_risk` but high graph/weather risk,
  that's the multi-signal design working as intended, not a contradiction
  to resolve.

## For your explanation prompt specifically

When explaining a score to an end user, frame it as *"this certificate's
generation and trading pattern is more/less typical than most in the
dataset,"* not as *"this certificate is X% likely to be fraudulent."* The
model detects statistical outliers; whether an outlier is actually fraud is
a judgment call that combines this signal with the graph and weather checks.
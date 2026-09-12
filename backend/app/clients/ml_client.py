"""
Adapter for Role 1 (ML): predict(record) -> {"risk_score": float, "reasons": [str]}.

Mock: a deterministic capacity-ratio heuristic (claimed MWh vs. the plant's
theoretical max output for the reporting window) — no model file required.

Real: ml/model.py has no live "score one new record" entry point — it's a
train/evaluate/plot script, not an importable predictor. The actual handoff
Role 1 documented (ml/package_output.py's own docstring: "give them a mock
version... exact shape to agree with Roles 3 & 4: {certificate_id,
statistical_risk}") is ml/handoff/final_stat_risk.json, a precomputed
statistical_risk per certificate_id from their tuned Isolation Forest. This
reads that lookup rather than importing a function that doesn't exist.

Since certificate_id is intentionally non-unique in Role 1's dataset
(duplicate_serial clones share an id — see docs/schema_data.md decision #4),
and the handoff file preserves file-order duplicates too, lookups for a
repeated certificate_id are consumed in order (first call gets the first
score, second call the second) rather than always returning the same value
for both occurrences.

A certificate_id with no entry in the handoff file (anything outside Role
1's original 1242-row training set, i.e. any genuinely new submission)
falls back to the mock heuristic rather than failing.
"""
import json
from pathlib import Path
from typing import Dict, List, Optional

from ..config import settings

_HANDOFF_PATH = Path(__file__).resolve().parents[3] / "ml" / "handoff" / "final_stat_risk.json"

_lookup: Optional[Dict[str, List[float]]] = None
_cursor: Dict[str, int] = {}


def _load_lookup() -> Dict[str, List[float]]:
    global _lookup
    if _lookup is None:
        with open(_HANDOFF_PATH) as f:
            rows = json.load(f)
        lookup: Dict[str, List[float]] = {}
        for row in rows:
            lookup.setdefault(row["certificate_id"], []).append(float(row["statistical_risk"]))
        _lookup = lookup
    return _lookup


def _mock_predict(record: dict) -> dict:
    plant = record["plant"]
    generation = record["generation"]
    duration_hours = max((generation["end"] - generation["start"]).total_seconds() / 3600, 1e-6)
    theoretical_max = plant["capacity_mw"] * duration_hours
    ratio = generation["mwh_claimed"] / theoretical_max if theoretical_max > 0 else float("inf")

    reasons = []
    if ratio > 1.0:
        score = min(0.5 + 0.5 * min(ratio - 1.0, 1.0), 0.99)
        reasons.append(
            f"Claimed generation ({generation['mwh_claimed']} MWh) exceeds the plant's "
            f"theoretical max output ({theoretical_max:.2f} MWh) for the reporting window"
        )
    elif ratio > 0.85:
        score = 0.25
        reasons.append("Claimed generation is close to the plant's capacity limit")
    else:
        score = round(0.05 + 0.1 * ratio, 3)

    return {"risk_score": round(min(max(score, 0.0), 1.0), 3), "reasons": reasons}


def _real_predict(record: dict) -> dict:
    try:
        lookup = _load_lookup()
        cert_id = record["certificate_id"]
        scores = lookup.get(cert_id)
        if not scores:
            return _mock_predict(record)

        idx = min(_cursor.get(cert_id, 0), len(scores) - 1)
        _cursor[cert_id] = idx + 1
        risk_score = scores[idx]

        # Interpretation bands from ml/stat_risk.md's own documented scale.
        reasons = []
        if risk_score >= 0.56:
            reasons.append(
                f"Statistically highly atypical (statistical_risk={risk_score}) — closely "
                f"resembles known fraud patterns in Role 1's training dataset"
            )
        elif risk_score >= 0.45:
            reasons.append(
                f"Statistically strongly atypical (statistical_risk={risk_score}) — resembles "
                f"the profile of injected fraud patterns"
            )

        return {"risk_score": round(risk_score, 3), "reasons": reasons}
    except Exception:
        return _mock_predict(record)


def predict(record: dict) -> dict:
    if settings.USE_REAL_ML:
        return _real_predict(record)
    return _mock_predict(record)

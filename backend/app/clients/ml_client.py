"""
Adapter for Role 1 (ML): predict(record) -> {"risk_score": float, "reasons": [str]}.

Mock: a deterministic capacity-ratio heuristic (claimed MWh vs. the plant's
theoretical max output for the reporting window) — no model file required.
Real: imports ml.model, behind USE_REAL_ML.
"""
from ..config import settings


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
        from ml.model import predict_anomalies  # teammate's module (Role 1)

        result = predict_anomalies(model=None, data=[record])
        if not result:
            raise ValueError("ml.model.predict_anomalies returned no result")
        item = result[0] if isinstance(result, list) else result
        return {
            "risk_score": float(item.get("isolation_forest_score", 0.0)),
            "reasons": item.get("reasons", []),
        }
    except Exception:
        return _mock_predict(record)


def predict(record: dict) -> dict:
    if settings.USE_REAL_ML:
        return _real_predict(record)
    return _mock_predict(record)

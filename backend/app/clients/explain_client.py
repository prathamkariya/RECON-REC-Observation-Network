"""
Adapter for Role 2's plain-English explanation: explain(record, signals) -> str.

Mock: a template built from the merged risk reasons — no API key required.

Real: calls graph_explain.llm.explainer.generate_explanation, behind
USE_REAL_EXPLAIN, wrapped in a hard timeout. A slow/broken API degrades to
the mock template instead of hanging or crashing the request.

generate_explanation expects Role 1's flat raw-certificate shape (same as
weather_client's compute_weather_mismatch -- see that adapter's docstring)
and a signals dict with graph_flag/graph_risk/directly_in_cycle/
weather_mismatch/weather_mismatch_score/isolation_forest_flag/
isolation_forest_score, not just {risk_score, risk_reasons}. Confirmed:
generate_explanation's own early-exit ("not is_flagged and not
force_generate -> return None") would otherwise ALWAYS fire, since none of
those keys existed in what this adapter passed -- meaning USE_REAL_EXPLAIN
silently never called Claude for any certificate, always falling through to
the mock via the "result is None -> raise -> fallback" path below, with no
error surfaced anywhere. service.py now passes the full signals shape,
and this adapter passes force_generate=True so a clean certificate still
gets a real (Claude or its own local deterministic fallback) explanation
rather than an artificial None.
"""
import concurrent.futures

from ..config import settings


def _flatten_for_explain(record: dict) -> dict:
    plant = record["plant"]
    generation = record["generation"]
    return {
        "certificate_id": record["certificate_id"],
        "plant_lat": plant["lat"],
        "plant_lon": plant["lon"],
        "energy_source": plant["type"],
        "claimed_mwh": generation["mwh_claimed"],
        "plant_rated_capacity_mwh": plant["capacity_mw"],
        "generation_timestamp": generation["start"],
    }


def _mock_explain(record: dict, signals: dict) -> str:
    reasons = signals.get("risk_reasons", [])
    risk_score = signals.get("risk_score", 0.0)

    if not reasons or risk_score < 0.2:
        return (
            f"Certificate {record['certificate_id']} shows no significant fraud indicators; "
            f"the generation claim and trading pattern are consistent with the plant's profile."
        )

    lead = reasons[0]
    rest = reasons[1:]
    explanation = f"Certificate {record['certificate_id']} is flagged primarily because: {lead}."
    if rest:
        explanation += " Additional signals: " + "; ".join(rest) + "."
    return explanation


def _real_explain_blocking(record: dict, signals: dict) -> str:
    from graph_explain.llm.explainer import generate_explanation  # teammate's module (Role 2)

    result = generate_explanation(_flatten_for_explain(record), signals, force_generate=True)
    if not result:
        raise ValueError("generate_explanation returned no result")
    return result


def explain(record: dict, signals: dict) -> str:
    if not settings.USE_REAL_EXPLAIN or not settings.ANTHROPIC_API_KEY:
        return _mock_explain(record, signals)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_real_explain_blocking, record, signals)
        try:
            return future.result(timeout=settings.EXPLAIN_TIMEOUT_SECONDS)
        except Exception:
            return _mock_explain(record, signals)

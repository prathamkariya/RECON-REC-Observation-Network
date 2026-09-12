"""
Adapter for Role 2's plain-English explanation: explain(record, signals) -> str.

Mock: a template built from the merged risk reasons — no API key required.
Real: calls Claude via graph_explain.llm.explainer, behind USE_REAL_EXPLAIN,
wrapped in a hard timeout. A slow/broken API degrades to the mock template
instead of hanging or crashing the request.
"""
import concurrent.futures

from ..config import settings


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

    result = generate_explanation(record, signals)
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

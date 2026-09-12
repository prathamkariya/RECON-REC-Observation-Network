"""
Auditor Interactive Chat Interface for REC Fraud Detection System (Role 2).
Allows human auditors to interrogate flagged certificates, inspect trading ring evidence,
and drill down into weather/solar physical parameters.
"""

import os
import sys
from typing import Dict, Any

# Ensure both graph_explain/ and repo root are in sys.path
_LLM_DIR = os.path.abspath(os.path.dirname(__file__))
_GRAPH_EXPLAIN_DIR = os.path.abspath(os.path.join(_LLM_DIR, ".."))
_REPO_ROOT = os.path.abspath(os.path.join(_GRAPH_EXPLAIN_DIR, ".."))
for _p in [_REPO_ROOT, _GRAPH_EXPLAIN_DIR]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

def query_audit_assistant(
    certificate_id: str,
    user_query: str,
    certificate: Dict[str, Any],
    signals: Dict[str, Any]
) -> str:
    """
    Handles auditor natural language questions about a certificate.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")

    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            system_prompt = f"""
You are the RECON AI Audit Assistant. An auditor is asking questions about REC certificate '{certificate_id}'.
Base all your answers strictly on the verified evidence below:
Certificate Details: {certificate}
Signals & Detection Data: {signals}

Be concise, factual, and direct. Explain graph trading rings, solar/weather discrepancies, or entity roles accurately.
"""
            resp = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=300,
                temperature=0.2,
                system=system_prompt,
                messages=[{"role": "user", "content": user_query}]
            )
            return resp.content[0].text.strip()
        except Exception:
            pass

    # Deterministic offline response fallback
    query_lower = user_query.lower()
    parties = signals.get("touching_parties", [])
    weather_score = signals.get("weather_mismatch_score", 0.0)
    graph_risk = signals.get("graph_risk", 0.0)

    if "why" in query_lower or "reason" in query_lower or "flag" in query_lower:
        reasons = []
        if signals.get("weather_mismatch"):
            reasons.append(f"Physical Generation Mismatch: {signals.get('weather_reason')}")
        if signals.get("graph_flag"):
            reasons.append(f"Graph Ring / Wash Trading: High graph risk ({graph_risk}) involving entities {', '.join(parties)}")
        if not reasons:
            return f"Certificate {certificate_id} was evaluated as clean with no anomalies detected across graph, physical, or volume checks."
        return f"Certificate {certificate_id} was flagged due to:\n" + "\n".join(f"- {r}" for r in reasons)

    if "who" in query_lower or "part" in query_lower or "entit" in query_lower:
        return f"The parties associated with certificate {certificate_id} are: {', '.join(parties) if parties else 'No transfer records found'}."

    if "weather" in query_lower or "solar" in query_lower or "night" in query_lower or "wind" in query_lower:
        return f"Physical check details for {certificate_id}: Mismatch Score = {weather_score}. Details: {signals.get('weather_reason', 'Normal meteorological conditions.')}"

    if "risk" in query_lower or "score" in query_lower:
        return f"Risk scores for {certificate_id}: Graph Risk = {graph_risk}, Weather Mismatch Score = {weather_score}."

    return (
        f"Auditor Summary for {certificate_id}: "
        f"Graph Flag = {signals.get('graph_flag')}, Weather Mismatch = {signals.get('weather_mismatch')}. "
        f"Involved entities: {', '.join(parties)}."
    )

if __name__ == "__main__":
    import json
    fixture_path = os.path.join(os.path.dirname(__file__), "..", "fixtures", "mock_records.json")
    with open(fixture_path, "r") as f:
        fixtures = json.load(f)

    sample_cert = fixtures["certificates"][2] # REC-RING-001
    sample_signals = {
        "graph_flag": True,
        "graph_risk": 1.0,
        "weather_mismatch": False,
        "weather_mismatch_score": 0.0,
        "touching_parties": ["P_RING_01", "P_RING_02", "P_RING_03"],
        "weather_reason": "Normal conditions."
    }

    q = "Why was this certificate flagged and which parties are involved?"
    print(f"Auditor Query: {q}")
    print("Response:\n" + query_audit_assistant("REC-RING-001", q, sample_cert, sample_signals))

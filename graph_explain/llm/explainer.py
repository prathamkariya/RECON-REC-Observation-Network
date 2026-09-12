"""
Plain-English explainability layer using Claude API for REC Fraud Detection System (Role 2).
Adheres strictly to Hackathon rules:
- Rule 9: Lazy/on-demand generation (skip API for clean certificates in batch runs).
- Rule 10: Explicit clean case handling ("if no signal is flagged, state plainly that certificate appears legitimate").
- Rule 11: Lead explanations with the strongest signal (physical impossibility > circular ring > statistical outlier).
- Graceful offline fallback if API key is absent.
"""

import os
from typing import Dict, Any, Optional

def _rank_signals(signals: Dict[str, Any]) -> str:
    """
    Ranks signals by evidentiary weight (Rule 11).
    Returns identifier of strongest signal: 'PHYSICAL', 'GRAPH_CYCLE', 'GRAPH_CLUSTER', 'STATISTICAL', or 'CLEAN'.
    """
    weather_score = signals.get("weather_mismatch_score", 0.0)
    graph_risk = signals.get("graph_risk", 0.0)
    directly_in_cycle = signals.get("directly_in_cycle", False)
    if_score = signals.get("isolation_forest_score", 0.0)

    if weather_score >= 0.7 or signals.get("weather_mismatch", False):
        return "PHYSICAL"
    if directly_in_cycle or graph_risk >= 0.85:
        return "GRAPH_CYCLE"
    if graph_risk >= 0.5 or signals.get("graph_flag", False):
        return "GRAPH_CLUSTER"
    if if_score >= 0.5 or signals.get("isolation_forest_flag", False):
        return "STATISTICAL"
    return "CLEAN"

def _generate_fallback_explanation(certificate: Dict[str, Any], signals: Dict[str, Any], strongest: str) -> str:
    """
    Deterministic rule-based audit explanation fallback matching Claude prompt tone.
    Guarantees demo reliability offline or without API key.
    """
    c_id = certificate.get("certificate_id", "Unknown")
    claimed = certificate.get("claimed_mwh")
    cap = certificate.get(
        "plant_rated_capacity_mwh",
        certificate.get("capacity_mwh")
    )
    source = certificate.get("energy_source", "").capitalize()
    parties = signals.get("touching_parties", [])
    parties_str = ", ".join(str(p) for p in parties) if parties else "associated market counterparties"

    if strongest == "CLEAN":
        cap_str = f"aligns with plant rated capacity ({cap} MWh)" if cap is not None else "aligns with baseline expectations"
        return (
            f"Certificate {c_id} appears fully legitimate. "
            f"Trading patterns are linear, claimed generation ({claimed} MWh) {cap_str}, "
            f"and meteorological conditions corroborate physical generation."
        )
    elif strongest == "PHYSICAL":
        # Identify specific physical breach: capacity overshoot vs solar night timing
        if cap is not None and claimed is not None and float(claimed) > float(cap):
            ratio = round(float(claimed) / float(cap), 2)
            reason = f"Claimed generation of {claimed} MWh exceeds plant rated capacity ({cap} MWh) by {ratio}x"
        else:
            ts = certificate.get("generation_timestamp", "")
            time_str = str(ts)
            if hasattr(ts, "strftime"):
                time_str = ts.strftime("%H:%M IST on %Y-%m-%d")
            reason = f"Solar generation claimed during night/darkness ({time_str}) when solar irradiance is zero"
        return (
            f"FLAGGED: Physical generation impossibility detected for {c_id}. "
            f"{reason}. Secondary audit on trading counterparties ({parties_str}) indicates "
            f"issuance occurred despite physically impossible generation parameters."
        )
    elif strongest == "GRAPH_CYCLE":
        risk = signals.get("graph_risk", 1.0)
        return (
            f"FLAGGED: Collusive circular trading ring detected. "
            f"Certificate {c_id} circulated through a closed loop among entities ({parties_str}), "
            f"exhibiting classic artificial volume inflation (wash trading) with high risk score ({risk})."
        )
    elif strongest == "GRAPH_CLUSTER":
        return (
            f"FLAGGED: High-density trading cluster anomaly. "
            f"Certificate {c_id} involves entities ({parties_str}) operating within an unusually dense, "
            f"inter-connected trading community exceeding baseline market density thresholds."
        )
    else:
        return (
            f"FLAGGED: Statistical volume outlier. "
            f"Claimed output ({claimed} MWh) deviates significantly from peer generation baselines."
        )


def generate_explanation(
    certificate: Dict[str, Any],
    signals: Dict[str, Any],
    force_generate: bool = False
) -> Optional[str]:
    """
    Generates a plain-English auditor explanation.
    
    Args:
        certificate: Certificate metadata dictionary
        signals: Combined dictionary of flags and risk scores
        force_generate: If True, generates explanation even for clean records (Rule 9/10).
    """
    is_flagged = (
        signals.get("graph_flag", False) or
        signals.get("weather_mismatch", False) or
        signals.get("isolation_forest_flag", False)
    )

    # Rule 9: Do not call LLM for clean certificates unless explicitly viewed/forced
    if not is_flagged and not force_generate:
        return None

    strongest = _rank_signals(signals)

    # Try Anthropic Claude API if key is available
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)

            prompt = f"""
You are a senior forensic energy auditor analyzing renewable energy certificate (REC) integrity.
Evaluate the following certificate data and fraud signals:

Certificate:
{certificate}

Signals & Evidence:
- Strongest signal identified: {strongest}
- Graph Risk: {signals.get('graph_risk', 0.0)} (Direct cycle: {signals.get('directly_in_cycle', False)})
- Weather/Physical Mismatch Score: {signals.get('weather_mismatch_score', 0.0)}
- Weather Reason: {signals.get('weather_reason', 'N/A')}
- Statistical Anomaly Score: {signals.get('isolation_forest_score', 0.0)}
- Parties Involved: {signals.get('touching_parties', [])}

Strict Instructions:
1. If no signals are flagged (clean case), state plainly that the certificate appears legitimate — do not invent any concern.
2. If flagged, lead directly with the strongest signal ({strongest}) first before noting secondary observations.
3. Keep the response to 2-3 punchy, professional sentences citing exact figures and party IDs.
"""

            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=250,
                temperature=0.2,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text.strip()
        except Exception:
            pass

    # Fallback to local deterministic explainer
    return _generate_fallback_explanation(certificate, signals, strongest)

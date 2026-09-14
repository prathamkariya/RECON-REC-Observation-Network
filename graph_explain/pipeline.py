"""
Role 2 Pipeline Fusion Entrypoint
Fuses Graph Ring Detection, Weather Physical Cross-Check, and Explainability.
Outputs exact contract shape specified for Role 3 (Ledger) and Role 4 (Backend).
"""

import sys
import os

# Support two invocation modes:
#   1. From repo root: `python -m graph_explain.pipeline` or as imported module
#   2. From graph_explain/: `python pipeline.py` or `pytest tests/`
_HERE = os.path.abspath(os.path.dirname(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_HERE, ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from typing import List, Dict, Any

try:
    from graph_explain.graph.fraud_ring import compute_graph_signal
    from graph_explain.weather.weather_client import compute_weather_mismatch
    from graph_explain.llm.explainer import generate_explanation
except ImportError:
    from graph.fraud_ring import compute_graph_signal
    from weather.weather_client import compute_weather_mismatch
    from llm.explainer import generate_explanation

def analyze_dataset(
    transactions: List[Dict[str, Any]],
    certificates: List[Dict[str, Any]],
    explain_all: bool = False,
    allow_network: bool = False,
) -> List[Dict[str, Any]]:
    """
    Runs the complete Role 2 analysis pipeline.
    
    Returns list of dicts strictly matching the output contract:
    {
      "certificate_id": str,
      "graph_flag": bool,
      "graph_risk": float,
      "weather_mismatch": bool,
      "weather_mismatch_score": float,
      "explanation": str | None
    }
    """
    # 1. Compute graph signals across all certificates
    graph_results = compute_graph_signal(transactions, certificates)

    output = []
    for cert in certificates:
        c_id = cert["certificate_id"]
        g_info = graph_results.get(c_id, {
            "graph_flag": False,
            "graph_risk": 0.0,
            "touching_parties": []
        })

        # 2. Compute physical & weather plausibility
        w_info = compute_weather_mismatch(cert, allow_network=allow_network)

        # 3. Fuse combined signals
        combined_signals = {
            "graph_flag": g_info.get("graph_flag", False),
            "graph_risk": g_info.get("graph_risk", 0.0),
            "directly_in_cycle": g_info.get("directly_in_cycle", False),
            "touching_parties": g_info.get("touching_parties", []),
            "weather_mismatch": w_info.get("weather_mismatch", False),
            "weather_mismatch_score": w_info.get("weather_mismatch_score", 0.0),
            "weather_reason": w_info.get("reason", "")
        }

        # 4. Generate plain-English explanation (Rule 9: flagged-only by default)
        explanation = generate_explanation(
            cert,
            combined_signals,
            force_generate=explain_all
        )

        # Exact handoff schema for Role 3 (Ledger) and Role 4 (Backend)
        output.append({
            "certificate_id": c_id,
            "graph_flag": combined_signals["graph_flag"],
            "graph_risk": combined_signals["graph_risk"],
            "weather_mismatch": combined_signals["weather_mismatch"],
            "weather_mismatch_score": combined_signals["weather_mismatch_score"],
            "explanation": explanation
        })

    return output

if __name__ == "__main__":
    import json
    import os

    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "mock_records.json")
    with open(fixture_path, "r") as f:
        data = json.load(f)

    results = analyze_dataset(data["transactions"], data["certificates"])
    print(json.dumps(results, indent=2))

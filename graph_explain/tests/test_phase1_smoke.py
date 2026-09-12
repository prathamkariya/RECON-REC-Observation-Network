"""
Phase 1 smoke test -- confirms the pipeline runs end-to-end against
mock fixtures and produces output in the correct shape. Does NOT yet
assert correctness of the detection logic itself (that's Phase 2/3).

Run from graph_explain/ directory:
    pytest tests/test_phase1_smoke.py -v

All imports use relative paths so pytest runs cleanly from graph_explain/.
"""

import sys
import os

# Ensure graph_explain root is importable when running from repo root or graph_explain/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from graph.fraud_ring import compute_graph_signal
from weather.weather_client import compute_weather_mismatch
from tests.fixtures.mock_certificates import MOCK_CERTIFICATES, MOCK_TRANSACTIONS


def test_graph_signal_runs_and_returns_correct_shape():
    """
    Verifies compute_graph_signal produces output in the correct contract shape
    for every mock certificate. Phase 1: shape only, not detection accuracy.
    """
    results = compute_graph_signal(MOCK_TRANSACTIONS, MOCK_CERTIFICATES)

    for cert in MOCK_CERTIFICATES:
        c_id = cert["certificate_id"]
        # Note: duplicate cert_ids share the same slot in results dict -- this is expected
        # behavior for Phase 1. Phase 2 will introduce (cert_id, gen_id) keying.
        assert c_id in results, f"certificate_id '{c_id}' missing from graph signal output"
        result = results[c_id]

        assert "graph_flag" in result, f"'graph_flag' key missing for {c_id}"
        assert "graph_risk" in result, f"'graph_risk' key missing for {c_id}"
        assert isinstance(result["graph_flag"], bool), \
            f"graph_flag must be bool for {c_id}, got {type(result['graph_flag'])}"
        assert isinstance(result["graph_risk"], float), \
            f"graph_risk must be float for {c_id}, got {type(result['graph_risk'])}"
        assert 0.0 <= result["graph_risk"] <= 1.0, \
            f"graph_risk out of [0,1] for {c_id}: {result['graph_risk']}"


def test_weather_mismatch_runs_and_returns_correct_shape():
    """
    Verifies compute_weather_mismatch produces output in the correct contract shape
    for every mock certificate. Phase 1: shape only, not detection accuracy.
    """
    for cert in MOCK_CERTIFICATES:
        result = compute_weather_mismatch(cert)
        c_id = cert["certificate_id"]

        assert "weather_mismatch" in result, f"'weather_mismatch' key missing for {c_id}"
        assert "weather_mismatch_score" in result, f"'weather_mismatch_score' key missing for {c_id}"
        assert isinstance(result["weather_mismatch"], bool), \
            f"weather_mismatch must be bool for {c_id}, got {type(result['weather_mismatch'])}"
        assert 0.0 <= result["weather_mismatch_score"] <= 1.0, \
            f"weather_mismatch_score out of [0,1] for {c_id}: {result['weather_mismatch_score']}"


def test_no_import_crash():
    """
    Sanity-check that all four Role 2 module files import without error.
    Phase 1 requires all four files to be importable (no bare 'pass' bodies crash).
    """
    from graph.fraud_ring import compute_graph_signal, detect_certificate_cycles, build_party_graph
    from weather.weather_client import compute_weather_mismatch, fetch_weather_data
    from llm.explainer import generate_explanation
    from llm.audit_chat import query_audit_assistant
    # If we reach here, no ImportError or SyntaxError in any of the four files


def test_pipeline_output_matches_api_contract():
    """
    Verifies the full pipeline output matches the API contract shape
    defined in docs/api-contract.md:
      { certificate_id, graph_flag, graph_risk, weather_mismatch,
        weather_mismatch_score, explanation }
    Phase 1: shape and types only.
    """
    # Import pipeline from graph_explain root level
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from pipeline import analyze_dataset

    results = analyze_dataset(MOCK_TRANSACTIONS, MOCK_CERTIFICATES)

    required_keys = {
        "certificate_id", "graph_flag", "graph_risk",
        "weather_mismatch", "weather_mismatch_score", "explanation"
    }

    assert len(results) == len(MOCK_CERTIFICATES), \
        f"Expected {len(MOCK_CERTIFICATES)} results, got {len(results)}"

    for r in results:
        assert required_keys == set(r.keys()), \
            f"Contract shape mismatch: expected {required_keys}, got {set(r.keys())}"
        assert isinstance(r["certificate_id"], str)
        assert isinstance(r["graph_flag"], bool)
        assert isinstance(r["graph_risk"], float)
        assert isinstance(r["weather_mismatch"], bool)
        assert isinstance(r["weather_mismatch_score"], float)
        # explanation is str or None (Rule 9: None for clean unflagged records)
        assert r["explanation"] is None or isinstance(r["explanation"], str), \
            f"explanation must be str or None for {r['certificate_id']}"

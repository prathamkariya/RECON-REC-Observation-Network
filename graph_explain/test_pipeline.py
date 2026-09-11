"""
Comprehensive verification test suite for Role 2 (Graph, Physical Check & Explainability).
"""
import json
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from graph_explain.pipeline import analyze_dataset
from graph_explain.llm.audit_chat import query_audit_assistant

def test_full_role2_suite():
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "mock_records.json")
    with open(fixture_path, "r") as f:
        data = json.load(f)

    print("Running Role 2 End-to-End Pipeline on Mock Fixtures...")
    results = analyze_dataset(data["transactions"], data["certificates"])

    res_map = {r["certificate_id"]: r for r in results}

    # Contract Shape Verification (matches docs/data-schema.md & output contract)
    required_keys = {"certificate_id", "graph_flag", "graph_risk", "weather_mismatch", "weather_mismatch_score", "explanation"}
    for r in results:
        assert set(r.keys()) == required_keys, f"Contract mismatch for {r['certificate_id']}: {r.keys()}"
        assert isinstance(r["graph_flag"], bool)
        assert isinstance(r["graph_risk"], float)
        assert isinstance(r["weather_mismatch"], bool)
        assert isinstance(r["weather_mismatch_score"], float)

    print("1. Contract Shape Verification: PASSED")

    # Clean records (Rule 9: explanation is None for unflagged batch items)
    assert res_map["REC-CLEAN-001"]["graph_flag"] is False
    assert res_map["REC-CLEAN-001"]["weather_mismatch"] is False
    assert res_map["REC-CLEAN-001"]["explanation"] is None

    assert res_map["REC-CLEAN-002"]["graph_flag"] is False
    assert res_map["REC-CLEAN-002"]["weather_mismatch"] is False
    assert res_map["REC-CLEAN-002"]["explanation"] is None
    print("2. Clean Records & Rule 9 (Skip LLM for clean): PASSED")

    # Circular trading fraud ring
    ring = res_map["REC-RING-001"]
    assert ring["graph_flag"] is True
    assert ring["graph_risk"] >= 0.85
    assert ring["weather_mismatch"] is False
    assert "circular trading ring" in ring["explanation"].lower()
    print("3. Circular Ring Detection (Rule 3 & 7): PASSED")

    # Impossible solar generation at night
    night = res_map["REC-NIGHT-001"]
    assert night["graph_flag"] is False
    assert night["weather_mismatch"] is True
    assert night["weather_mismatch_score"] == 1.0
    assert "night" in night["explanation"].lower() or "irradiance" in night["explanation"].lower()
    print("4. Physical Solar Impossibility (Rule 4, 5, 6): PASSED")

    # Over-capacity impossible claim
    over = res_map["REC-OVERCAP-001"]
    assert over["weather_mismatch"] is True
    assert over["weather_mismatch_score"] >= 0.7
    assert "capacity" in over["explanation"].lower()
    print("5. Over-capacity Physical Sanity Check: PASSED")

    # Compound case leading with strongest signal (Rule 11)
    compound = res_map["REC-COMPOUND-001"]
    assert compound["graph_flag"] is True
    assert compound["weather_mismatch"] is True
    # Rule 11: Physical impossibility takes precedence over graph ring in explanation header
    assert "physical generation impossibility" in compound["explanation"].lower()
    print("6. Strongest Signal Prioritization (Rule 11): PASSED")

    # Auditor Chat query verification
    cert_dict = next(c for c in data["certificates"] if c["certificate_id"] == "REC-RING-001")
    chat_reply = query_audit_assistant("REC-RING-001", "Why was this flagged?", cert_dict, {
        "graph_flag": True,
        "graph_risk": 1.0,
        "touching_parties": ["P_RING_01", "P_RING_02", "P_RING_03"]
    })
    assert "P_RING_01" in chat_reply
    print("7. Auditor Chat Assistant: PASSED")

    print("\n" + "="*50)
    print("ALL ROLE 2 DELIVERABLES & INTEGRATION TESTS PASSED!")
    print("="*50)

if __name__ == "__main__":
    test_full_role2_suite()

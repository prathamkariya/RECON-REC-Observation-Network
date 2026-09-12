"""
Phase 4 validation script for the plain-English explainability layer and audit assistant.

Runs comprehensive checks covering:
  1. Rule 9: Lazy / on-demand generation (None for clean unflagged records).
  2. Rule 10: Explicit clean case handling (no invented suspicions when forced).
  3. Rule 11: Leading with the strongest signal (Physical > Cycle > Cluster > Statistical).
  4. Accuracy on real seeded fraud cases (impossible_timing, over_capacity, circular_trading).
  5. Auditor interactive chat assistant (why, who, weather, risk queries).
  6. End-to-end pipeline execution and API contract compliance.
"""

import os
import sys
from datetime import datetime
import pandas as pd

# Setup paths
_TESTS_DIR = os.path.abspath(os.path.dirname(__file__))
_GRAPH_EXPLAIN_DIR = os.path.abspath(os.path.join(_TESTS_DIR, ".."))
_REPO_ROOT = os.path.abspath(os.path.join(_GRAPH_EXPLAIN_DIR, ".."))
for _p in [_REPO_ROOT, _GRAPH_EXPLAIN_DIR]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from llm.explainer import generate_explanation, _rank_signals
from llm.audit_chat import query_audit_assistant
from pipeline import analyze_dataset

DATA_DIR = os.path.join(_REPO_ROOT, "data")
pass_count = 0
fail_count = 0

print("=" * 60)
print("Role 2 — Phase 4 Validation: Explainability & Auditor Chat")
print("=" * 60)

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 1: Rule 9 — Lazy / on-demand generation
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 1: Rule 9 (skip clean certificates by default) ───────────────")
clean_cert = {
    "certificate_id": "REC-CLEAN-TEST",
    "claimed_mwh": 15.0,
    "plant_rated_capacity_mwh": 30.0,
    "energy_source": "solar",
}
clean_signals = {
    "graph_flag": False,
    "graph_risk": 0.1,
    "weather_mismatch": False,
    "weather_mismatch_score": 0.0,
    "touching_parties": ["PTY001", "PTY002"],
}

exp_default = generate_explanation(clean_cert, clean_signals, force_generate=False)
if exp_default is None:
    print("  PASS: Clean certificate returns None by default (no wasted LLM calls)")
    pass_count += 1
else:
    print(f"  FAIL: Expected None, got '{exp_default}'")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 2: Rule 10 — Clean case explicit handling
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 2: Rule 10 (explicit clean case phrasing when forced) ────────")
exp_forced = generate_explanation(clean_cert, clean_signals, force_generate=True)
if exp_forced and "legitimate" in exp_forced.lower() and "flagged" not in exp_forced.lower():
    print(f"  PASS: Clean cert explicitly certified legitimate:")
    print(f"        '{exp_forced}'")
    pass_count += 1
else:
    print(f"  FAIL: Expected legitimate non-flagged text, got: {exp_forced}")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 3: Rule 11 — Lead with the strongest signal
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 3: Rule 11 (evidentiary ranking — lead with strongest) ───────")
rank_tests = [
    (
        {"weather_mismatch": True, "weather_mismatch_score": 1.0, "graph_flag": True, "graph_risk": 0.95},
        "PHYSICAL",
        "Physical impossibility ranks higher than graph cycle",
    ),
    (
        {"weather_mismatch": False, "weather_mismatch_score": 0.0, "directly_in_cycle": True, "graph_risk": 0.9},
        "GRAPH_CYCLE",
        "Direct cycle ranks higher than statistical anomaly",
    ),
    (
        {"weather_mismatch": False, "graph_flag": True, "graph_risk": 0.6, "isolation_forest_flag": True},
        "GRAPH_CLUSTER",
        "Dense cluster ranks higher than volume outlier",
    ),
    (
        {"weather_mismatch": False, "graph_flag": False, "isolation_forest_flag": True, "isolation_forest_score": 0.8},
        "STATISTICAL",
        "Volume outlier ranked when only statistical flag fires",
    ),
]

all_ranks_ok = True
for sigs, expected_rank, desc in rank_tests:
    actual_rank = _rank_signals(sigs)
    if actual_rank == expected_rank:
        print(f"  OK   [{actual_rank}]: {desc}")
    else:
        print(f"  FAIL [{actual_rank} != {expected_rank}]: {desc}")
        all_ranks_ok = False

if all_ranks_ok:
    print("  PASS: Signal ranking correctly prioritizes conclusive physical evidence")
    pass_count += 1
else:
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 4: Real seeded fraud explanations quality
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 4: Explanations on real fraud patterns ──────────────────────")
certs_df = pd.read_csv(os.path.join(DATA_DIR, "certificates.csv"),
                       parse_dates=["generation_timestamp"])

# 4a: impossible_timing
sample_timing = certs_df[certs_df["fraud_type"] == "impossible_timing"].iloc[0].to_dict()
timing_sigs = {
    "weather_mismatch": True,
    "weather_mismatch_score": 1.0,
    "graph_flag": False,
    "touching_parties": ["PTY00101", "PTY00102"],
}
exp_timing = generate_explanation(sample_timing, timing_sigs)
has_timing_kw = "physical" in exp_timing.lower() and ("night" in exp_timing.lower() or "darkness" in exp_timing.lower())

# 4b: over_capacity
sample_cap = certs_df[certs_df["fraud_type"] == "over_capacity"].iloc[0].to_dict()
cap_sigs = {
    "weather_mismatch": True,
    "weather_mismatch_score": 0.85,
    "graph_flag": False,
    "touching_parties": ["PTY00201"],
}
exp_cap = generate_explanation(sample_cap, cap_sigs)
has_cap_kw = "capacity" in exp_cap.lower() and "exceeds" in exp_cap.lower()

# 4c: circular_trading
sample_circ = certs_df[certs_df["fraud_type"] == "circular_trading"].iloc[0].to_dict()
circ_sigs = {
    "weather_mismatch": False,
    "weather_mismatch_score": 0.0,
    "graph_flag": True,
    "graph_risk": 0.95,
    "directly_in_cycle": True,
    "touching_parties": ["PTY00069", "PTY00130", "PTY00162"],
}
exp_circ = generate_explanation(sample_circ, circ_sigs)
has_circ_kw = "circular" in exp_circ.lower() or "wash" in exp_circ.lower()

if has_timing_kw and has_cap_kw and has_circ_kw:
    print("  PASS: Seeded fraud cases receive specific, evidence-backed explanations:")
    print(f"    Timing:   {exp_timing[:95]}...")
    print(f"    Capacity: {exp_cap[:95]}...")
    print(f"    Cycle:    {exp_circ[:95]}...")
    pass_count += 1
else:
    print(f"  FAIL: Seeded fraud explanations missing key domain rationale")
    print(f"    Timing: {exp_timing}")
    print(f"    Capacity: {exp_cap}")
    print(f"    Cycle: {exp_circ}")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 5: Auditor Interactive Chat Assistant
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 5: Auditor Interactive Chat Assistant ────────────────────────")
chat_sample_cert = {
    "certificate_id": "REC-AUDIT-001",
    "claimed_mwh": 120.0,
    "plant_rated_capacity_mwh": 50.0,
    "energy_source": "solar",
}
chat_sample_sigs = {
    "graph_flag": True,
    "graph_risk": 0.92,
    "weather_mismatch": True,
    "weather_mismatch_score": 0.95,
    "touching_parties": ["PTY00010", "PTY00020", "PTY00030"],
    "weather_reason": "Claimed 120.0 MWh against 50.0 MWh rated capacity (2.4x overshoot)",
}

q_why = query_audit_assistant("REC-AUDIT-001", "Why was this certificate flagged?", chat_sample_cert, chat_sample_sigs)
q_who = query_audit_assistant("REC-AUDIT-001", "Who are the entities involved?", chat_sample_cert, chat_sample_sigs)
q_risk = query_audit_assistant("REC-AUDIT-001", "What are the risk scores?", chat_sample_cert, chat_sample_sigs)

chat_ok = (
    "Physical Generation Mismatch" in q_why
    and "PTY00010" in q_who
    and "0.92" in q_risk
)

if chat_ok:
    print("  PASS: Auditor assistant handles why, who, and risk score inquiries accurately")
    print(f"    Why query response snippet:  {q_why.splitlines()[0]} -> {len(q_why.splitlines())-1} reasons listed")
    print(f"    Who query response:          {q_who}")
    print(f"    Risk query response:         {q_risk}")
    pass_count += 1
else:
    print("  FAIL: Auditor chat responses missing expected detail:")
    print(f"    Why:  {q_why}")
    print(f"    Who:  {q_who}")
    print(f"    Risk: {q_risk}")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 6: End-to-end Pipeline on Mock Dataset
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 6: End-to-end Pipeline API Contract Compliance ───────────────")
import json
with open(os.path.join(_GRAPH_EXPLAIN_DIR, "fixtures", "mock_records.json"), "r") as f:
    mock_data = json.load(f)

pipeline_results = analyze_dataset(mock_data["transactions"], mock_data["certificates"])
required_contract_keys = {
    "certificate_id",
    "graph_flag",
    "graph_risk",
    "weather_mismatch",
    "weather_mismatch_score",
    "explanation",
}

pipeline_ok = True
for r in pipeline_results:
    if set(r.keys()) != required_contract_keys:
        print(f"  FAIL: Keys mismatch for {r['certificate_id']}: {set(r.keys())}")
        pipeline_ok = False
        break

if pipeline_ok and len(pipeline_results) == len(mock_data["certificates"]):
    print(f"  PASS: {len(pipeline_results)}/{len(pipeline_results)} records conform exactly to API contract")
    pass_count += 1
else:
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"Phase 4 validation: {pass_count} PASSED, {fail_count} FAILED")
if fail_count == 0:
    print("ALL PHASE 4 CHECKS PASSED ✓")
else:
    print("SOME CHECKS FAILED — REVIEW ABOVE")
print("=" * 60)

sys.exit(0 if fail_count == 0 else 1)

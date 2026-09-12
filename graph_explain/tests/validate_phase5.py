"""
Phase 5 validation script for the Auditor Chat Interface (chat_session).
Tests all 5 checks from ROLE2_PHASE5_INSTRUCTIONS.md §5 and §6:
  1. Not-found certificate ID handling (honest "not found" response).
  2. Ambiguous duplicate_serial certificate ID handling (acknowledges both versions).
  3. Grounded specific follow-up Q&A on real flagged certificates.
  4. Out-of-bounds questions (gracefully states information is not available).
  5. API contract shape compliance: { "certificate_id": str, "reply": str }.
"""

import os
import sys
import pandas as pd

# Setup paths
_TESTS_DIR = os.path.abspath(os.path.dirname(__file__))
_GRAPH_EXPLAIN_DIR = os.path.abspath(os.path.join(_TESTS_DIR, ".."))
_REPO_ROOT = os.path.abspath(os.path.join(_GRAPH_EXPLAIN_DIR, ".."))
for _p in [_REPO_ROOT, _GRAPH_EXPLAIN_DIR]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from llm.audit_chat import (
    assemble_certificate_context,
    _build_chat_prompt,
    chat_session,
)

DATA_DIR = os.path.join(_REPO_ROOT, "data")
certs_df = pd.read_csv(os.path.join(DATA_DIR, "certificates.csv"), parse_dates=["generation_timestamp"])
txs_df = pd.read_csv(os.path.join(DATA_DIR, "transactions.csv"), parse_dates=["transfer_timestamp"])

pass_count = 0
fail_count = 0

print("=" * 60)
print("Role 2 — Phase 5 Validation: Auditor Chat Interface")
print("=" * 60)

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 1: Not-found certificate ID
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 1: Not-found certificate ID ─────────────────────────────────")
fake_id = "CERT_NONEXISTENT_9999"
res_nf = chat_session(fake_id, "Why was this certificate flagged?", certs_df, txs_df)

if "not found" in res_nf["reply"].lower() or "could not be found" in res_nf["reply"].lower():
    print(f"  PASS: Honest 'not found' response received:")
    print(f"        '{res_nf['reply']}'")
    pass_count += 1
else:
    print(f"  FAIL: Expected 'not found' notification, got: '{res_nf['reply']}'")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 2: Ambiguous duplicate_serial certificate ID
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 2: Ambiguous duplicate_serial certificate ID ────────────────")
dup_certs = certs_df[certs_df["fraud_type"] == "duplicate_serial"]
assert len(dup_certs) > 0, "No duplicate_serial certificates found in data!"
sample_dup_id = dup_certs.iloc[0]["certificate_id"]

res_dup = chat_session(sample_dup_id, "What is the status of this certificate?", certs_df, txs_df)
reply_lower = res_dup["reply"].lower()
acknowledges_two = (
    ("two" in reply_lower or "2" in reply_lower or "both" in reply_lower)
    and ("duplicate" in reply_lower or "version" in reply_lower)
)

if acknowledges_two:
    print(f"  PASS: Duplicate serial ID '{sample_dup_id}' correctly recognized with 2 versions:")
    print(f"        '{res_dup['reply']}'")
    pass_count += 1
else:
    print(f"  FAIL: Failed to clearly acknowledge both versions for {sample_dup_id}:")
    print(f"        '{res_dup['reply']}'")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 3: Grounded specific follow-up questions on real flagged certs
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 3: Specific grounded questions on flagged certificates ──────")
# 3a: Circular trading certificate
circ_sample = certs_df[certs_df["fraud_type"] == "circular_trading"].iloc[0]
circ_id = circ_sample["certificate_id"]
mock_circ_signal = {
    "graph_flag": True,
    "graph_risk": 0.95,
    "weather_mismatch": False,
    "weather_mismatch_score": 0.0,
    "explanation": "Collusive circular trading ring detected."
}
res_circ_why = chat_session(circ_id, "Why was this flagged?", certs_df, txs_df, {circ_id: mock_circ_signal})
res_circ_who = chat_session(circ_id, "Which parties were involved in trading?", certs_df, txs_df, {circ_id: mock_circ_signal})

circ_ok = (
    ("circular" in res_circ_why["reply"].lower() or "trading ring" in res_circ_why["reply"].lower() or "wash" in res_circ_why["reply"].lower())
    and "PTY" in res_circ_who["reply"]
)

# 3b: Over capacity certificate
cap_sample = certs_df[certs_df["fraud_type"] == "over_capacity"].iloc[0]
cap_id = cap_sample["certificate_id"]
mock_cap_signal = {
    "graph_flag": False,
    "graph_risk": 0.1,
    "weather_mismatch": True,
    "weather_mismatch_score": 0.9,
    "explanation": f"Claimed generation of {cap_sample['claimed_mwh']} MWh exceeds plant capacity."
}
res_cap = chat_session(cap_id, "Was the claimed generation above the plant rated capacity?", certs_df, txs_df, {cap_id: mock_cap_signal})

cap_ok = (
    str(round(cap_sample["claimed_mwh"], 1)) in res_cap["reply"]
    or "exceeds" in res_cap["reply"].lower()
    or "capacity" in res_cap["reply"].lower()
)

if circ_ok and cap_ok:
    print("  PASS: Grounded questions answered with verified data and entity IDs:")
    print(f"    Circular Query:   '{res_circ_why['reply'][:85]}...'")
    print(f"    Counterparties:   '{res_circ_who['reply'][:85]}...'")
    print(f"    Capacity Inquiry: '{res_cap['reply'][:85]}...'")
    pass_count += 1
else:
    print("  FAIL: Chat replies lacked grounded data:")
    print(f"    Circ Why: {res_circ_why['reply']}")
    print(f"    Circ Who: {res_circ_who['reply']}")
    print(f"    Capacity: {res_cap['reply']}")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 4: Unanswerable / out-of-scope inquiry handling
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 4: Unanswerable / out-of-scope inquiry handling ───────────────")
res_unanswerable = chat_session(circ_id, "What was the weather like yesterday and who is the company CEO?", certs_df, txs_df)
unanswerable_ok = (
    "not covered" in res_unanswerable["reply"].lower()
    or "not available" in res_unanswerable["reply"].lower()
    or "limited to" in res_unanswerable["reply"].lower()
)

if unanswerable_ok:
    print("  PASS: Out-of-bounds question honestly demurred without fabricating details:")
    print(f"        '{res_unanswerable['reply']}'")
    pass_count += 1
else:
    print(f"  FAIL: Expected demurral, got: '{res_unanswerable['reply']}'")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 5: API contract compliance (POST /api/v1/audit/chat shape)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 5: API contract compliance ───────────────────────────────────")
res_contract = chat_session("CERT000001", "What is the summary?", certs_df, txs_df)
contract_ok = (
    set(res_contract.keys()) == {"certificate_id", "reply"}
    and isinstance(res_contract["certificate_id"], str)
    and isinstance(res_contract["reply"], str)
    and len(res_contract["reply"]) > 0
)

if contract_ok:
    print(f"  PASS: Return shape conforms exactly to contract: {{'certificate_id': str, 'reply': str}}")
    pass_count += 1
else:
    print(f"  FAIL: Response keys mismatch: {res_contract}")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"Phase 5 validation: {pass_count} PASSED, {fail_count} FAILED")
if fail_count == 0:
    print("ALL PHASE 5 CHECKS PASSED ✓")
else:
    print("SOME CHECKS FAILED — REVIEW ABOVE")
print("=" * 60)

sys.exit(0 if fail_count == 0 else 1)

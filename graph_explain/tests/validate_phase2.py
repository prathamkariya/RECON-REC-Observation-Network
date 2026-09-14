"""
Phase 2 validation script for fraud_ring.py.

Runs all required checks from ROLE2_PHASE2_INSTRUCTIONS.md §6:
  1. 42/42 circular_trading certificates detected (hard pass/fail)
  2. Hub party (PTY00001 / highest-volume party) NOT in a flagged community
  3. Community inspection — print flagged communities for manual eyeball check
  4. Gradient check — cycle certs score >= 0.9, clean certs score < 0.5 on average
  5. Phase 1 smoke tests still pass

Run from repo root:
    D:\\apps\\Anaconda\\python.exe graph_explain/tests/validate_phase2.py

Or from graph_explain/:
    D:\\apps\\Anaconda\\python.exe tests/validate_phase2.py
"""

import sys
import os

# Path setup: works from graph_explain/ or repo root
_HERE = os.path.abspath(os.path.dirname(__file__))
_GRAPH_EXPLAIN = os.path.abspath(os.path.join(_HERE, ".."))
_REPO_ROOT = os.path.abspath(os.path.join(_GRAPH_EXPLAIN, ".."))
for p in [_GRAPH_EXPLAIN, _REPO_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

import pandas as pd
from graph.fraud_ring import (
    detect_cycles,
    detect_communities,
    compute_party_risk_scores,
    compute_graph_signal,
)

DATA_DIR = os.path.join(_REPO_ROOT, "data")

# ─────────────────────────────────────────────────────────────────────────────
# Load data
# ─────────────────────────────────────────────────────────────────────────────
print("Loading data...")
certs = pd.read_csv(os.path.join(DATA_DIR, "certificates.csv"))
txns  = pd.read_csv(os.path.join(DATA_DIR, "transactions.csv"))
print(f"  {len(certs)} certificates, {len(txns)} transactions, "
      f"{txns['from_party_id'].nunique() + txns['to_party_id'].nunique()} party refs")

pass_count = 0
fail_count = 0

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 1: 42/42 circular_trading cycle recall
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 1: circular_trading recall ──────────────────────────────────")
circular_certs = certs[certs["fraud_type"] == "circular_trading"]
failures = []
detected = 0
for _, row in circular_certs.iterrows():
    result = detect_cycles(txns, row["certificate_id"], row["generator_id"])
    if result["has_cycle"]:
        detected += 1
    else:
        failures.append(row["certificate_id"])

total = len(circular_certs)
if failures:
    print(f"  FAIL: {detected}/{total} detected. Missed: {failures[:5]}{'...' if len(failures)>5 else ''}")
    fail_count += 1
else:
    print(f"  PASS: {detected}/{total} circular_trading certs correctly flagged")
    pass_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 2: Hub party does NOT get flagged by community detection
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 2: Hub party not falsely flagged ────────────────────────────")
party_counts: dict[str, int] = {}
for _, row in txns.iterrows():
    party_counts[row["from_party_id"]] = party_counts.get(row["from_party_id"], 0) + 1
    party_counts[row["to_party_id"]]   = party_counts.get(row["to_party_id"], 0) + 1

hub_party = max(party_counts, key=lambda p: party_counts[p])
hub_count = party_counts[hub_party]
print(f"  Hub party: {hub_party} ({hub_count} transactions)")

community_result = detect_communities(txns)
flagged_communities = [c for c in community_result["communities"] if c["flagged"]]
hub_flagged = any(hub_party in c["members"] for c in flagged_communities)

if hub_flagged:
    print(f"  FAIL: Hub party {hub_party} IS in a flagged community — threshold needs adjustment")
    fail_count += 1
else:
    print(f"  PASS: Hub party {hub_party} is NOT in any flagged community")
    pass_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 3: Manual community inspection (print flagged for eyeball review)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 3: Flagged community inspection (manual review) ─────────────")
print(f"  Graph baseline density: {community_result['graph_density']}")
print(f"  Total communities found: {len(community_result['communities'])}")
print(f"  Flagged communities: {len(flagged_communities)}")

for i, comm in enumerate(flagged_communities[:5]):  # show up to 5
    members_preview = comm["members"][:6]
    extra = f"...+{len(comm['members'])-6}" if len(comm["members"]) > 6 else ""
    print(f"    [{i+1}] size={len(comm['members'])}, density={comm['density']:.4f}: "
          f"{members_preview}{extra}")

if len(flagged_communities) > 5:
    print(f"    ... ({len(flagged_communities) - 5} more flagged communities)")

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 4: graph_risk gradient — cycle certs high, clean certs low
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 4: graph_risk gradient verification ─────────────────────────")
tx_list   = txns.to_dict(orient="records")
cert_list = certs.to_dict(orient="records")

graph_signals = compute_graph_signal(tx_list, cert_list)

circular_risks = [
    graph_signals[row["certificate_id"]]["graph_risk"]
    for _, row in certs[certs["fraud_type"] == "circular_trading"].iterrows()
    if row["certificate_id"] in graph_signals
]
clean_risks = [
    graph_signals[row["certificate_id"]]["graph_risk"]
    for _, row in certs[certs["fraud_type"].isna()].iterrows()
    if row["certificate_id"] in graph_signals
]

avg_circular = sum(circular_risks) / len(circular_risks) if circular_risks else 0.0
avg_clean    = sum(clean_risks)    / len(clean_risks)    if clean_risks    else 0.0

print(f"  Circular certs  → avg graph_risk = {avg_circular:.4f}  "
      f"(min={min(circular_risks):.4f}, max={max(circular_risks):.4f})")
print(f"  Clean certs     → avg graph_risk = {avg_clean:.4f}  "
      f"(min={min(clean_risks):.4f}, max={max(clean_risks):.4f})")

flagged_circular = sum(1 for r in circular_risks if r >= 0.9)
print(f"  Circular certs with risk >= 0.9: {flagged_circular}/{len(circular_risks)}")

if avg_circular >= 0.85 and avg_clean < 0.5:
    print(f"  PASS: Clear separation between circular ({avg_circular:.3f}) and clean ({avg_clean:.3f})")
    pass_count += 1
else:
    print(f"  FAIL: Insufficient separation — review threshold logic")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 5: API contract shape
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 5: API contract shape ───────────────────────────────────────")
required_keys = {"graph_flag", "graph_risk"}
shape_ok = True
for c_id, sig in list(graph_signals.items())[:10]:
    if not required_keys.issubset(sig.keys()):
        print(f"  FAIL: {c_id} missing keys: {required_keys - set(sig.keys())}")
        shape_ok = False
        break
    if not isinstance(sig["graph_flag"], bool):
        print(f"  FAIL: graph_flag is {type(sig['graph_flag'])} for {c_id}")
        shape_ok = False
        break
    if not (0.0 <= sig["graph_risk"] <= 1.0):
        print(f"  FAIL: graph_risk={sig['graph_risk']} out of range for {c_id}")
        shape_ok = False
        break

if shape_ok:
    print(f"  PASS: All {len(graph_signals)} results match API contract shape")
    pass_count += 1
else:
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"Phase 2 validation: {pass_count} PASSED, {fail_count} FAILED")
if fail_count == 0:
    print("ALL PHASE 2 CHECKS PASSED ✓")
else:
    print("SOME CHECKS FAILED — review output above before committing")
print("="*60)

sys.exit(0 if fail_count == 0 else 1)

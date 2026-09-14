"""
Adapter for Role 2's fraud-ring detection: analyze(record) ->
{"graph_flag": bool, "graph_risk": float, "reasons": [str]}.

Mock: a small cycle walk over the record's own `transactions` plus an
issuer==buyer self-dealing check — no networkx/Louvain required.

Real: imports graph_explain.graph.fraud_ring.compute_graph_signal, behind
USE_REAL_GRAPH. Two integration details matter here, confirmed empirically
before wiring this in (calling compute_graph_signal directly, not guessed):

1. compute_graph_signal expects each certificate dict to have a
   `generator_id` key (not `issuer_id`, our own contract's field name) --
   it's used to check whether a cycle routes back through the issuing
   generator. Passing `issuer_id` silently produces generator_id="" and
   the cycle-through-generator check never fires. Confirmed: a real
   circular_trading certificate (CERT000001) scored graph_risk=0.0 with
   the wrong key and graph_risk=0.9 with the right one.
2. compute_graph_signal's community/Louvain detection is a whole-graph
   analysis, calibrated (per its own docstring) against "310 parties,
   3735 edges" -- recomputing it from scratch on every single request
   against a slice that grows one certificate at a time is both slow
   (confirmed: 12.8ms/call at 25 known certs, 65.9ms/call at 200, still
   climbing) and order-dependent (flag rate swung 51-61% while the graph
   was partial, vs. the dataset's real ~16.9% fraud rate). Role 2 already
   solved this properly -- graph_explain/pipeline.py's analyze_dataset()
   is their own batch entry point that calls compute_graph_signal exactly
   once for a whole known dataset, matching fraud_ring.py's own
   documented recommendation ("pre-compute party scores once... before
   final integration"). preload_batch() below uses that same one-call
   pattern for a bulk load (see backend/scripts/load_dataset.py), and
   _real_analyze() falls back to accumulating and recomputing per call
   only for certificates arriving after the batch (genuine live,
   one-at-a-time submissions, which have no other option since
   compute_graph_signal has no incremental-update mode).
"""
from typing import Dict, List, Optional

from ..config import settings

_known_transactions: List[dict] = []
_known_certificates: Dict[str, dict] = {}
_batch_results: Optional[Dict[str, dict]] = None


def preload_batch(transactions: List[dict], certificates: List[dict]) -> int:
    """Runs Role 2's real graph analysis exactly once over a full known
    dataset (transactions: from_party_id/to_party_id/certificate_id/
    transfer_timestamp; certificates: certificate_id/generator_id), caching
    every certificate's result for O(1) lookup in _real_analyze. Returns the
    number of certificates preloaded, or -1 if the real module isn't
    available (caller should treat that as "preload skipped, mock only")."""
    global _batch_results
    # analyze() only consults the batch cache on the real path, so preloading
    # while USE_REAL_GRAPH is off would run whole-dataset Louvain detection
    # (seconds, on 1200+ certificates) to build a result nothing can read.
    # load_dataset.py calls this unconditionally, so the flag check lives here.
    if not settings.USE_REAL_GRAPH:
        _batch_results = None
        return -1
    try:
        from graph_explain.graph.fraud_ring import compute_graph_signal  # teammate's module (Role 2)

        _batch_results = compute_graph_signal(transactions, certificates)
        _known_transactions[:] = transactions
        _known_certificates.clear()
        _known_certificates.update({c["certificate_id"]: c for c in certificates})
        return len(_batch_results)
    except Exception:
        _batch_results = None
        return -1


def _mock_analyze(record: dict) -> dict:
    transactions = record.get("transactions", [])
    parties = set()
    edges = []
    for tx in transactions:
        parties.add(tx["from_party_id"])
        parties.add(tx["to_party_id"])
        edges.append((tx["from_party_id"], tx["to_party_id"]))

    has_cycle = False
    for start in parties:
        visited = {start}
        current = start
        for _ in range(len(edges) + 1):
            nxt = next((b for a, b in edges if a == current), None)
            if nxt is None:
                break
            if nxt == start and len(visited) > 1:
                has_cycle = True
                break
            if nxt in visited:
                break
            visited.add(nxt)
            current = nxt
        if has_cycle:
            break

    self_dealing = record["issuer_id"] == record["buyer_id"]

    reasons = []
    if has_cycle:
        reasons.append(f"Circular trading ring detected among parties: {', '.join(sorted(parties))}")
    if self_dealing:
        reasons.append("Issuer and buyer are the same party")

    graph_risk = 0.9 if has_cycle else (0.6 if self_dealing else 0.0)

    return {
        "graph_flag": has_cycle or self_dealing,
        "graph_risk": graph_risk,
        "directly_in_cycle": has_cycle,
        "reasons": reasons,
    }


def _reasons_from_signal(sig: dict) -> list:
    flag = sig.get("graph_flag", False)
    risk = sig.get("graph_risk", 0.0)
    reasons = []
    if sig.get("directly_in_cycle"):
        cycle_path = sig.get("cycle_path")
        path_str = " -> ".join(cycle_path) if cycle_path else "closed transaction loop"
        reasons.append(f"Circular trading ring detected: {path_str}")
    elif flag:
        reasons.append(f"High-density trading community anomaly (risk score: {risk})")
    return reasons


def _real_analyze(record: dict) -> dict:
    cert_id = record["certificate_id"]

    # Fast path: this certificate was part of a preload_batch() call, so its
    # result is already computed -- no per-request recomputation needed.
    if _batch_results is not None and cert_id in _batch_results:
        sig = _batch_results[cert_id]
        return {
            "graph_flag": bool(sig.get("graph_flag", False)),
            "graph_risk": float(sig.get("graph_risk", 0.0)),
            "directly_in_cycle": bool(sig.get("directly_in_cycle", False)),
            "reasons": _reasons_from_signal(sig),
        }

    # Fallback: a genuinely new certificate arriving after the batch (or no
    # batch was ever preloaded) -- recompute over everything known so far.
    # There's no incremental-update API on compute_graph_signal, so this is
    # the best available option for live, one-at-a-time submissions.
    try:
        from graph_explain.graph.fraud_ring import compute_graph_signal  # teammate's module (Role 2)

        generator_id = record["issuer_id"]
        _known_transactions.extend(record.get("transactions", []))
        _known_certificates[cert_id] = {"certificate_id": cert_id, "generator_id": generator_id}

        result = compute_graph_signal(_known_transactions, list(_known_certificates.values()))
        sig = result.get(cert_id, {})
        return {
            "graph_flag": bool(sig.get("graph_flag", False)),
            "graph_risk": float(sig.get("graph_risk", 0.0)),
            "directly_in_cycle": bool(sig.get("directly_in_cycle", False)),
            "reasons": _reasons_from_signal(sig),
        }
    except Exception:
        return _mock_analyze(record)


def analyze(record: dict) -> dict:
    if settings.USE_REAL_GRAPH:
        return _real_analyze(record)
    return _mock_analyze(record)

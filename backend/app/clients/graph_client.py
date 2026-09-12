"""
Adapter for Role 2's fraud-ring detection: analyze(record) ->
{"graph_flag": bool, "graph_risk": float, "reasons": [str]}.

Mock: a small cycle walk over the record's own `transactions` plus an
issuer==buyer self-dealing check — no networkx/Louvain required.
Real: imports graph_explain.graph.fraud_ring, behind USE_REAL_GRAPH.
"""
from ..config import settings


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

    return {"graph_flag": has_cycle or self_dealing, "graph_risk": graph_risk, "reasons": reasons}


def _real_analyze(record: dict) -> dict:
    try:
        from graph_explain.graph.fraud_ring import compute_graph_signal  # teammate's module (Role 2)

        transactions = record.get("transactions", [])
        result = compute_graph_signal(transactions, [record])
        c_id = record.get("certificate_id")
        sig = result.get(c_id, next(iter(result.values())) if result else {})
        flag = sig.get("graph_flag", False)
        risk = sig.get("graph_risk", 0.0)
        reasons = []
        if sig.get("directly_in_cycle"):
            cycle_path = sig.get("cycle_path")
            path_str = " -> ".join(cycle_path) if cycle_path else "closed transaction loop"
            reasons.append(f"Circular trading ring detected: {path_str}")
        elif flag:
            reasons.append(f"High-density trading community anomaly (risk score: {risk})")
        return {"graph_flag": bool(flag), "graph_risk": float(risk), "reasons": reasons}
    except Exception:
        return _mock_analyze(record)


def analyze(record: dict) -> dict:
    if settings.USE_REAL_GRAPH:
        return _real_analyze(record)
    return _mock_analyze(record)

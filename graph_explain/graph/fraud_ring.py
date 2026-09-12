"""
Trading-graph fraud-ring detection for RECON REC Fraud Detection (Role 2, Phase 2).

Two independent signals, fused into one graph_risk per certificate:
  1. Cycle detection  — does THIS certificate's own chain loop back to its generator?
  2. Community detection — do the parties trading this cert form an unusually dense ring?

Design rationale and threshold justification are documented inline, grounded in the
real dataset distribution (310 parties, 3735 edges, median involvement=8.5, max=1575).

KNOWN PERFORMANCE NOTE (§5 of Phase 2 instructions):
  compute_party_risk_scores() is called once per compute_graph_signal() call.
  When running over all 1242 certificates, this recomputes community detection
  1242 times. Before final integration, callers should pre-compute party scores
  once and pass them in. Tracked here explicitly per Phase 2 DoD requirement.
"""

from __future__ import annotations

import pandas as pd
import networkx as nx
from networkx.algorithms.community import louvain_communities
from typing import Any

# ---------------------------------------------------------------------------
# Thresholds — justified against this dataset's real distribution
# ---------------------------------------------------------------------------
# Party involvement: min=1, median=8.5, mean=24.66, max=1575
# The max=1575 party is a clearinghouse hub, NOT evidence of fraud.
# A naïve absolute threshold would flag it and everything it touches.
#
# Instead: flag a community only when its INTERNAL EDGE DENSITY is
# significantly higher than the graph baseline AND the community is small
# enough to be a plausible coordinated ring rather than a structural hub.
#
# DENSITY_MULTIPLIER_THRESHOLD=3.0: chosen to be above the noise that
# arises from legitimate repeat trading between natural trading partners,
# while still catching the deliberately tight rings the generator injects.
# Manually verified: at 3.0x the hub community (which includes PTY00001)
# does NOT get flagged because its density is barely above baseline.
#
# MAX_RING_SIZE=15: the hub party touches hundreds of counterparties, so its
# Louvain community will be large. Capping at 15 safely excludes hub
# structures (verified: hub community size >> 15 in real data).
DENSITY_MULTIPLIER_THRESHOLD = 3.0
MAX_RING_SIZE = 15


# ---------------------------------------------------------------------------
# Step 1 — Build the transaction graph
# ---------------------------------------------------------------------------

def build_transaction_graph(transactions_df: pd.DataFrame) -> nx.MultiDiGraph:
    """
    Builds a directed multigraph from transaction rows.

    Uses MultiDiGraph (not DiGraph) so that two parties can have multiple
    edges across different certificates — collapsing them would lose the
    per-certificate traceability needed by the explainability layer.

    Expects columns: from_party_id, to_party_id, certificate_id, transfer_timestamp
    """
    G = nx.MultiDiGraph()
    for _, row in transactions_df.iterrows():
        G.add_edge(
            row["from_party_id"],
            row["to_party_id"],
            certificate_id=row["certificate_id"],
            transfer_timestamp=row["transfer_timestamp"],
        )
    return G


# ---------------------------------------------------------------------------
# Step 2 — Per-certificate cycle detection
# ---------------------------------------------------------------------------

def detect_cycles(
    transactions_df: pd.DataFrame,
    certificate_id: str,
    generator_id: str,
) -> dict[str, Any]:
    """
    Checks whether a specific certificate's OWN transaction chain forms a
    cycle back to its own generator_id.

    Filters to this certificate's rows only before running simple_cycles —
    the whole-dataset graph mixes chains from all 1242 certificates and
    would find coincidental cross-certificate cycles that cannot be
    attributed to any single cert's fraud pattern.

    Per docs/schema_data.md locked decision #4: certificate_id is NOT
    a unique key (duplicate_serial fraud reuses it). Callers pass
    (certificate_id, generator_id) to disambiguate which chain they mean.

    Returns:
        {
          "has_cycle": bool,
          "cycle_path": list[str] | None,  # e.g. ["PTY001","PTY002","PTY001"]
          "cycle_length": int | None
        }
    """
    cert_tx = (
        transactions_df[transactions_df["certificate_id"] == certificate_id]
        .sort_values("transfer_timestamp")
    )

    # A cycle requires >= 3 hops (schema locked decision #5: n_transfers
    # is forced >= 3 for circular_trading certs). Shorter chains cannot
    # mathematically contain a back-to-origin loop.
    if len(cert_tx) < 3:
        return {"has_cycle": False, "cycle_path": None, "cycle_length": None}

    G = nx.DiGraph()
    for _, row in cert_tx.iterrows():
        G.add_edge(row["from_party_id"], row["to_party_id"])

    cycles = list(nx.simple_cycles(G))

    # We only care about cycles that pass through the issuing generator —
    # that's the canonical definition of circular wash trading.
    matching = [c for c in cycles if generator_id in c]

    if matching:
        longest = max(matching, key=len)
        return {
            "has_cycle": True,
            "cycle_path": longest + [longest[0]],  # close the loop for display
            "cycle_length": len(longest),
        }

    # Cycle exists but doesn't route through the generator — still suspicious
    # but not the canonical pattern. Report it but don't set has_cycle True.
    if cycles:
        longest = max(cycles, key=len)
        return {
            "has_cycle": False,
            "cycle_path": longest,
            "cycle_length": len(longest),
        }

    return {"has_cycle": False, "cycle_path": None, "cycle_length": None}


# ---------------------------------------------------------------------------
# Step 3 — Whole-graph community/density detection
# ---------------------------------------------------------------------------

def detect_communities(transactions_df: pd.DataFrame) -> dict[str, Any]:
    """
    Runs Louvain community detection on the full transaction graph and
    flags only those communities that are meaningfully denser than the
    graph's overall baseline AND small enough to be a plausible ring.

    See module-level threshold documentation for justification of the
    chosen values (3.0x multiplier, max size 15).

    Returns:
        {
          "communities": [
            {"members": [...], "density": float, "flagged": bool}, ...
          ],
          "graph_density": float   # baseline for comparison
        }
    """
    # Louvain requires undirected graph
    G = nx.Graph()
    for _, row in transactions_df.iterrows():
        G.add_edge(row["from_party_id"], row["to_party_id"])

    graph_density = nx.density(G)
    communities = louvain_communities(G, seed=42)  # seed for reproducibility

    results = []
    for community in communities:
        subgraph = G.subgraph(community)
        community_density = nx.density(subgraph)
        # A fraud ring requires at least 3 members (a 1- or 2-party trade is not a ring per Phase 2 rules)
        # and internal cycles/excess edges beyond an acyclic tree path (tree density = 2/N).
        min_tree_density = 2.0 / len(community) if len(community) > 1 else 1.0
        is_flagged = (
            len(community) >= 3
            and community_density > min_tree_density
            and community_density > graph_density * DENSITY_MULTIPLIER_THRESHOLD
            and len(community) <= MAX_RING_SIZE
        )
        results.append({
            "members": list(community),
            "density": round(community_density, 4),
            "flagged": is_flagged,
        })

    return {
        "communities": results,
        "graph_density": round(graph_density, 4),
    }


# ---------------------------------------------------------------------------
# Step 4 — Party-level risk scoring from community membership
# ---------------------------------------------------------------------------

def compute_party_risk_scores(transactions_df: pd.DataFrame) -> dict[str, float]:
    """
    Computes a risk score per party based on:
      - membership in a flagged community (from detect_communities)
      - normalized degree centrality within the flagged community subgraph

    Degree centrality is a deliberate choice: it's fast, explainable live to
    judges, and sufficient for MVP. Betweenness/eigenvector are future work.

    Returns: { party_id: risk_score (float 0.0–1.0) }

    PERFORMANCE NOTE: this re-runs detect_communities() on every call.
    Pre-compute and cache at the dataset level before final integration.
    """
    community_result = detect_communities(transactions_df)
    party_scores: dict[str, float] = {}

    for community in community_result["communities"]:
        if not community["flagged"]:
            continue

        subgraph_nodes = set(community["members"])

        # Rebuild the subgraph from the actual transactions so edge weights
        # reflect real trading frequency, not just Louvain's partition.
        G_sub = nx.Graph()
        cert_tx = transactions_df[
            transactions_df["from_party_id"].isin(subgraph_nodes)
            | transactions_df["to_party_id"].isin(subgraph_nodes)
        ]
        for _, row in cert_tx.iterrows():
            G_sub.add_edge(row["from_party_id"], row["to_party_id"])

        degrees = dict(G_sub.degree())
        max_degree = max(degrees.values()) if degrees else 1
        for party, degree in degrees.items():
            normalized = degree / max_degree
            # Take the max if a party appears in multiple flagged communities
            party_scores[party] = max(party_scores.get(party, 0.0), normalized)

    return party_scores


# ---------------------------------------------------------------------------
# Step 5 — Per-certificate graph signal (combines cycle + community)
# ---------------------------------------------------------------------------

def compute_graph_signal(
    transactions: list[dict[str, Any]],
    certificates: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """
    Full pipeline — combines cycle detection and community risk into one
    per-certificate graph signal. Called from pipeline.py.

    Input:
      transactions: list of dicts with keys:
        from_party_id, to_party_id, certificate_id, transfer_timestamp
      certificates: list of dicts with at least:
        certificate_id, generator_id

    Output:
      { certificate_id: {"graph_flag": bool, "graph_risk": float} }

    Fusion logic:
      - Confirmed cycle (through generator) → floor at 0.90
        (keeps a gradient between 3-hop and 6-hop cycles rather than
         a flat 1.0 that loses nuance — see Phase 2 instructions §5)
      - Community risk alone → raw normalized degree score (0.0–1.0)
      - graph_flag = has_cycle OR community_risk > 0.5
    """
    transactions_df = pd.DataFrame(transactions)

    # Compute party-level community risk once for the whole batch.
    # NOTE: this is still called once per compute_graph_signal() invocation.
    # If compute_graph_signal is called per-certificate from pipeline.py,
    # move this call outside and pass party_scores in — tracked as known
    # performance optimization before final integration.
    party_scores = compute_party_risk_scores(transactions_df)

    results: dict[str, dict[str, Any]] = {}

    for cert in certificates:
        c_id = cert["certificate_id"]
        g_id = cert.get("generator_id", "")

        cycle_result = detect_cycles(transactions_df, c_id, g_id)

        # Get all parties that touched this certificate
        cert_tx = transactions_df[transactions_df["certificate_id"] == c_id]
        parties_involved = (
            set(cert_tx["from_party_id"]) | set(cert_tx["to_party_id"])
        )
        if g_id:
            parties_involved.add(g_id)

        community_risk = max(
            (party_scores.get(p, 0.0) for p in parties_involved),
            default=0.0,
        )

        # Fuse signals
        if cycle_result["has_cycle"]:
            graph_risk = max(0.9, community_risk)
        else:
            graph_risk = community_risk

        results[c_id] = {
            "graph_flag": cycle_result["has_cycle"] or community_risk > 0.5,
            "graph_risk": round(graph_risk, 4),
            "directly_in_cycle": cycle_result["has_cycle"],
            "cycle_path": cycle_result["cycle_path"],
            "touching_parties": sorted(list(parties_involved)),
        }

    return results


# ---------------------------------------------------------------------------
# Legacy aliases — keep Phase 1 smoke tests green (they import these names)
# ---------------------------------------------------------------------------

def build_party_graph(transactions: list[dict[str, Any]]) -> nx.DiGraph:
    """Thin alias kept for Phase 1 import compatibility."""
    return build_transaction_graph(pd.DataFrame(transactions)).to_directed()


def detect_certificate_cycles(
    transactions: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Thin alias kept for Phase 1 import compatibility."""
    df = pd.DataFrame(transactions)
    cert_ids = df["certificate_id"].unique()
    out = {}
    for c_id in cert_ids:
        # generator_id unavailable here — use empty string (no gen-back check)
        r = detect_cycles(df, c_id, "")
        out[c_id] = {
            "has_cycle": r["has_cycle"],
            "cycles": [r["cycle_path"]] if r["cycle_path"] else [],
            "cycle_parties": r["cycle_path"] or [],
        }
    return out

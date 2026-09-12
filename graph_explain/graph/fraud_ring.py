"""
Trading-graph fraud-ring detection for REC Fraud Detection System (Role 2).
Uses NetworkX cycle detection and Louvain community detection.
Evaluates both per-certificate transfer loops and multi-certificate party collusion rings.
"""

from typing import List, Dict, Any, Tuple, Set
import networkx as nx
from networkx.algorithms.community import louvain_communities

def detect_certificate_cycles(transactions: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Detects directed circular transfer loops per certificate.
    Fast, deterministic O(V+E) cycle detection per certificate lineage.
    """
    cert_txns: Dict[str, List[Dict[str, Any]]] = {}
    for tx in transactions:
        c_id = tx["certificate_id"]
        if c_id not in cert_txns:
            cert_txns[c_id] = []
        cert_txns[c_id].append(tx)

    cert_cycles = {}
    for c_id, tx_list in cert_txns.items():
        g = nx.DiGraph()
        for tx in tx_list:
            g.add_edge(tx["from_party_id"], tx["to_party_id"])

        try:
            cycles = list(nx.simple_cycles(g))
        except Exception:
            cycles = []

        if cycles:
            # Flatten parties in cycle
            cycle_nodes = set()
            for cyc in cycles:
                cycle_nodes.update(cyc)
            cert_cycles[c_id] = {
                "has_cycle": True,
                "cycles": cycles,
                "cycle_parties": list(cycle_nodes)
            }
        else:
            cert_cycles[c_id] = {
                "has_cycle": False,
                "cycles": [],
                "cycle_parties": []
            }

    return cert_cycles

def build_party_graph(transactions: List[Dict[str, Any]]) -> nx.DiGraph:
    """
    Builds the aggregated inter-party trading network.
    """
    G = nx.DiGraph()
    for tx in transactions:
        u = tx["from_party_id"]
        v = tx["to_party_id"]
        c_id = tx["certificate_id"]

        if G.has_edge(u, v):
            G[u][v]["weight"] += 1
            G[u][v]["certificates"].append(c_id)
        else:
            G.add_edge(u, v, weight=1, certificates=[c_id])
    return G

def detect_suspicious_communities(
    G: nx.DiGraph,
    density_threshold: float = 0.5,
    min_size: int = 3
) -> Tuple[List[Set[str]], Dict[str, float]]:
    """
    Uses Louvain community detection to identify tightly knit trading clusters.
    Rule 8: In clean REC markets, trading graphs are sparse (<0.3 density).
    Dense subgraphs (>=0.5) indicate potential collusion rings.
    """
    if len(G) < min_size:
        return [], {}

    U = G.to_undirected()
    try:
        communities = louvain_communities(U, seed=42)
    except Exception:
        return [], {}

    baseline_density = nx.density(U)
    suspicious_comms = []
    party_cluster_scores: Dict[str, float] = {}

    for comm in communities:
        if len(comm) >= min_size:
            subgraph = U.subgraph(comm)
            comm_density = nx.density(subgraph)

            if comm_density >= density_threshold or (baseline_density > 0 and comm_density >= 2.0 * baseline_density):
                suspicious_comms.append(comm)
                for node in comm:
                    deg = subgraph.degree(node) / (len(comm) - 1)
                    party_cluster_scores[node] = round(min(0.35, 0.15 + (0.2 * deg)), 3)

    return suspicious_comms, party_cluster_scores

def compute_party_risk_scores(
    G: nx.DiGraph,
    cert_cycle_data: Dict[str, Dict[str, Any]],
    party_cluster_scores: Dict[str, float],
    party_total_txns: Dict[str, int]
) -> Dict[str, Dict[str, Any]]:
    """
    Computes party-level risk scores according to Rule 7.
    Weights cycle involvement against total transaction volume (involvement rate)
    to differentiate genuine collusive rings from high-volume market makers.
    """
    party_cycle_counts: Dict[str, int] = {}
    for c_id, c_data in cert_cycle_data.items():
        if c_data["has_cycle"]:
            for p in c_data["cycle_parties"]:
                party_cycle_counts[p] = party_cycle_counts.get(p, 0) + 1

    party_scores = {}
    for node in G.nodes():
        risk = 0.0
        cycle_count = party_cycle_counts.get(node, 0)
        total_txns = max(1, party_total_txns.get(node, 1))
        involvement_rate = cycle_count / total_txns

        # Collusive ring identification: high ratio of cyclic wash trading
        if cycle_count >= 2 and involvement_rate >= 0.12:
            risk += 0.60 + min(0.30, involvement_rate * 0.5)
        elif cycle_count >= 1:
            # Low rate / incidental counterparty overlap
            risk += min(0.25, involvement_rate * 2.0)

        if node in party_cluster_scores:
            risk += party_cluster_scores[node]

        final_risk = min(1.0, round(risk, 3))
        party_scores[node] = {
            "party_id": node,
            "party_risk": final_risk,
            "cycle_count": cycle_count,
            "involvement_rate": round(involvement_rate, 4),
            "in_suspicious_cluster": node in party_cluster_scores
        }

    return party_scores

def compute_graph_signal(
    transactions: List[Dict[str, Any]],
    certificates: List[Dict[str, Any]],
    density_threshold: float = 0.5
) -> Dict[str, Dict[str, Any]]:
    """
    Full pipeline for graph signal analysis (Role 2):
    1. Detects certificate-specific circular trades (NetworkX simple_cycles per lineage)
    2. Builds global party network & identifies Louvain dense clusters
    3. Scores party-level collusion & wash-trade centrality (Rule 7)
    4. Rolls up party risk to certificate-level graph_risk and graph_flag
    
    Returns:
        Mapping of certificate_id -> {
            "certificate_id": str,
            "graph_flag": bool,
            "graph_risk": float,
            "directly_in_cycle": bool,
            "touching_parties": list,
            "summary": str
        }
    """
    cert_cycle_data = detect_certificate_cycles(transactions)
    G = build_party_graph(transactions)
    suspicious_comms, party_cluster_scores = detect_suspicious_communities(
        G, density_threshold=density_threshold
    )

    # Compute total transactions per party
    party_total_txns: Dict[str, int] = {}
    for tx in transactions:
        u, v = tx["from_party_id"], tx["to_party_id"]
        party_total_txns[u] = party_total_txns.get(u, 0) + 1
        party_total_txns[v] = party_total_txns.get(v, 0) + 1

    party_scores = compute_party_risk_scores(G, cert_cycle_data, party_cluster_scores, party_total_txns)

    # Map certificate to all touching parties
    cert_to_parties: Dict[str, Set[str]] = {}
    for tx in transactions:
        c_id = tx["certificate_id"]
        if c_id not in cert_to_parties:
            cert_to_parties[c_id] = set()
        cert_to_parties[c_id].add(tx["from_party_id"])
        cert_to_parties[c_id].add(tx["to_party_id"])

    # Generator lookup map if available
    gen_map = {c["certificate_id"]: c.get("generator_id") for c in certificates if "generator_id" in c}

    results = {}
    for cert in certificates:
        c_id = cert["certificate_id"]
        touching = cert_to_parties.get(c_id, set())

        gid = gen_map.get(c_id, cert.get("generator_id"))
        if gid:
            touching.add(gid)

        # Max risk among touching parties
        touching_risks = [
            party_scores[p]["party_risk"]
            for p in touching
            if p in party_scores
        ]
        max_party_risk = max(touching_risks) if touching_risks else 0.0
        c_cycle_info = cert_cycle_data.get(c_id, {"has_cycle": False, "cycles": []})
        directly_in_cycle = c_cycle_info["has_cycle"]

        # Check if the cycle specifically loops back to the generator (classic wash trade)
        loop_back_to_gen = False
        multi_hop_ring = False
        if directly_in_cycle:
            for cyc in c_cycle_info["cycles"]:
                if gid and gid in cyc:
                    loop_back_to_gen = True
                    break
                elif len(cyc) >= 3 and max_party_risk >= 0.80:
                    multi_hop_ring = True
                    break

        if loop_back_to_gen:
            cert_risk = 1.0
            cert_flag = True
            summary = f"Circular wash trading detected: certificate {c_id} circulated back to issuing generator ({gid}) through a closed loop."
        elif multi_hop_ring:
            cert_risk = max(0.85, max_party_risk)
            cert_flag = True
            summary = f"Multi-party collusive trading ring detected among high-risk entities ({', '.join(touching)}) for certificate {c_id}."
        else:
            cert_risk = min(0.35, max_party_risk)
            cert_flag = False
            summary = "Trading graph pattern appears normal and linear."

        results[c_id] = {
            "certificate_id": c_id,
            "graph_flag": cert_flag,
            "graph_risk": round(cert_risk, 3),
            "directly_in_cycle": directly_in_cycle,
            "touching_parties": list(touching),
            "summary": summary
        }

    return results

"""
Trading-graph fraud-ring detection for REC Fraud Detection System (Role 2).
Uses NetworkX cycle detection (simple_cycles) and Louvain community detection.
"""

from typing import List, Dict, Any, Tuple, Set
import networkx as nx
from networkx.algorithms.community import louvain_communities

def build_trading_graph(transactions: List[Dict[str, Any]]) -> nx.DiGraph:
    """
    Builds a directed graph from transaction records.
    Nodes are party IDs.
    Edges represent certificate transfers with metadata.
    """
    G = nx.DiGraph()
    for tx in transactions:
        from_p = tx["from_party_id"]
        to_p = tx["to_party_id"]
        cert_id = tx["certificate_id"]
        timestamp = tx.get("transfer_timestamp")

        if not G.has_node(from_p):
            G.add_node(from_p)
        if not G.has_node(to_p):
            G.add_node(to_p)

        # Store transfer details on edge
        if G.has_edge(from_p, to_p):
            G[from_p][to_p]["certificates"].append(cert_id)
            G[from_p][to_p]["transactions"].append(tx)
        else:
            G.add_edge(
                from_p,
                to_p,
                certificates=[cert_id],
                transactions=[tx]
            )
    return G

def detect_cycles(G: nx.DiGraph) -> Tuple[List[List[str]], Set[str], Set[str]]:
    """
    Detects circular trading rings using networkx simple_cycles.
    
    Returns:
        cycles: List of cycles (each cycle is a list of node IDs)
        cycle_parties: Set of party IDs participating in any cycle
        cycle_certificates: Set of certificate IDs passed along cyclic edges
    """
    try:
        cycles = list(nx.simple_cycles(G))
    except Exception:
        cycles = []

    cycle_parties: Set[str] = set()
    cycle_certificates: Set[str] = set()

    for cycle in cycles:
        cycle_len = len(cycle)
        for i in range(cycle_len):
            u = cycle[i]
            v = cycle[(i + 1) % cycle_len]
            cycle_parties.add(u)
            if G.has_edge(u, v):
                for cert in G[u][v].get("certificates", []):
                    cycle_certificates.add(cert)

    return cycles, cycle_parties, cycle_certificates

def detect_suspicious_communities(
    G: nx.DiGraph,
    density_threshold: float = 0.6,
    min_size: int = 3
) -> Tuple[List[Set[str]], Dict[str, float]]:
    """
    Uses Louvain community detection to find tightly knit trading clusters.
    
    Threshold Rationale (Rule 8):
    In a clean REC market, the trading graph is predominantly acyclic and bipartite
    (Generators -> Traders -> Utilities), resulting in sparse induced subgraphs (<0.3).
    A cluster with internal density >= 0.6 and size >= 3 strongly indicates collusion
    or artificial liquidity wash-trading among affiliated entities.
    
    Returns:
        suspicious_communities: List of sets of party IDs forming suspicious clusters
        party_cluster_scores: Mapping of party_id to community-derived risk increment
    """
    if len(G) < min_size:
        return [], {}

    U = G.to_undirected()
    communities = louvain_communities(U, seed=42)

    baseline_density = nx.density(U)
    suspicious_communities = []
    party_cluster_scores: Dict[str, float] = {}

    for comm in communities:
        if len(comm) >= min_size:
            subgraph = U.subgraph(comm)
            comm_density = nx.density(subgraph)

            # Flag if community density exceeds threshold and significantly exceeds baseline
            if comm_density >= density_threshold or (baseline_density > 0 and comm_density >= 2.0 * baseline_density):
                suspicious_communities.append(comm)
                for node in comm:
                    degree_centrality = subgraph.degree(node) / (len(comm) - 1)
                    # Score contribution based on density and internal connectivity
                    party_cluster_scores[node] = round(min(0.4, 0.2 + (0.2 * degree_centrality)), 3)

    return suspicious_communities, party_cluster_scores

def compute_party_risk_scores(
    G: nx.DiGraph,
    cycles: List[List[str]],
    cycle_parties: Set[str],
    party_cluster_scores: Dict[str, float]
) -> Dict[str, Dict[str, Any]]:
    """
    Computes party-level risk scores according to Rule 7.
    Parties involved in cycles or high-density clusters receive higher scores.
    """
    party_scores = {}

    # Count cycle participations per party
    party_cycle_counts: Dict[str, int] = {}
    for cycle in cycles:
        for node in cycle:
            party_cycle_counts[node] = party_cycle_counts.get(node, 0) + 1

    for node in G.nodes():
        risk = 0.0
        in_cycle = node in cycle_parties
        in_suspicious_cluster = node in party_cluster_scores

        if in_cycle:
            # Base cycle risk is high (0.6) + increment for multiple cycles
            cycle_cnt = party_cycle_counts.get(node, 1)
            risk += 0.6 + min(0.3, 0.1 * (cycle_cnt - 1))

        if in_suspicious_cluster:
            risk += party_cluster_scores[node]

        # Normalize risk to [0.0, 1.0]
        final_risk = min(1.0, round(risk, 3))
        party_scores[node] = {
            "party_id": node,
            "party_risk": final_risk,
            "in_cycle": in_cycle,
            "cycle_count": party_cycle_counts.get(node, 0),
            "in_suspicious_cluster": in_suspicious_cluster
        }

    return party_scores

def compute_graph_signal(
    transactions: List[Dict[str, Any]],
    certificates: List[Dict[str, Any]],
    density_threshold: float = 0.6
) -> Dict[str, Dict[str, Any]]:
    """
    Full pipeline for graph signal analysis:
    1. Builds directed graph
    2. Runs cycle detection (networkx simple_cycles)
    3. Runs Louvain community detection
    4. Evaluates party-level risk (Rule 7)
    5. Rolls up party risk to certificate-level graph_risk and graph_flag
    
    Returns:
        Mapping of certificate_id -> {
            "graph_flag": bool,
            "graph_risk": float,
            "cycles_detected": list,
            "parties_involved": list,
            "summary": str
        }
    """
    G = build_trading_graph(transactions)
    cycles, cycle_parties, cycle_certificates = detect_cycles(G)
    suspicious_comms, party_cluster_scores = detect_suspicious_communities(
        G, density_threshold=density_threshold
    )
    party_scores = compute_party_risk_scores(G, cycles, cycle_parties, party_cluster_scores)

    # Map certificates to touching parties
    cert_to_parties: Dict[str, Set[str]] = {}
    for tx in transactions:
        c_id = tx["certificate_id"]
        if c_id not in cert_to_parties:
            cert_to_parties[c_id] = set()
        cert_to_parties[c_id].add(tx["from_party_id"])
        cert_to_parties[c_id].add(tx["to_party_id"])

    results = {}
    for cert in certificates:
        c_id = cert["certificate_id"]
        touching_parties = cert_to_parties.get(c_id, set())
        
        # Include generator party if present
        if "generator_id" in cert:
            touching_parties.add(cert["generator_id"])

        # Collect risk of all parties associated with this certificate
        touching_risks = [
            party_scores[p]["party_risk"]
            for p in touching_parties
            if p in party_scores
        ]

        max_party_risk = max(touching_risks) if touching_risks else 0.0
        directly_in_cycle = c_id in cycle_certificates

        # Roll up to certificate risk
        if directly_in_cycle:
            cert_risk = max(0.85, max_party_risk)
            cert_flag = True
            summary = f"Circular trading ring detected directly transferring certificate {c_id} across cyclic loop."
        elif max_party_risk >= 0.5:
            cert_risk = max_party_risk
            cert_flag = True
            summary = f"High-risk party involvement ({', '.join(touching_parties)}) in trading ring or dense cluster."
        else:
            cert_risk = max_party_risk
            cert_flag = False
            summary = "Trading graph pattern appears normal and linear."

        results[c_id] = {
            "certificate_id": c_id,
            "graph_flag": cert_flag,
            "graph_risk": round(cert_risk, 3),
            "directly_in_cycle": directly_in_cycle,
            "touching_parties": list(touching_parties),
            "summary": summary
        }

    return results

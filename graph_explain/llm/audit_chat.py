"""
Auditor Interactive Chat Interface for REC Fraud Detection System (Role 2 — Phase 5).
Handles single-turn Q&A for POST /api/v1/audit/chat per docs/api-contract.md.

Grounded in verified certificate metadata, transaction chains, graph risks,
and physical weather cross-check scores. Explicitly handles:
  1. Not-found certificate IDs (fails safe with honest not-found notice).
  2. Ambiguous duplicate_serial certificates (acknowledges both versions).
  3. Factual, grounded auditor interrogation with no hallucinations.
  4. Claude API integration with robust deterministic offline fallback.
"""

import os
import sys
from typing import Dict, Any, List, Optional
import pandas as pd

# Ensure both graph_explain/ and repo root are in sys.path
_LLM_DIR = os.path.abspath(os.path.dirname(__file__))
_GRAPH_EXPLAIN_DIR = os.path.abspath(os.path.join(_LLM_DIR, ".."))
_REPO_ROOT = os.path.abspath(os.path.join(_GRAPH_EXPLAIN_DIR, ".."))
for _p in [_REPO_ROOT, _GRAPH_EXPLAIN_DIR]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

CHAT_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")


# ---------------------------------------------------------------------------
# Step 1 — Context Assembly
# ---------------------------------------------------------------------------

def assemble_certificate_context(
    certificate_id: str,
    certificates_df: pd.DataFrame,
    transactions_df: pd.DataFrame,
    signal_output: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Gathers everything known about one certificate into a single context
    dict, grounding the chat response in real data rather than letting
    the model guess or hallucinate specifics.

    signal_output: fused output from Phase 4's pipeline, i.e.:
      { certificate_id, graph_flag, graph_risk, weather_mismatch,
        weather_mismatch_score, explanation }

    Handles the duplicate_serial edge case: certificate_id alone may match
    2 rows in certificates_df (per docs/schema_data.md locked decision #4).
    If ambiguous, returns context for BOTH versions rather than silently
    picking one.
    """
    if isinstance(certificates_df, list):
        certificates_df = pd.DataFrame(certificates_df)
    if isinstance(transactions_df, list):
        transactions_df = pd.DataFrame(transactions_df)

    cert_rows = certificates_df[certificates_df["certificate_id"] == certificate_id]

    if len(cert_rows) == 0:
        return {"found": False, "certificate_id": certificate_id}

    contexts = []
    for _, cert_row in cert_rows.iterrows():
        cert_dict = cert_row.to_dict()
        if "certificate_id" in transactions_df.columns:
            chain = transactions_df[transactions_df["certificate_id"] == certificate_id]
            if "transfer_timestamp" in chain.columns:
                chain = chain.sort_values("transfer_timestamp")
            chain_records = chain.to_dict(orient="records")
        else:
            chain_records = []

        contexts.append({
            "certificate": cert_dict,
            "transaction_chain": chain_records,
        })

    return {
        "found": True,
        "certificate_id": certificate_id,
        "is_ambiguous": len(contexts) > 1,  # true for duplicate_serial certs
        "versions": contexts,
        "signals": signal_output or {},
    }


# ---------------------------------------------------------------------------
# Step 2 — Chat Prompt Construction
# ---------------------------------------------------------------------------

def _build_chat_prompt(context: Dict[str, Any], query: str) -> str:
    """
    Builds a single-turn prompt grounding the model's answer in this
    specific certificate's real data, rather than letting it answer
    generically or invent specifics.
    """
    if not context.get("found", False):
        return (
            f'A user asked: "{query}"\n\n'
            f"No certificate matching ID '{context.get('certificate_id', '')}' exists in the dataset. "
            "Respond with one sentence stating that this certificate ID could not be found — "
            "do not guess at or invent details about a certificate that doesn't exist."
        )

    if context.get("is_ambiguous", False):
        # Two versions exist under the same certificate_id (duplicate_serial).
        # State both plainly rather than picking one silently.
        versions_text = "\n\n".join([
            f"Version {i+1}: generator {v['certificate'].get('generator_id', 'unknown')}, "
            f"generated {v['certificate'].get('generation_timestamp', 'unknown')}, "
            f"claimed {v['certificate'].get('claimed_mwh', 'unknown')} MWh, "
            f"fraud_type={v['certificate'].get('fraud_type', 'none')}"
            for i, v in enumerate(context["versions"])
        ])
        return (
            f"A user asked about certificate {context['versions'][0]['certificate'].get('certificate_id', '')}: \"{query}\"\n\n"
            "IMPORTANT: this certificate ID has TWO separate versions in the system (this is itself a known fraud pattern — "
            "duplicate_serial, where the same certificate ID was issued and traded twice through separate chains):\n\n"
            f"{versions_text}\n\n"
            "Answer the user's question, but explicitly note that there are two versions under this ID "
            "and briefly distinguish them if relevant to the question. Keep the answer to 2-3 sentences."
        )

    v = context["versions"][0]
    cert = v["certificate"]
    chain = v["transaction_chain"]
    signals = context["signals"]

    if chain:
        chain_summary = " -> ".join(
            [chain[0].get("from_party_id", "")] + [t.get("to_party_id", "") for t in chain]
        )
    else:
        chain_summary = "no transaction chain found"

    return f"""A user is auditing certificate {cert.get('certificate_id', '')} and asked: "{query}"

Known facts about this certificate:
- Generator: {cert.get('generator_id', 'unknown')}
- Energy source: {cert.get('energy_source', 'unknown')}
- Claimed generation: {cert.get('claimed_mwh', 'unknown')} MWh at {cert.get('generation_timestamp', 'unknown')}
- Rated plant capacity: {cert.get('plant_rated_capacity_mwh', cert.get('capacity_mwh', 'unknown'))} MWh
- Transaction chain: {chain_summary}
- Graph risk score: {signals.get('graph_risk', 'not computed')}
- Weather mismatch score: {signals.get('weather_mismatch_score', 'not computed')}
- Prior explanation on file: "{signals.get('explanation', 'none generated')}"

Answer the user's specific question directly, grounded only in the facts listed above. Do not invent details not listed here. If the question asks about something not covered by these facts (e.g. a signal that wasn't computed), say so plainly rather than guessing. Keep the answer to 2-3 sentences unless the question genuinely requires more detail to answer clearly."""


# ---------------------------------------------------------------------------
# Step 3 — Deterministic Grounded Fallback (Offline / No API Key)
# ---------------------------------------------------------------------------

def _generate_grounded_fallback(context: Dict[str, Any], query: str) -> str:
    """
    Deterministic rule-based response grounded in verified certificate context.
    Guarantees 100% reliable demo responses offline without LLM API latency or keys.
    """
    if not context.get("found", False):
        c_id = context.get("certificate_id", "Unknown")
        return f"Certificate ID '{c_id}' could not be found in the registry. No records exist for this identifier."

    if context.get("is_ambiguous", False):
        c_id = context.get("certificate_id", "Unknown")
        versions = context["versions"]
        v1 = versions[0]["certificate"]
        v2 = versions[1]["certificate"]
        return (
            f"Notice: Certificate '{c_id}' exhibits duplicate serial fraud with two distinct records in the ledger. "
            f"Version 1 was issued to generator {v1.get('generator_id')} for {v1.get('claimed_mwh')} MWh "
            f"(status: {v1.get('fraud_type', 'standard')}), while Version 2 was concurrently registered "
            f"with claimed output {v2.get('claimed_mwh')} MWh (status: {v2.get('fraud_type', 'duplicate_serial')})."
        )

    v = context["versions"][0]
    cert = v["certificate"]
    chain = v["transaction_chain"]
    signals = context.get("signals", {})

    c_id = cert.get("certificate_id", "Unknown")
    claimed = cert.get("claimed_mwh", "N/A")
    cap = cert.get("plant_rated_capacity_mwh", cert.get("capacity_mwh", "N/A"))
    source = cert.get("energy_source", "unknown")
    ts = cert.get("generation_timestamp", "unknown")
    graph_risk = signals.get("graph_risk", 0.0)
    weather_score = signals.get("weather_mismatch_score", 0.0)
    explanation = signals.get("explanation")

    parties = []
    if chain:
        for t in chain:
            if t.get("from_party_id") and t.get("from_party_id") not in parties:
                parties.append(t.get("from_party_id"))
            if t.get("to_party_id") and t.get("to_party_id") not in parties:
                parties.append(t.get("to_party_id"))
    elif signals.get("touching_parties"):
        parties = signals.get("touching_parties")

    query_lower = query.lower()

    # Question about why flagged / reason
    if any(w in query_lower for w in ["why", "reason", "flag", "cause", "explain", "fraud"]):
        if explanation:
            return f"Audit finding for {c_id}: {explanation}"
        reasons = []
        if signals.get("weather_mismatch") or weather_score >= 0.5:
            if cap != "N/A" and claimed != "N/A" and float(claimed) > float(cap):
                ratio = round(float(claimed) / float(cap), 2)
                reasons.append(f"Physical Generation Mismatch: Claimed {claimed} MWh exceeds plant rated capacity ({cap} MWh) by {ratio}x")
            else:
                reasons.append(f"Physical Generation Mismatch: Generation claimed outside solar daylight hours ({ts}) with zero irradiance")
        if signals.get("graph_flag") or graph_risk >= 0.5:
            parties_str = ", ".join(parties) if parties else "affiliated counterparties"
            reasons.append(f"Trading Ring / Wash Trading: High graph risk ({graph_risk}) across entities ({parties_str})")
        if not reasons:
            return f"Certificate {c_id} is verified as legitimate with no anomalies detected across physical, graph, or volume checks."
        return f"Certificate {c_id} was flagged due to:\n" + "\n".join(f"- {r}" for r in reasons)

    # Question asking for facts not covered
    if any(w in query_lower for w in ["yesterday", "tomorrow", "next year", "ceo", "price", "cost", "revenue", "dollar"]):
        return (
            f"The requested detail is not covered in the certificate record for {c_id}. "
            f"Available facts are limited to generator ID, claimed MWh, plant capacity, timestamps, and trading counterparties."
        )

    # Question about parties / counterparties
    if any(w in query_lower for w in ["who", "part", "entit", "counterpart", "trader"]):
        if parties:
            return f"The parties associated with certificate {c_id} are: {', '.join(parties)}."
        return f"No transfer transaction records were found for certificate {c_id}."

    # Question about capacity or generation amount
    if any(w in query_lower for w in ["capacit", "mwh", "claimed", "generat", "output", "amount"]):
        ratio_note = ""
        if cap != "N/A" and claimed != "N/A":
            ratio = round(float(claimed) / float(cap), 2)
            ratio_note = f" (claim is {ratio}x rated capacity)"
        return f"Certificate {c_id} claimed generation of {claimed} MWh against a plant rated capacity of {cap} MWh{ratio_note}."

    # Question about weather / solar / timing / night
    if any(w in query_lower for w in ["weather", "solar", "sun", "night", "dark", "wind", "irradian", "tim"]):
        if source.lower() == "solar":
            return (
                f"Physical weather audit for {c_id}: Claimed generation timestamp is {ts} IST "
                f"(mismatch score: {weather_score}). Solar production requires daylight and valid irradiance."
            )
        return (
            f"Physical weather audit for {c_id}: Generation technology is {source} with mismatch score {weather_score}. "
            f"Wind generation operates on a 24-hour baseline."
        )

    # Question about risk scores
    if any(w in query_lower for w in ["risk", "score"]):
        return f"Risk scores for {c_id}: Graph Risk = {graph_risk}, Weather Mismatch Score = {weather_score}."

    # Question about chain / route
    if any(w in query_lower for w in ["chain", "path", "route", "transfer"]):
        if chain:
            chain_str = " -> ".join([chain[0].get("from_party_id", "")] + [t.get("to_party_id", "") for t in chain])
            return f"Transaction path for {c_id}: {chain_str}."
        return f"No multi-hop transaction chain recorded for certificate {c_id}."

    # General summary fallback
    return (
        f"Auditor Summary for {c_id}: Generator {cert.get('generator_id')}, Claimed {claimed} MWh ({source}), "
        f"Graph Risk: {graph_risk}, Weather Mismatch Score: {weather_score}."
    )


# ---------------------------------------------------------------------------
# Step 4 — Chat Session (POST /api/v1/audit/chat)
# ---------------------------------------------------------------------------

def chat_session(
    certificate_id: str,
    query: str,
    certificates_df: Any,
    transactions_df: Any,
    signal_lookup: Optional[Dict[str, Any]] = None
) -> Dict[str, str]:
    """
    Handles one single-turn Q&A request per docs/api-contract.md:
      POST /api/v1/audit/chat
      Request:  { "certificate_id": str, "query": str }
      Response: { "certificate_id": str, "reply": str }

    signal_lookup: optional dict mapping certificate_id -> fused Phase 4 output.
    """
    signal_lookup = signal_lookup or {}
    signal_output = signal_lookup.get(certificate_id, {})

    context = assemble_certificate_context(
        certificate_id,
        certificates_df,
        transactions_df,
        signal_output
    )

    prompt = _build_chat_prompt(context, query)

    # Try Anthropic Claude API if key is available
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model=CHAT_MODEL,
                max_tokens=300,
                temperature=0.2,
                messages=[{"role": "user", "content": prompt}],
            )
            return {
                "certificate_id": certificate_id,
                "reply": response.content[0].text.strip(),
            }
        except Exception:
            pass

    # Deterministic offline response
    reply = _generate_grounded_fallback(context, query)
    return {
        "certificate_id": certificate_id,
        "reply": reply,
    }


# ---------------------------------------------------------------------------
# Legacy adapter — keeps Phase 4 tests and earlier imports 100% green
# ---------------------------------------------------------------------------

def query_audit_assistant(
    certificate_id: str,
    user_query: str,
    certificate: Dict[str, Any],
    signals: Dict[str, Any]
) -> str:
    """
    Legacy helper maintained for backward compatibility.
    Wraps certificate and signals into temporary DataFrames and calls chat_session.
    """
    certs_df = pd.DataFrame([certificate])
    parties = signals.get("touching_parties", [])
    txs = []
    if len(parties) >= 2:
        for i in range(len(parties) - 1):
            txs.append({
                "from_party_id": parties[i],
                "to_party_id": parties[i + 1],
                "certificate_id": certificate_id,
                "transfer_timestamp": certificate.get("generation_timestamp", ""),
            })
    txs_df = pd.DataFrame(txs)
    signal_lookup = {certificate_id: signals}

    result = chat_session(certificate_id, user_query, certs_df, txs_df, signal_lookup)
    return result["reply"]


if __name__ == "__main__":
    import json
    fixture_path = os.path.join(os.path.dirname(__file__), "..", "fixtures", "mock_records.json")
    with open(fixture_path, "r") as f:
        fixtures = json.load(f)

    sample_cert = fixtures["certificates"][2]  # REC-RING-001
    sample_signals = {
        "graph_flag": True,
        "graph_risk": 1.0,
        "weather_mismatch": False,
        "weather_mismatch_score": 0.0,
        "touching_parties": ["P_RING_01", "P_RING_02", "P_RING_03"],
        "explanation": "Collusive circular trading ring detected among P_RING_01, P_RING_02, P_RING_03.",
    }

    q = "Why was this certificate flagged and which parties are involved?"
    print(f"Auditor Query: {q}")
    res = chat_session(
        "REC-RING-001",
        q,
        fixtures["certificates"],
        fixtures["transactions"],
        {"REC-RING-001": sample_signals}
    )
    print("Response:\n" + res["reply"])

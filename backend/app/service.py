"""
Pipeline composition: ML -> graph flags -> weather flags -> merge risk_score
-> explanation -> write to ledger -> one Certificate. This module aggregates
teammates' outputs; it doesn't produce fraud signals itself.
"""
from typing import Dict, List, Optional

from .clients import explain_client, graph_client, ledger_client, ml_client, weather_client
from .config import settings
from .schemas import Certificate, CertificateCreate, LedgerProof

_CERT_STORE: Dict[str, Certificate] = {}

FLAGGED_THRESHOLD = 0.5


def _combine_risk(*scores: float) -> float:
    """Noisy-OR: independent fraud signals compound instead of diluting each
    other, so any single strong signal (e.g. a 25x capacity overshoot) can
    drive risk near 1.0 on its own rather than being capped by its weight."""
    survival = 1.0
    for s in scores:
        survival *= 1.0 - max(0.0, min(s, 1.0))
    return round(1.0 - survival, 3)


def compose_and_store(payload: CertificateCreate) -> Certificate:
    record = payload.model_dump()

    ml_result = ml_client.predict(record)
    graph_result = graph_client.analyze(record)
    weather_result = weather_client.check(record)

    risk_score = _combine_risk(
        ml_result["risk_score"], graph_result["graph_risk"], weather_result["weather_mismatch_score"]
    )

    risk_reasons: List[str] = list(ml_result["reasons"]) + list(graph_result["reasons"])
    if weather_result["weather_mismatch"] and weather_result["reason"]:
        risk_reasons.append(weather_result["reason"])

    explanation = explain_client.explain(
        record, {"risk_score": risk_score, "risk_reasons": risk_reasons}
    )

    ledger_entry = ledger_client.append(
        payload.certificate_id,
        {"risk_score": risk_score, "risk_reasons": risk_reasons},
    )
    verification = ledger_client.verify(payload.certificate_id)

    certificate = Certificate(
        certificate_id=payload.certificate_id,
        plant=payload.plant,
        generation=payload.generation,
        issuer_id=payload.issuer_id,
        buyer_id=payload.buyer_id,
        risk_score=risk_score,
        risk_reasons=risk_reasons,
        explanation=explanation,
        ledger=LedgerProof(
            hash=ledger_entry["hash"],
            prev_hash=ledger_entry.get("prev_hash"),
            verified=verification.get("verified", False),
        ),
    )
    _CERT_STORE[certificate.certificate_id] = certificate
    return certificate


def _with_fresh_verification(certificate: Certificate) -> Certificate:
    """Ledger integrity can change after a cert is written (that's the whole
    point of tamper-evidence), so every read path re-checks it live instead
    of trusting the verified flag frozen at compose_and_store() time."""
    verification = ledger_client.verify(certificate.certificate_id)
    certificate.ledger.verified = verification.get("verified", False)
    return certificate


def list_certificates() -> List[Certificate]:
    return [_with_fresh_verification(c) for c in _CERT_STORE.values()]


def get_certificate(certificate_id: str) -> Optional[Certificate]:
    certificate = _CERT_STORE.get(certificate_id)
    if certificate is None:
        return None
    return _with_fresh_verification(certificate)


def _data_sources() -> dict:
    """Mirrors the "/" root endpoint's mock-vs-real report, inline on the
    rollup itself -- a viewer of just /analytics/summary (e.g. a dashboard)
    would otherwise have no way to tell these numbers apart from a fully
    validated, real rollup."""
    return {
        "ml": "real" if settings.USE_REAL_ML else "mock",
        "graph": "real" if settings.USE_REAL_GRAPH else "mock",
        "weather": "real" if settings.USE_REAL_WEATHER else "mock",
        "explain": "real" if settings.USE_REAL_EXPLAIN else "mock",
        "ledger": "real" if settings.USE_REAL_LEDGER else "mock",
    }


def summary() -> dict:
    certs = list_certificates()
    total = len(certs)
    if total == 0:
        return {
            "total_certificates": 0,
            "flagged": 0,
            "average_risk_score": 0.0,
            "top_reasons": [],
            "data_sources": _data_sources(),
        }

    flagged = [c for c in certs if c.risk_score >= FLAGGED_THRESHOLD]
    avg_risk = round(sum(c.risk_score for c in certs) / total, 3)

    reason_counts: Dict[str, int] = {}
    for c in certs:
        for reason in c.risk_reasons:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
    top_reasons = sorted(reason_counts.items(), key=lambda kv: kv[1], reverse=True)[:5]

    return {
        "total_certificates": total,
        "flagged": len(flagged),
        "average_risk_score": avg_risk,
        "top_reasons": [r for r, _ in top_reasons],
        "data_sources": _data_sources(),
    }

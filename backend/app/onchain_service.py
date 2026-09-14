"""
Pipeline for on-chain certificates: run the same ML/graph/weather risk
assessment as /recs (service.assess_risk), mint on RECRegistry with that
score, then persist the off-chain half (raw record, reasoning, token_id) in
the database. Mirrors service.py's composition pattern but targets the
on-chain registry instead of the hash-chain ledger.
"""
import logging
import time
from dataclasses import dataclass
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session
from web3.exceptions import TransactionNotFound

from . import service
from .clients import web3_client
from .db_models import OnChainCertificate
from .schemas import CertificateIssueRequest

logger = logging.getLogger(__name__)


@dataclass
class RiskAssessment:
    plant_id: str
    energy_mwh: int
    generation_timestamp: int
    fraud_score: int
    risk_reasons: List[str]
    explanation: str


def assess(payload: CertificateIssueRequest) -> RiskAssessment:
    """Runs the same ML/graph/weather pipeline /recs uses, without touching
    the chain or the database — the real "AI analysis" step, callable on its
    own so the frontend can show it as a distinct phase from minting. Doesn't
    need a wallet/RPC configured at all, unlike issue_certificate."""
    plant_id = payload.plant.id
    energy_mwh = round(payload.generation.mwh_claimed)  # contract's energyMWh is uint256
    generation_timestamp = int(payload.generation.end.timestamp())

    # assess_risk (shared with the off-chain /recs pipeline) expects a
    # CertificateCreate-shaped record — certificate_id and buyer_id don't
    # exist in the on-chain request, so synthesize stand-ins. The eventual
    # recipient isn't resolved yet at this point (that's a mint-time, wallet-
    # dependent concern) so a fixed placeholder stands in for "buyer_id"
    # (self-dealing / trading-ring checks) — issuer_id realistically never
    # collides with it.
    pipeline_record = {
        **payload.model_dump(),
        "certificate_id": f"CHAIN-{plant_id}-{generation_timestamp}",
        "buyer_id": payload.to_address or "unspecified-recipient",
        "transactions": [],
    }
    risk_score, risk_reasons, explanation = service.assess_risk(pipeline_record)
    fraud_score = round(risk_score * 100)  # contract's fraudScore param is a 0-100 int

    return RiskAssessment(
        plant_id=plant_id,
        energy_mwh=energy_mwh,
        generation_timestamp=generation_timestamp,
        fraud_score=fraud_score,
        risk_reasons=risk_reasons,
        explanation=explanation,
    )


_RECONCILE_INTERVAL_SECONDS = 30.0
_last_reconciled_at = 0.0


def reconcile_with_chain(db: Session, force: bool = False) -> int:
    """Drop off-chain rows whose chain no longer exists.

    A local Hardhat node keeps no state across restarts, while the database
    does — so after a chain restart every stored token_id points at nothing,
    and the next mint (which starts again at token 0) would collide with a
    stale primary key. If the newest row's mint transaction is unknown to the
    connected chain, the whole table belongs to a chain that is gone.

    Only a definite "transaction not found" clears anything; an unreachable
    RPC leaves the data alone. Returns the number of rows removed.
    """
    global _last_reconciled_at
    now = time.monotonic()
    if not force and now - _last_reconciled_at < _RECONCILE_INTERVAL_SECONDS:
        return 0

    latest = db.scalars(select(OnChainCertificate).order_by(OnChainCertificate.token_id.desc()).limit(1)).first()
    if latest is None:
        _last_reconciled_at = now
        return 0

    try:
        web3_client.get_w3().eth.get_transaction_receipt(latest.mint_tx_hash)
    except TransactionNotFound:
        removed = db.query(OnChainCertificate).delete()
        db.commit()
        logger.warning("Chain was reset: removed %d stale off-chain certificate rows", removed)
        _last_reconciled_at = now
        return removed
    except Exception:
        return 0  # chain unreachable — retry on the next call, never wipe on doubt

    _last_reconciled_at = now
    return 0


def issue_certificate(db: Session, payload: CertificateIssueRequest) -> OnChainCertificate:
    reconcile_with_chain(db, force=True)
    to_address = payload.to_address or web3_client.get_backend_address()

    # Pre-flight the duplicate check as a free view call, before running the
    # (slow) risk pipeline. isRecordUsed answers the same question the mint
    # would revert on, so this turns a wasted pipeline run + reverted gas
    # estimate into an immediate, unambiguous 409.
    plant_id = payload.plant.id
    energy_mwh = round(payload.generation.mwh_claimed)
    generation_timestamp = int(payload.generation.end.timestamp())
    if web3_client.is_record_used(plant_id, energy_mwh, generation_timestamp):
        raise web3_client.DuplicateRecordError(
            f"Generation record ({plant_id}, {energy_mwh} MWh, {generation_timestamp}) "
            f"has already been certified on-chain."
        )

    result = assess(payload)
    plant_id, energy_mwh, generation_timestamp, fraud_score, risk_reasons, explanation = (
        result.plant_id,
        result.energy_mwh,
        result.generation_timestamp,
        result.fraud_score,
        result.risk_reasons,
        result.explanation,
    )

    raw_record = payload.model_dump(mode="json")  # datetimes -> ISO strings, so the JSON column can store it
    raw_record["to_address"] = to_address  # record the resolved recipient, not just the (possibly omitted) input

    mint_result = web3_client.mint_certificate(
        to_address=to_address,
        plant_id=plant_id,
        energy_mwh=energy_mwh,
        generation_timestamp=generation_timestamp,
        fraud_score=fraud_score,
    )

    row = OnChainCertificate(
        token_id=mint_result["token_id"],
        owner_address=to_address,
        plant_id=plant_id,
        energy_mwh=energy_mwh,
        generation_timestamp=generation_timestamp,
        fraud_score=fraud_score,
        risk_reasons=risk_reasons,
        explanation=explanation,
        raw_record=raw_record,
        mint_tx_hash=mint_result["tx_hash"],
        status="issued",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_certificate(db: Session, token_id: int) -> Optional[dict]:
    """Merges the live on-chain Certificate + ownerOf() with the off-chain
    database row. Returns None if we have no off-chain row for this token."""
    row = db.get(OnChainCertificate, token_id)
    if row is None:
        return None

    onchain = web3_client.get_certificate(token_id)
    return {
        "token_id": token_id,
        "owner_address": onchain["owner"],
        "plant_id": onchain["plant_id"],
        "energy_mwh": onchain["energy_mwh"],
        "generation_timestamp": onchain["generation_timestamp"],
        "fraud_score": onchain["fraud_score"],
        "retired_on_chain": onchain["retired"],
        "risk_reasons": row.risk_reasons,
        "explanation": row.explanation,
        "raw_record": row.raw_record,
        "mint_tx_hash": row.mint_tx_hash,
        "status": row.status,
        "retire_tx_hash": row.retire_tx_hash,
        "created_at": row.created_at,
    }


def list_certificates(db: Session, limit: int = 100) -> List[OnChainCertificate]:
    """Off-chain rows only (no per-item chain read) — fast enough for a
    dashboard/explorer list. Use get_certificate() for the live-verified detail."""
    reconcile_with_chain(db)
    stmt = select(OnChainCertificate).order_by(OnChainCertificate.created_at.desc()).limit(limit)
    return list(db.scalars(stmt))


def retire_certificate(db: Session, token_id: int) -> Optional[OnChainCertificate]:
    row = db.get(OnChainCertificate, token_id)
    if row is None:
        return None

    result = web3_client.retire_certificate(token_id, owner_address=row.owner_address)
    row.status = "retired"
    row.retire_tx_hash = result["tx_hash"]
    db.commit()
    db.refresh(row)
    return row


def transfer_certificate(
    db: Session, token_id: int, to_address: str
) -> Optional[Tuple[OnChainCertificate, str]]:
    """Transfers a certificate to a new owner and re-syncs the off-chain row.

    Returns (row, transfer_tx_hash) — the hash isn't persisted on the row (the
    table tracks mint and retire hashes, and a certificate can be transferred
    any number of times), so it's returned alongside for the API response.

    The on-chain contract blocks transfers of retired certificates (a retired
    REC has been consumed against a claim; letting it move again would let the
    same MWh be resold), so that rule is enforced by the chain, not here.
    """
    row = db.get(OnChainCertificate, token_id)
    if row is None:
        return None

    result = web3_client.transfer_certificate(
        token_id, from_address=row.owner_address, to_address=to_address
    )
    row.owner_address = result["owner"]
    db.commit()
    db.refresh(row)
    return row, result["tx_hash"]

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import onchain_service
from ..clients import web3_client
from ..db import get_db
from ..schemas import (
    CertificateAnalyzeResponse,
    CertificateIssueRequest,
    CertificateIssueResponse,
    CertificateListItem,
    CertificateRetireResponse,
    CertificateTransferRequest,
    CertificateTransferResponse,
    OnChainCertificateResponse,
)

router = APIRouter()


@router.get("", response_model=List[CertificateListItem])
def list_certificates(db: Session = Depends(get_db)):
    rows = onchain_service.list_certificates(db)
    return [
        CertificateListItem(
            token_id=row.token_id,
            owner_address=row.owner_address,
            plant_id=row.plant_id,
            energy_mwh=row.energy_mwh,
            generation_timestamp=datetime.fromtimestamp(row.generation_timestamp, tz=timezone.utc),
            fraud_score=row.fraud_score,
            status=row.status,
            mint_tx_hash=row.mint_tx_hash,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("/analyze", response_model=CertificateAnalyzeResponse)
def analyze_certificate(payload: CertificateIssueRequest):
    result = onchain_service.assess(payload)
    return CertificateAnalyzeResponse(
        fraud_score=result.fraud_score,
        risk_reasons=result.risk_reasons,
        explanation=result.explanation,
    )


@router.post("/issue", response_model=CertificateIssueResponse, status_code=201)
def issue_certificate(payload: CertificateIssueRequest, db: Session = Depends(get_db)):
    try:
        row = onchain_service.issue_certificate(db, payload)
    except web3_client.DuplicateRecordError:
        raise HTTPException(status_code=409, detail="This generation record has already been certified.")
    except web3_client.NotAuthorizedError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except web3_client.InvalidArgumentError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except web3_client.ChainError as exc:
        raise HTTPException(status_code=502, detail=f"On-chain mint failed: {exc}")

    return CertificateIssueResponse(
        token_id=row.token_id,
        tx_hash=row.mint_tx_hash,
        owner_address=row.owner_address,
        plant_id=row.plant_id,
        energy_mwh=row.energy_mwh,
        generation_timestamp=datetime.fromtimestamp(row.generation_timestamp, tz=timezone.utc),
        fraud_score=row.fraud_score,
        risk_reasons=row.risk_reasons,
        explanation=row.explanation,
        status=row.status,
    )


@router.get("/{token_id}", response_model=OnChainCertificateResponse)
def get_certificate(token_id: int, db: Session = Depends(get_db)):
    try:
        merged = onchain_service.get_certificate(db, token_id)
    except web3_client.CertificateNotFoundError:
        raise HTTPException(status_code=404, detail=f"No certificate with tokenId {token_id} on-chain")
    except web3_client.ChainError as exc:
        raise HTTPException(status_code=502, detail=f"On-chain read failed: {exc}")

    if merged is None:
        raise HTTPException(status_code=404, detail=f"Certificate {token_id} not found")

    merged["generation_timestamp"] = datetime.fromtimestamp(merged["generation_timestamp"], tz=timezone.utc)
    return OnChainCertificateResponse(**merged)


@router.post("/{token_id}/retire", response_model=CertificateRetireResponse)
def retire_certificate(token_id: int, db: Session = Depends(get_db)):
    try:
        row = onchain_service.retire_certificate(db, token_id)
    except web3_client.NotAuthorizedError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except web3_client.AlreadyRetiredError:
        raise HTTPException(status_code=409, detail=f"Certificate {token_id} is already retired.")
    except web3_client.CertificateNotFoundError:
        raise HTTPException(status_code=404, detail=f"No certificate with tokenId {token_id} on-chain")
    except web3_client.ChainError as exc:
        raise HTTPException(status_code=502, detail=f"On-chain retire failed: {exc}")

    if row is None:
        raise HTTPException(status_code=404, detail=f"Certificate {token_id} not found")

    return CertificateRetireResponse(token_id=row.token_id, tx_hash=row.retire_tx_hash, status=row.status)


@router.post("/{token_id}/transfer", response_model=CertificateTransferResponse)
def transfer_certificate(token_id: int, payload: CertificateTransferRequest, db: Session = Depends(get_db)):
    """Transfers the certificate NFT to another wallet.

    A retired certificate cannot be transferred — the contract rejects it, and
    that surfaces here as 409 rather than a generic chain error.
    """
    try:
        result = onchain_service.transfer_certificate(db, token_id, payload.to_address)
    except web3_client.NotAuthorizedError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except web3_client.AlreadyRetiredError:
        raise HTTPException(
            status_code=409,
            detail=f"Certificate {token_id} is retired and can no longer be transferred.",
        )
    except web3_client.CertificateNotFoundError:
        raise HTTPException(status_code=404, detail=f"No certificate with tokenId {token_id} on-chain")
    except web3_client.InvalidArgumentError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except web3_client.ChainError as exc:
        raise HTTPException(status_code=502, detail=f"On-chain transfer failed: {exc}")

    if result is None:
        raise HTTPException(status_code=404, detail=f"Certificate {token_id} not found")

    row, tx_hash = result
    return CertificateTransferResponse(
        token_id=row.token_id,
        tx_hash=tx_hash,
        owner_address=row.owner_address,
        status=row.status,
    )

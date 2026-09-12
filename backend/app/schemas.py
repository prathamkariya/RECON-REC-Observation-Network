"""
The contract. Every teammate's output ultimately lands in a `Certificate`.
Response shape never changes when a mock client is swapped for a real one.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class Plant(BaseModel):
    id: str
    type: str  # "solar" | "wind" | "hydro" | ...
    capacity_mw: float
    lat: float
    lon: float


class Generation(BaseModel):
    mwh_claimed: float
    start: datetime
    end: datetime


class Transaction(BaseModel):
    """Optional trading context used by the graph client for ring/cycle detection."""

    from_party_id: str
    to_party_id: str
    transfer_timestamp: datetime
    certificate_id: Optional[str] = None


class CertificateCreate(BaseModel):
    """Inbound payload for POST /recs — everything except computed signals."""

    certificate_id: str
    plant: Plant
    generation: Generation
    issuer_id: str
    buyer_id: str
    transactions: List[Transaction] = Field(default_factory=list)


class LedgerProof(BaseModel):
    hash: str
    prev_hash: Optional[str] = None
    verified: bool


class Certificate(BaseModel):
    """THE CONTRACT. Aggregated, stored, and returned by every /recs endpoint."""

    certificate_id: str
    plant: Plant
    generation: Generation
    issuer_id: str
    buyer_id: str
    risk_score: float = Field(ge=0.0, le=1.0)  # Role 1
    risk_reasons: List[str]  # Roles 1 + 2 merged
    explanation: str  # Role 2 (Claude API)
    ledger: LedgerProof  # Role 3


# ---------------------------------------------------------------------------
# On-chain certificates (RECRegistry.sol ERC-721 mint/retire), separate from
# the off-chain hash-ledger pipeline above.


class CertificateIssueRequest(BaseModel):
    """Inbound payload for POST /certificates/issue."""

    to_address: Optional[str] = Field(
        default=None,
        description="Wallet address the minted certificate NFT is sent to. "
        "Omit to mint to the backend's own issuer wallet — callers (e.g. the "
        "web frontend) never need a connected wallet just to issue.",
    )
    plant: Plant
    generation: Generation
    issuer_id: str


class CertificateAnalyzeResponse(BaseModel):
    """POST /certificates/analyze — the AI fraud-scoring result on its own,
    with nothing minted or persisted yet. Same scoring pipeline issue_certificate
    uses internally; calling this first just makes analysis a visible, distinct
    step before the user commits to minting."""

    fraud_score: int = Field(ge=0, le=100)
    risk_reasons: List[str]
    explanation: str


class CertificateIssueResponse(BaseModel):
    token_id: int
    tx_hash: str
    owner_address: str
    plant_id: str
    energy_mwh: float
    generation_timestamp: datetime
    fraud_score: int = Field(ge=0, le=100)
    risk_reasons: List[str]
    explanation: str
    status: str


class OnChainCertificateResponse(BaseModel):
    """Merges live on-chain data (getCertificate + ownerOf) with the
    off-chain database row for the dashboard."""

    token_id: int
    owner_address: str
    plant_id: str
    energy_mwh: float
    generation_timestamp: datetime
    fraud_score: int
    retired_on_chain: bool
    risk_reasons: List[str]
    explanation: str
    raw_record: dict
    mint_tx_hash: str
    status: str
    retire_tx_hash: Optional[str] = None
    created_at: datetime


class CertificateRetireResponse(BaseModel):
    token_id: int
    tx_hash: str
    status: str


class CertificateTransferRequest(BaseModel):
    """Inbound payload for POST /certificates/{token_id}/transfer."""

    to_address: str = Field(description="Wallet address to transfer the certificate NFT to.")


class CertificateTransferResponse(BaseModel):
    token_id: int
    tx_hash: str
    owner_address: str
    status: str


class CertificateListItem(BaseModel):
    """One row for GET /certificates — the off-chain database view, so
    listing many certificates doesn't require one chain read each. Use
    GET /certificates/{token_id} for the live on-chain-verified detail."""

    token_id: int
    owner_address: str
    plant_id: str
    energy_mwh: float
    generation_timestamp: datetime
    fraud_score: int
    status: str
    mint_tx_hash: str
    created_at: datetime

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

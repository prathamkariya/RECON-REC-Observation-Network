"""SQLAlchemy ORM models — off-chain half of each minted certificate."""
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class OnChainCertificate(Base):
    """Off-chain record for a certificate minted via RECRegistry.issueCertificate.

    Keyed by token_id (the on-chain tokenId). Holds everything the contract
    doesn't store: the raw generation payload, fraud score reasoning, and the
    mint tx hash, so GET /certificates/{token_id} can merge this with live
    on-chain data in one response.
    """

    __tablename__ = "onchain_certificates"

    token_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_address: Mapped[str] = mapped_column(String, nullable=False)
    plant_id: Mapped[str] = mapped_column(String, nullable=False)
    energy_mwh: Mapped[float] = mapped_column(Float, nullable=False)
    generation_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    fraud_score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_reasons: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    explanation: Mapped[str] = mapped_column(String, nullable=False, default="")
    raw_record: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    mint_tx_hash: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="issued")  # "issued" | "retired"
    retire_tx_hash: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

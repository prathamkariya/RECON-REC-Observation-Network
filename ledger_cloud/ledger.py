"""
Role 3: Hash-Chained Audit Ledger (durable).

Every evaluated certificate is appended as a block whose hash covers its own
contents *and* the previous block's hash. Editing any stored block breaks the
chain from that point onward, which `verify.verify_chain` detects.

This is the durable counterpart to the backend's in-process chain
(backend/app/clients/ledger_client.py): identical guarantee, but persisted via
SQLAlchemy so the audit trail survives a restart. That matters in a
containerised deployment, where an in-memory chain would be lost on every
redeploy — a tamper-evident log you can erase by restarting is not evidence.

Storage follows DATABASE_URL (Postgres in deployment, a local SQLite file
otherwise), so it shares the backend's database without importing from it —
ledger_cloud stays independently runnable.
"""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from sqlalchemy import Integer, JSON, String, UniqueConstraint, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

_DEFAULT_SQLITE = Path(__file__).resolve().parent.parent / "backend" / "recon.db"
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{_DEFAULT_SQLITE}"


class Base(DeclarativeBase):
    pass


class LedgerBlock(Base):
    """One block. `index` is unique so two concurrent writers cannot silently
    fork the chain — the loser's insert fails instead of producing two blocks
    that both claim the same position."""

    __tablename__ = "ledger_blocks"
    __table_args__ = (UniqueConstraint("index", name="uq_ledger_block_index"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[str] = mapped_column(String, nullable=False)
    certificate_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    previous_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    hash: Mapped[str] = mapped_column(String, nullable=False)


def compute_block_hash(index: int, timestamp: str, certificate_id: str, data: dict,
                       previous_hash: Optional[str]) -> str:
    """The chain's hashing rule, in one place so appending and verifying can
    never drift apart. `sort_keys` keeps the digest stable across dict
    orderings; `default=str` keeps a stray datetime from breaking it."""
    payload = json.dumps(
        {
            "index": index,
            "timestamp": timestamp,
            "certificate_id": certificate_id,
            "data": data,
            "previous_hash": previous_hash,
        },
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


class Block:
    """In-memory view of a stored block."""

    __slots__ = ("index", "timestamp", "certificate_id", "data", "previous_hash", "hash")

    def __init__(self, index: int, timestamp: str, certificate_id: str, data: dict,
                 previous_hash: Optional[str], hash: Optional[str] = None):
        self.index = index
        self.timestamp = timestamp
        self.certificate_id = certificate_id
        self.data = data
        self.previous_hash = previous_hash
        self.hash = hash or self.compute_hash()

    def compute_hash(self) -> str:
        return compute_block_hash(
            self.index, self.timestamp, self.certificate_id, self.data, self.previous_hash
        )

    @classmethod
    def from_row(cls, row: LedgerBlock) -> "Block":
        return cls(
            index=row.index,
            timestamp=row.timestamp,
            certificate_id=row.certificate_id,
            data=row.data,
            previous_hash=row.previous_hash,
            hash=row.hash,
        )

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "certificate_id": self.certificate_id,
            "data": self.data,
            "previous_hash": self.previous_hash,
            "hash": self.hash,
        }


class AuditLedger:
    def __init__(self, database_url: Optional[str] = None):
        url = database_url or DATABASE_URL
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        self._engine = create_engine(url, connect_args=connect_args)
        self._session_factory = sessionmaker(bind=self._engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(bind=self._engine)

    def append_certificate(self, certificate_id: str, signals: dict) -> Block:
        """Appends one block linked to the current tip and returns it."""
        with self._session_factory() as session:
            tip = session.scalars(
                select(LedgerBlock).order_by(LedgerBlock.index.desc()).limit(1)
            ).first()

            block = Block(
                index=0 if tip is None else tip.index + 1,
                timestamp=datetime.now(timezone.utc).isoformat(),
                certificate_id=certificate_id,
                data=signals,
                previous_hash=None if tip is None else tip.hash,
            )

            session.add(
                LedgerBlock(
                    index=block.index,
                    timestamp=block.timestamp,
                    certificate_id=block.certificate_id,
                    data=block.data,
                    previous_hash=block.previous_hash,
                    hash=block.hash,
                )
            )
            session.commit()
            return block

    @property
    def chain(self) -> List[Block]:
        with self._session_factory() as session:
            rows = session.scalars(select(LedgerBlock).order_by(LedgerBlock.index)).all()
            return [Block.from_row(row) for row in rows]

    def find(self, certificate_id: str) -> Optional[Block]:
        """The most recent block for a certificate. A certificate can legitimately
        appear more than once (duplicate_serial clones share an id), so the
        latest block is the current state."""
        with self._session_factory() as session:
            row = session.scalars(
                select(LedgerBlock)
                .where(LedgerBlock.certificate_id == certificate_id)
                .order_by(LedgerBlock.index.desc())
                .limit(1)
            ).first()
            return Block.from_row(row) if row else None

    def chain_length(self) -> int:
        with self._session_factory() as session:
            return len(session.scalars(select(LedgerBlock.id)).all())

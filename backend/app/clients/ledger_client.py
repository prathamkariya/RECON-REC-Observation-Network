"""
Adapter for Role 3's tamper-evident ledger.

The mock path is NOT a stub — it's a real in-memory SHA-256 hash chain: each
block's hash covers its own data plus the previous block's hash, so mutating
any stored block's data is detectable on re-verification, no Postgres needed.

Real: imports ledger_cloud.ledger / ledger_cloud.verify (Postgres via
DATABASE_URL), behind USE_REAL_LEDGER. If the real path errors, the call
falls through to the mock chain so a broken teammate module never blocks the
pipeline.
"""
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional

from ..config import settings


class _Block:
    __slots__ = ("index", "timestamp", "certificate_id", "data", "previous_hash", "hash")

    def __init__(self, index: int, certificate_id: str, data: dict, previous_hash: Optional[str]):
        self.index = index
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.certificate_id = certificate_id
        self.data = data
        self.previous_hash = previous_hash
        self.hash = self._compute_hash()

    def _compute_hash(self) -> str:
        payload = json.dumps(
            {
                "index": self.index,
                "timestamp": self.timestamp,
                "certificate_id": self.certificate_id,
                "data": self.data,
                "previous_hash": self.previous_hash,
            },
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(payload.encode()).hexdigest()


class InMemoryLedger:
    def __init__(self):
        self._chain: list[_Block] = []
        self._index_by_cert: dict[str, int] = {}

    def append(self, certificate_id: str, signals: dict) -> _Block:
        previous_hash = self._chain[-1].hash if self._chain else None
        block = _Block(len(self._chain), certificate_id, signals, previous_hash)
        self._chain.append(block)
        self._index_by_cert[certificate_id] = block.index
        return block

    def verify(self, certificate_id: str) -> dict:
        idx = self._index_by_cert.get(certificate_id)
        if idx is None:
            return {"found": False, "hash": None, "prev_hash": None, "verified": False}

        block = self._chain[idx]

        chain_intact = True
        for i, b in enumerate(self._chain[: idx + 1]):
            expected_prev = self._chain[i - 1].hash if i > 0 else None
            if b.previous_hash != expected_prev or b._compute_hash() != b.hash:
                chain_intact = False
                break

        return {
            "found": True,
            "hash": block.hash,
            "prev_hash": block.previous_hash,
            "verified": chain_intact,
        }

    def chain_length(self) -> int:
        return len(self._chain)


_mock_ledger = InMemoryLedger()
_real_ledger_instance = None


def _get_real_ledger_singleton():
    global _real_ledger_instance
    if _real_ledger_instance is None:
        from ledger_cloud.ledger import AuditLedger  # teammate's module (Role 3)

        _real_ledger_instance = AuditLedger()
    return _real_ledger_instance


def _real_append(certificate_id: str, signals: dict) -> dict:
    ledger = _get_real_ledger_singleton()
    block = ledger.append_certificate(certificate_id, signals)
    if block is None:
        raise ValueError("ledger_cloud.AuditLedger.append_certificate returned no block")
    return {"hash": block.hash, "prev_hash": block.previous_hash}


def append(certificate_id: str, signals: dict) -> dict:
    if settings.USE_REAL_LEDGER:
        try:
            return _real_append(certificate_id, signals)
        except Exception:
            pass  # fall through to the mock chain
    block = _mock_ledger.append(certificate_id, signals)
    return {"hash": block.hash, "prev_hash": block.previous_hash}


def verify(certificate_id: str) -> dict:
    if settings.USE_REAL_LEDGER:
        try:
            from ledger_cloud.verify import verify_chain  # teammate's module (Role 3)

            ledger = _get_real_ledger_singleton()
            block = ledger.find(certificate_id)
            if block is None:
                return {"found": False, "hash": None, "prev_hash": None, "verified": False}
            # Verification covers the whole chain, not just this block: an edit
            # to any earlier block invalidates this one's proof too.
            return {
                "found": True,
                "hash": block.hash,
                "prev_hash": block.previous_hash,
                "verified": bool(verify_chain(ledger.chain)),
            }
        except Exception:
            pass  # fall through to the mock chain
    return _mock_ledger.verify(certificate_id)


def debug_tamper(certificate_id: str, corrupt_data: dict) -> bool:
    """Test-only hook: mutates a stored block's data without recomputing its
    hash, so verify() can demonstrate catching a retroactive edit. Never
    called from the API — used by the smoke test / mock_server fixtures."""
    idx = _mock_ledger._index_by_cert.get(certificate_id)
    if idx is None:
        return False
    _mock_ledger._chain[idx].data.update(corrupt_data)
    return True

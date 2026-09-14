"""
Ledger adapter: the hash chain that backs the project's tamper-evidence claim.

The mock path is a real SHA-256 chain, not a stub, so these tests assert the
property that matters — a retroactive edit to any block is detectable — rather
than just that a hash string comes back.
"""
import pytest

from backend.app.clients import ledger_client
from backend.app.clients.ledger_client import InMemoryLedger


@pytest.fixture
def ledger() -> InMemoryLedger:
    return InMemoryLedger()


# ---------------------------------------------------------------------------
# Chain construction


def test_first_block_has_no_previous_hash(ledger):
    block = ledger.append("REC-1", {"risk_score": 0.1})

    assert block.previous_hash is None
    assert block.index == 0
    assert len(block.hash) == 64  # SHA-256 hex digest


def test_each_block_links_to_its_predecessor(ledger):
    first = ledger.append("REC-1", {"risk_score": 0.1})
    second = ledger.append("REC-2", {"risk_score": 0.2})
    third = ledger.append("REC-3", {"risk_score": 0.3})

    assert second.previous_hash == first.hash
    assert third.previous_hash == second.hash
    assert [b.index for b in (first, second, third)] == [0, 1, 2]


def test_identical_payloads_produce_different_hashes_at_different_positions(ledger):
    """Chain position is part of what's hashed, so the same certificate data
    appended twice doesn't collide — otherwise a block could be relocated
    within the chain undetected."""
    first = ledger.append("REC-SAME", {"risk_score": 0.5})
    second = ledger.append("REC-SAME", {"risk_score": 0.5})

    assert first.hash != second.hash


# ---------------------------------------------------------------------------
# Verification


def test_verify_reports_an_intact_chain(ledger):
    ledger.append("REC-1", {"risk_score": 0.1})
    ledger.append("REC-2", {"risk_score": 0.2})

    result = ledger.verify("REC-1")

    assert result["found"] is True
    assert result["verified"] is True
    assert result["hash"] is not None


def test_verify_reports_not_found_for_unknown_certificate(ledger):
    result = ledger.verify("REC-NEVER-WRITTEN")

    assert result["found"] is False
    assert result["verified"] is False
    assert result["hash"] is None


def test_editing_a_block_after_the_fact_is_detected(ledger):
    """The whole point of the ledger: mutate stored data without recomputing
    the hash and verification must fail."""
    ledger.append("REC-1", {"risk_score": 0.1})
    ledger.append("REC-2", {"risk_score": 0.9})

    assert ledger.verify("REC-2")["verified"] is True

    ledger._chain[1].data["risk_score"] = 0.0  # quietly downgrade a flagged cert

    assert ledger.verify("REC-2")["verified"] is False


def test_tampering_with_an_earlier_block_invalidates_later_ones(ledger):
    """Chain integrity is not per-block: editing block 0 must invalidate the
    verification of block 2, because block 2's proof depends on it."""
    ledger.append("REC-1", {"risk_score": 0.1})
    ledger.append("REC-2", {"risk_score": 0.2})
    ledger.append("REC-3", {"risk_score": 0.3})

    ledger._chain[0].data["risk_score"] = 0.99

    assert ledger.verify("REC-3")["verified"] is False


def test_chain_length_tracks_appends(ledger):
    assert ledger.chain_length() == 0

    ledger.append("REC-1", {})
    ledger.append("REC-2", {})

    assert ledger.chain_length() == 2


# ---------------------------------------------------------------------------
# Module-level adapter surface


def test_append_then_verify_through_the_module_api():
    entry = ledger_client.append("REC-100", {"risk_score": 0.42})

    result = ledger_client.verify("REC-100")

    assert entry["hash"] == result["hash"]
    assert result["verified"] is True


def test_debug_tamper_hook_makes_verification_fail():
    """The demo hook that lets mock_server show a tampered certificate."""
    ledger_client.append("REC-200", {"risk_score": 0.1})

    assert ledger_client.debug_tamper("REC-200", {"risk_score": 0.0}) is True
    assert ledger_client.verify("REC-200")["verified"] is False


def test_debug_tamper_returns_false_for_unknown_certificate():
    assert ledger_client.debug_tamper("REC-NOT-THERE", {"risk_score": 0.0}) is False


def test_falls_back_to_mock_chain_when_real_ledger_is_unavailable(real_sources, monkeypatch):
    """USE_REAL_LEDGER is on but ledger_cloud raises — the pipeline must still
    get a usable hash rather than failing the request."""
    real_sources("LEDGER")

    def _explode():
        raise RuntimeError("ledger_cloud is not ready")

    monkeypatch.setattr(ledger_client, "_get_real_ledger_singleton", _explode)

    entry = ledger_client.append("REC-300", {"risk_score": 0.5})

    assert len(entry["hash"]) == 64
    assert ledger_client.verify("REC-300")["verified"] is True

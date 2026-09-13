"""
The durable hash chain (ledger_cloud) and the backend adapter's real branch.

Same tamper-evidence property as the in-process chain, but persisted — so
these tests also prove the chain survives a new AuditLedger instance, which is
what a container restart looks like.
"""
import pytest

from backend.app.clients import ledger_client
from ledger_cloud.ledger import AuditLedger
from ledger_cloud.verify import find_break, generate_inclusion_proof, verify_chain


@pytest.fixture
def db_url(tmp_path) -> str:
    return f"sqlite:///{tmp_path / 'ledger.db'}"


@pytest.fixture
def ledger(db_url) -> AuditLedger:
    return AuditLedger(database_url=db_url)


# ---------------------------------------------------------------------------
# Appending


def test_first_block_starts_the_chain(ledger):
    block = ledger.append_certificate("REC-1", {"risk_score": 0.1})

    assert block.index == 0
    assert block.previous_hash is None
    assert len(block.hash) == 64


def test_each_block_links_to_the_previous_one(ledger):
    first = ledger.append_certificate("REC-1", {"risk_score": 0.1})
    second = ledger.append_certificate("REC-2", {"risk_score": 0.2})

    assert second.index == 1
    assert second.previous_hash == first.hash


def test_chain_is_returned_in_order(ledger):
    for i in range(5):
        ledger.append_certificate(f"REC-{i}", {"risk_score": i / 10})

    chain = ledger.chain

    assert [b.index for b in chain] == [0, 1, 2, 3, 4]
    assert ledger.chain_length() == 5


# ---------------------------------------------------------------------------
# Durability


def test_chain_survives_a_new_ledger_instance(db_url):
    """What a container restart looks like. An audit log you can erase by
    restarting the process is not evidence."""
    first_run = AuditLedger(database_url=db_url)
    first_run.append_certificate("REC-1", {"risk_score": 0.1})
    first_run.append_certificate("REC-2", {"risk_score": 0.9})

    second_run = AuditLedger(database_url=db_url)

    assert second_run.chain_length() == 2
    assert verify_chain(second_run.chain) is True


def test_a_block_appended_after_a_restart_links_to_the_persisted_tip(db_url):
    first_run = AuditLedger(database_url=db_url)
    tip = first_run.append_certificate("REC-1", {"risk_score": 0.1})

    second_run = AuditLedger(database_url=db_url)
    appended = second_run.append_certificate("REC-2", {"risk_score": 0.2})

    assert appended.previous_hash == tip.hash
    assert verify_chain(second_run.chain) is True


# ---------------------------------------------------------------------------
# Verification


def test_an_untouched_chain_verifies(ledger):
    ledger.append_certificate("REC-1", {"risk_score": 0.1})
    ledger.append_certificate("REC-2", {"risk_score": 0.2})

    assert verify_chain(ledger.chain) is True
    assert find_break(ledger.chain) is None


def test_an_empty_chain_verifies(ledger):
    assert verify_chain(ledger.chain) is True


def test_editing_stored_data_breaks_verification(ledger):
    ledger.append_certificate("REC-1", {"risk_score": 0.1})
    ledger.append_certificate("REC-2", {"risk_score": 0.9})

    chain = ledger.chain
    chain[1].data["risk_score"] = 0.0  # quietly clear a flagged certificate

    assert verify_chain(chain) is False
    assert find_break(chain) == 1


def test_editing_an_early_block_invalidates_everything_after_it(ledger):
    for i in range(4):
        ledger.append_certificate(f"REC-{i}", {"risk_score": 0.5})

    chain = ledger.chain
    chain[0].data["risk_score"] = 0.0

    assert verify_chain(chain) is False
    assert find_break(chain) == 0


def test_removing_a_block_breaks_verification(ledger):
    for i in range(3):
        ledger.append_certificate(f"REC-{i}", {"risk_score": 0.5})

    chain = ledger.chain
    del chain[1]  # excise the middle block

    assert verify_chain(chain) is False


# ---------------------------------------------------------------------------
# Lookup and proofs


def test_find_returns_the_block_for_a_certificate(ledger):
    ledger.append_certificate("REC-1", {"risk_score": 0.1})
    ledger.append_certificate("REC-2", {"risk_score": 0.2})

    found = ledger.find("REC-1")

    assert found is not None
    assert found.certificate_id == "REC-1"
    assert found.index == 0


def test_find_returns_none_for_an_unknown_certificate(ledger):
    assert ledger.find("REC-NEVER") is None


def test_find_returns_the_latest_block_for_a_repeated_certificate(ledger):
    """duplicate_serial clones share a certificate_id; the latest block is the
    current state."""
    ledger.append_certificate("REC-DUP", {"risk_score": 0.1})
    ledger.append_certificate("REC-DUP", {"risk_score": 0.9})

    assert ledger.find("REC-DUP").data["risk_score"] == 0.9


def test_inclusion_proof_carries_the_surrounding_hashes(ledger):
    ledger.append_certificate("REC-1", {"risk_score": 0.1})
    ledger.append_certificate("REC-2", {"risk_score": 0.2})
    ledger.append_certificate("REC-3", {"risk_score": 0.3})
    chain = ledger.chain

    proof = generate_inclusion_proof("REC-2", chain)

    assert proof["block"]["certificate_id"] == "REC-2"
    assert proof["previous_hash"] == chain[0].hash
    assert proof["next_hash"] == chain[2].hash
    assert proof["chain_verified"] is True
    assert proof["chain_length"] == 3


def test_inclusion_proof_reports_a_broken_chain(ledger):
    ledger.append_certificate("REC-1", {"risk_score": 0.1})
    ledger.append_certificate("REC-2", {"risk_score": 0.9})
    chain = ledger.chain
    chain[0].data["risk_score"] = 0.0

    assert generate_inclusion_proof("REC-2", chain)["chain_verified"] is False


def test_inclusion_proof_is_none_for_an_unknown_certificate(ledger):
    assert generate_inclusion_proof("REC-NEVER", ledger.chain) is None


# ---------------------------------------------------------------------------
# Backend adapter, real branch


@pytest.fixture
def real_ledger_wired(real_sources, monkeypatch, db_url):
    """Points the adapter's singleton at a throwaway durable ledger."""
    real_sources("LEDGER")
    instance = AuditLedger(database_url=db_url)
    monkeypatch.setattr(ledger_client, "_real_ledger_instance", instance)
    return instance


def test_adapter_writes_through_to_the_durable_ledger(real_ledger_wired):
    entry = ledger_client.append("REC-1", {"risk_score": 0.42})

    assert entry["hash"] == real_ledger_wired.find("REC-1").hash
    assert real_ledger_wired.chain_length() == 1


def test_adapter_verify_returns_the_real_hash_not_null(real_ledger_wired):
    """The /verify contract promises the block's SHA-256; the real branch used
    to answer `hash: null` for every certificate."""
    entry = ledger_client.append("REC-1", {"risk_score": 0.42})

    result = ledger_client.verify("REC-1")

    assert result["found"] is True
    assert result["verified"] is True
    assert result["hash"] == entry["hash"]


def test_adapter_verify_reports_not_found_for_an_unwritten_certificate(real_ledger_wired):
    """It used to answer `found: true` for anything, including certificates
    that were never written."""
    result = ledger_client.verify("REC-NEVER")

    assert result["found"] is False
    assert result["verified"] is False


def test_adapter_verify_detects_tampering_in_the_durable_ledger(real_ledger_wired, db_url):
    from sqlalchemy import create_engine, text

    ledger_client.append("REC-1", {"risk_score": 0.9})
    assert ledger_client.verify("REC-1")["verified"] is True

    # Edit the stored row directly — exactly what an insider with database
    # access would do, and what the chain exists to catch.
    engine = create_engine(db_url)
    with engine.begin() as conn:
        conn.execute(text('UPDATE ledger_blocks SET data = :d WHERE "index" = 0'),
                     {"d": '{"risk_score": 0.0}'})
    engine.dispose()

    assert ledger_client.verify("REC-1")["verified"] is False

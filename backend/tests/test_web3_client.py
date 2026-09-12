"""
On-chain client behaviour, exercised against the real RECRegistry from
contracts/, deployed fresh per test by the `chain` fixture — to a live Hardhat
node when one is running, otherwise to an in-process eth-tester chain.

Tests that assert on revert *classification* take `requires_custom_errors`:
eth-tester destroys custom-error selectors, so they skip without a live node
(cd contracts && npx hardhat node).

These are the tests that decide what HTTP status the API returns for each
on-chain failure, so they assert on the *specific* error type — a test that
only asserted `ChainError` would pass while the API returned 502 for something
that should be a 409.
"""
import warnings
from datetime import datetime, timezone

import pytest
from eth_account import Account

from backend.app import onchain_service
from backend.app.clients import web3_client
from backend.app.schemas import CertificateIssueRequest, Generation, Plant

pytestmark = pytest.mark.chain

RECORD = {
    "plant_id": "PLANT-A",
    "energy_mwh": 100,
    "generation_timestamp": 1_800_000_000,
}


# ---------------------------------------------------------------------------
# Minting


def test_mint_certificate_returns_token_id(chain, recipient):
    result = web3_client.mint_certificate(to_address=recipient, fraud_score=42, **RECORD)

    assert isinstance(result["token_id"], int)
    assert result["tx_hash"].startswith("0x")


def test_mint_emits_no_abi_mismatch_warning(chain, recipient):
    """The receipt carries both Transfer and CertificateIssued logs. Decoding
    it against the Transfer ABI alone made web3 warn about the log it couldn't
    match, on every single mint — noise in the service log that reads like a
    real problem. The client asks web3 to discard non-matching logs instead."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        web3_client.mint_certificate(to_address=recipient, fraud_score=42, **RECORD)

    mismatch_warnings = [w for w in caught if "did not match the provided ABI" in str(w.message)]
    assert mismatch_warnings == []


def test_duplicate_mint_raises_duplicate_record_error(chain, recipient, requires_custom_errors):
    web3_client.mint_certificate(to_address=recipient, fraud_score=10, **RECORD)

    with pytest.raises(web3_client.DuplicateRecordError):
        web3_client.mint_certificate(to_address=Account.create().address, fraud_score=20, **RECORD)


def test_mint_from_unauthorized_wallet_raises_not_authorized(chain, recipient, monkeypatch, requires_custom_errors):
    """The contract's onlyIssuer modifier reverts for any wallet the deployer
    didn't authorize. That's a 403, not a generic chain failure."""
    from backend.app.config import settings

    outsider = Account.create()
    monkeypatch.setattr(settings, "BACKEND_PRIVATE_KEY", outsider.key.hex())
    web3_client._account = None

    # Fund the outsider so the failure is authorization, not an empty balance.
    w3 = web3_client.get_w3()
    w3.eth.send_transaction(
        {"from": w3.eth.accounts[0], "to": outsider.address, "value": w3.to_wei(1, "ether")}
    )

    with pytest.raises(web3_client.NotAuthorizedError):
        web3_client.mint_certificate(to_address=recipient, fraud_score=1, **RECORD)


# ---------------------------------------------------------------------------
# Retirement


def test_retire_by_owner_succeeds(chain):
    issuer_address = chain  # the chain fixture's issuer wallet mints to itself here
    result = web3_client.mint_certificate(to_address=issuer_address, fraud_score=5, **RECORD)

    retire_result = web3_client.retire_certificate(result["token_id"], owner_address=issuer_address)

    assert retire_result["tx_hash"].startswith("0x")
    assert web3_client.get_certificate(result["token_id"])["retired"] is True


def test_retire_by_non_owner_raises_not_authorized(chain, recipient):
    result = web3_client.mint_certificate(to_address=recipient, fraud_score=5, **RECORD)

    with pytest.raises(web3_client.NotAuthorizedError):
        web3_client.retire_certificate(result["token_id"], owner_address=Account.create().address)


def test_retiring_twice_raises_already_retired_not_duplicate_record(chain, requires_custom_errors):
    """A second retire used to be classified as DuplicateRecordError (both
    conditions matched the substring "already") and surfaced as a misleading
    answer. The contract's CertificateAlreadyRetired custom error is now
    decoded by selector, and the API maps it to 409."""
    issuer_address = chain
    result = web3_client.mint_certificate(to_address=issuer_address, fraud_score=5, **RECORD)
    web3_client.retire_certificate(result["token_id"], owner_address=issuer_address)

    with pytest.raises(web3_client.AlreadyRetiredError):
        web3_client.retire_certificate(result["token_id"], owner_address=issuer_address)


def test_retire_unknown_token_raises_not_found(chain, requires_custom_errors):
    with pytest.raises(web3_client.CertificateNotFoundError):
        web3_client.retire_certificate(9999, owner_address=chain)


def test_fraud_score_above_100_raises_invalid_argument(chain, recipient, requires_custom_errors):
    with pytest.raises(web3_client.InvalidArgumentError):
        web3_client.mint_certificate(to_address=recipient, fraud_score=101, **RECORD)


# ---------------------------------------------------------------------------
# Transfers


def test_transfer_moves_ownership(chain, recipient):
    issuer_address = chain
    result = web3_client.mint_certificate(to_address=issuer_address, fraud_score=5, **RECORD)

    transfer = web3_client.transfer_certificate(
        result["token_id"], from_address=issuer_address, to_address=recipient
    )

    assert transfer["tx_hash"].startswith("0x")
    assert transfer["owner"] == recipient
    assert web3_client.get_certificate(result["token_id"])["owner"] == recipient


def test_transfer_of_retired_certificate_is_blocked(chain, recipient, requires_custom_errors):
    issuer_address = chain
    result = web3_client.mint_certificate(to_address=issuer_address, fraud_score=5, **RECORD)
    web3_client.retire_certificate(result["token_id"], owner_address=issuer_address)

    with pytest.raises(web3_client.AlreadyRetiredError):
        web3_client.transfer_certificate(
            result["token_id"], from_address=issuer_address, to_address=recipient
        )


def test_transfer_by_non_owner_raises_not_authorized(chain, recipient):
    result = web3_client.mint_certificate(to_address=recipient, fraud_score=5, **RECORD)

    with pytest.raises(web3_client.NotAuthorizedError):
        web3_client.transfer_certificate(
            result["token_id"], from_address=recipient, to_address=Account.create().address
        )


# ---------------------------------------------------------------------------
# Reads


def test_contract_is_a_real_erc721(chain, recipient):
    """The registry is documented as ERC-721; assert the standard surface
    actually exists rather than trusting the docstring."""
    contract = web3_client.get_contract()
    assert contract.functions.supportsInterface(bytes.fromhex("80ac58cd")).call() is True
    assert contract.functions.name().call() == "REC Observation Network Certificate"
    assert contract.functions.symbol().call() == "RECON"

    web3_client.mint_certificate(to_address=recipient, fraud_score=5, **RECORD)
    assert contract.functions.balanceOf(recipient).call() == 1
    assert contract.functions.totalSupply().call() == 1


def test_get_certificate_returns_onchain_struct(chain, recipient):
    result = web3_client.mint_certificate(to_address=recipient, fraud_score=42, **RECORD)

    cert = web3_client.get_certificate(result["token_id"])

    assert cert["plant_id"] == RECORD["plant_id"]
    assert cert["energy_mwh"] == RECORD["energy_mwh"]
    assert cert["generation_timestamp"] == RECORD["generation_timestamp"]
    assert cert["fraud_score"] == 42
    assert cert["retired"] is False
    assert cert["owner"] == recipient


def test_get_unknown_certificate_raises_certificate_not_found(chain):
    """getCertificate reverts for an unminted tokenId. The client only caught
    web3's ContractLogicError, but eth-tester (and other non-HTTP providers)
    raise their own type for the same revert — so this leaked out as a generic
    error and the API answered 502 instead of 404."""
    with pytest.raises(web3_client.CertificateNotFoundError):
        web3_client.get_certificate(9999)


def test_is_record_used_reflects_minting(chain, recipient):
    assert web3_client.is_record_used(**RECORD) is False

    web3_client.mint_certificate(to_address=recipient, fraud_score=1, **RECORD)

    assert web3_client.is_record_used(**RECORD) is True
    # A different generation record from the same plant is still free.
    assert web3_client.is_record_used(**{**RECORD, "generation_timestamp": 1_800_003_600}) is False


def test_get_backend_address_matches_issuer_wallet(chain):
    assert web3_client.get_backend_address() == chain


# ---------------------------------------------------------------------------
# Configuration failures


def test_missing_contract_address_raises_chain_error(monkeypatch):
    from backend.app.config import settings

    monkeypatch.setattr(settings, "RPC_URL", "eth-tester")
    monkeypatch.setattr(settings, "CONTRACT_ADDRESS", None)
    web3_client._w3 = None
    web3_client._contract = None

    with pytest.raises(web3_client.ChainError, match="CONTRACT_ADDRESS"):
        web3_client.get_contract()

    web3_client._w3 = None
    web3_client._contract = None


def test_missing_private_key_raises_chain_error(monkeypatch):
    from backend.app.config import settings

    monkeypatch.setattr(settings, "RPC_URL", "eth-tester")
    monkeypatch.setattr(settings, "BACKEND_PRIVATE_KEY", None)
    web3_client._w3 = None
    web3_client._account = None

    with pytest.raises(web3_client.ChainError, match="BACKEND_PRIVATE_KEY"):
        web3_client.get_backend_address()

    web3_client._w3 = None
    web3_client._account = None


# ---------------------------------------------------------------------------
# Service layer (on-chain + database)


def test_issue_certificate_rejects_duplicate_before_minting(chain, recipient, db_session, monkeypatch, requires_custom_errors):
    """The duplicate pre-check is a view call that must fire before the risk
    pipeline runs and before any gas is spent."""
    payload = CertificateIssueRequest(
        to_address=recipient,
        plant=Plant(id="PLANT-C", type="wind", capacity_mw=80, lat=21.0, lon=73.0),
        generation=Generation(
            mwh_claimed=120,
            start=datetime(2026, 7, 1, 9, tzinfo=timezone.utc),
            end=datetime(2026, 7, 1, 13, tzinfo=timezone.utc),
        ),
        issuer_id="ISSUER-B",
    )
    onchain_service.issue_certificate(db_session, payload)

    calls = []
    real_assess = onchain_service.assess
    monkeypatch.setattr(
        onchain_service, "assess", lambda p: (calls.append(p), real_assess(p))[1]
    )

    with pytest.raises(web3_client.DuplicateRecordError):
        onchain_service.issue_certificate(db_session, payload)
    assert calls == [], "risk pipeline ran despite a known-duplicate record"


def test_transfer_certificate_updates_offchain_row(chain, recipient, db_session):
    issuer_address = chain
    payload = CertificateIssueRequest(
        to_address=issuer_address,
        plant=Plant(id="PLANT-D", type="solar", capacity_mw=40, lat=22.0, lon=71.0),
        generation=Generation(
            mwh_claimed=60,
            start=datetime(2026, 8, 1, 10, tzinfo=timezone.utc),
            end=datetime(2026, 8, 1, 14, tzinfo=timezone.utc),
        ),
        issuer_id="ISSUER-C",
    )
    issued = onchain_service.issue_certificate(db_session, payload)

    row, tx_hash = onchain_service.transfer_certificate(db_session, issued.token_id, recipient)

    assert tx_hash.startswith("0x")
    assert row.owner_address == recipient
    assert onchain_service.get_certificate(db_session, issued.token_id)["owner_address"] == recipient

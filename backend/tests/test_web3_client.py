"""
On-chain client behaviour, exercised against a real EVM (fixtures/RECRegistry.sol
compiled and deployed to an in-process eth-tester chain by the `chain` fixture).

These are the tests that decide what HTTP status the API returns for each
on-chain failure, so they assert on the *specific* error type — a test that
only asserted `ChainError` would pass while the API returned 502 for something
that should be a 409.
"""
import warnings

import pytest
from eth_account import Account

from backend.app.clients import web3_client

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


def test_duplicate_mint_raises_duplicate_record_error(chain, recipient):
    web3_client.mint_certificate(to_address=recipient, fraud_score=10, **RECORD)

    with pytest.raises(web3_client.DuplicateRecordError):
        web3_client.mint_certificate(to_address=Account.create().address, fraud_score=20, **RECORD)


def test_mint_from_unauthorized_wallet_raises_not_authorized(chain, recipient, monkeypatch):
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


def test_retiring_twice_raises_already_retired_not_duplicate_record(chain):
    """The contract reverts "Already retired". The revert classifier keys off
    the substring "already", which also matches the duplicate-record revert
    ("Record already certified") — so a second retire was being reported as a
    DuplicateRecordError and surfaced as a 502. It is its own condition, and
    the API maps it to 409."""
    issuer_address = chain
    result = web3_client.mint_certificate(to_address=issuer_address, fraud_score=5, **RECORD)
    web3_client.retire_certificate(result["token_id"], owner_address=issuer_address)

    with pytest.raises(web3_client.AlreadyRetiredError):
        web3_client.retire_certificate(result["token_id"], owner_address=issuer_address)


# ---------------------------------------------------------------------------
# Reads


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

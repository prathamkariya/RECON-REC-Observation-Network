from datetime import datetime, timezone

import pytest
from eth_account import Account
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app import onchain_service
from backend.app.clients import web3_client
from backend.app.db import Base
from backend.app.schemas import CertificateIssueRequest, Generation, Plant

RECORD = {
    "plant_id": "PLANT-A",
    "energy_mwh": 100,
    "generation_timestamp": 1_800_000_000,
}


def _recipient() -> str:
    return Account.create().address


def test_mint_certificate_returns_token_id(chain):
    result = web3_client.mint_certificate(
        to_address=_recipient(), fraud_score=42, **RECORD
    )
    assert isinstance(result["token_id"], int)
    assert result["tx_hash"].startswith("0x")


def test_duplicate_mint_raises_duplicate_record_error(chain, requires_custom_errors):
    web3_client.mint_certificate(to_address=_recipient(), fraud_score=10, **RECORD)

    with pytest.raises(web3_client.DuplicateRecordError):
        web3_client.mint_certificate(to_address=_recipient(), fraud_score=20, **RECORD)


def test_retire_by_owner_succeeds(chain):
    issuer_address = chain  # the `chain` fixture's issuer wallet mints to itself here
    result = web3_client.mint_certificate(to_address=issuer_address, fraud_score=5, **RECORD)

    retire_result = web3_client.retire_certificate(result["token_id"], owner_address=issuer_address)
    assert retire_result["tx_hash"].startswith("0x")

    cert = web3_client.get_certificate(result["token_id"])
    assert cert["retired"] is True


def test_retire_twice_raises_already_retired_not_duplicate(chain, requires_custom_errors):
    """Regression: "already retired" used to fall through the revert-string
    classifier's generic "already" branch and surface as DuplicateRecordError,
    which the API maps to 409 "record already certified" — a misleading answer
    for a retire call. Custom-error selectors now distinguish the two."""
    issuer_address = chain
    result = web3_client.mint_certificate(to_address=issuer_address, fraud_score=5, **RECORD)
    web3_client.retire_certificate(result["token_id"], owner_address=issuer_address)

    with pytest.raises(web3_client.AlreadyRetiredError):
        web3_client.retire_certificate(result["token_id"], owner_address=issuer_address)


def test_retire_unknown_token_raises_not_found(chain, requires_custom_errors):
    with pytest.raises(web3_client.CertificateNotFoundError):
        web3_client.retire_certificate(9999, owner_address=chain)


def test_get_unknown_certificate_raises_not_found(chain, requires_custom_errors):
    with pytest.raises(web3_client.CertificateNotFoundError):
        web3_client.get_certificate(9999)


def test_fraud_score_above_100_raises_invalid_argument(chain, requires_custom_errors):
    with pytest.raises(web3_client.InvalidArgumentError):
        web3_client.mint_certificate(to_address=_recipient(), fraud_score=101, **RECORD)


def test_is_record_used_tracks_issuance(chain):
    assert web3_client.is_record_used(**RECORD) is False
    web3_client.mint_certificate(to_address=_recipient(), fraud_score=10, **RECORD)
    assert web3_client.is_record_used(**RECORD) is True
    # a different generation record from the same plant is still free
    assert web3_client.is_record_used(**{**RECORD, "generation_timestamp": 1_800_003_600}) is False


def test_transfer_moves_ownership(chain):
    issuer_address = chain
    new_owner = _recipient()
    result = web3_client.mint_certificate(to_address=issuer_address, fraud_score=5, **RECORD)

    transfer = web3_client.transfer_certificate(
        result["token_id"], from_address=issuer_address, to_address=new_owner
    )
    assert transfer["tx_hash"].startswith("0x")
    assert transfer["owner"] == new_owner
    assert web3_client.get_certificate(result["token_id"])["owner"] == new_owner


def test_transfer_of_retired_certificate_is_blocked(chain, requires_custom_errors):
    issuer_address = chain
    result = web3_client.mint_certificate(to_address=issuer_address, fraud_score=5, **RECORD)
    web3_client.retire_certificate(result["token_id"], owner_address=issuer_address)

    with pytest.raises(web3_client.AlreadyRetiredError):
        web3_client.transfer_certificate(
            result["token_id"], from_address=issuer_address, to_address=_recipient()
        )


def test_transfer_by_non_owner_raises_not_authorized(chain):
    result = web3_client.mint_certificate(to_address=_recipient(), fraud_score=5, **RECORD)

    with pytest.raises(web3_client.NotAuthorizedError):
        web3_client.transfer_certificate(
            result["token_id"], from_address=_recipient(), to_address=_recipient()
        )


def test_contract_is_a_real_erc721(chain):
    """The registry is documented as ERC-721; assert the standard surface
    actually exists rather than trusting the docstring."""
    contract = web3_client.get_contract()
    assert contract.functions.supportsInterface(bytes.fromhex("80ac58cd")).call() is True
    assert contract.functions.name().call() == "REC Observation Network Certificate"
    assert contract.functions.symbol().call() == "RECON"

    owner = _recipient()
    web3_client.mint_certificate(to_address=owner, fraud_score=5, **RECORD)
    assert contract.functions.balanceOf(owner).call() == 1
    assert contract.functions.totalSupply().call() == 1


def test_retire_by_non_owner_raises_not_authorized(chain):
    result = web3_client.mint_certificate(to_address=_recipient(), fraud_score=5, **RECORD)

    with pytest.raises(web3_client.NotAuthorizedError):
        web3_client.retire_certificate(result["token_id"], owner_address=_recipient())


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_get_certificate_merges_onchain_and_offchain_data(chain, db_session):
    payload = CertificateIssueRequest(
        to_address=_recipient(),
        plant=Plant(id="PLANT-B", type="solar", capacity_mw=50, lat=23.0, lon=72.5),
        generation=Generation(
            mwh_claimed=250,
            start=datetime(2026, 6, 1, 10, tzinfo=timezone.utc),
            end=datetime(2026, 6, 1, 14, tzinfo=timezone.utc),
        ),
        issuer_id="ISSUER-A",
    )

    issued = onchain_service.issue_certificate(db_session, payload)
    merged = onchain_service.get_certificate(db_session, issued.token_id)

    # On-chain half (from the deployed test contract).
    assert merged["plant_id"] == "PLANT-B"
    assert merged["energy_mwh"] == 250
    assert merged["fraud_score"] == issued.fraud_score
    assert merged["retired_on_chain"] is False
    assert merged["owner_address"] == payload.to_address

    # Off-chain half (from the database row).
    assert merged["raw_record"]["issuer_id"] == "ISSUER-A"
    assert isinstance(merged["risk_reasons"], list)
    assert merged["explanation"]
    assert merged["status"] == "issued"


def test_issue_certificate_rejects_duplicate_before_minting(chain, requires_custom_errors, db_session, monkeypatch):
    """The duplicate pre-check is a view call that must fire before the risk
    pipeline runs and before any gas is spent."""
    payload = CertificateIssueRequest(
        to_address=_recipient(),
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


def test_transfer_certificate_updates_offchain_row(chain, db_session):
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

    new_owner = _recipient()
    row, tx_hash = onchain_service.transfer_certificate(db_session, issued.token_id, new_owner)
    assert tx_hash.startswith("0x")
    assert row.owner_address == new_owner

    merged = onchain_service.get_certificate(db_session, issued.token_id)
    assert merged["owner_address"] == new_owner

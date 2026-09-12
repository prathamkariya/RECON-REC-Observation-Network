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


def test_duplicate_mint_raises_duplicate_record_error(chain):
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

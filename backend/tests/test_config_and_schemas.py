"""
Configuration parsing and the shape of the public contract.

The config tests matter because every real source is gated on a string-to-bool
read of an env var: a flag that silently parses wrong means a source that
silently never turns on (or, worse, turns on in the wrong environment).
"""
import pytest
from pydantic import ValidationError

from backend.app.config import _bool_env, _list_env
from backend.app.schemas import Certificate, CertificateCreate, LedgerProof


# ---------------------------------------------------------------------------
# Env parsing


@pytest.mark.parametrize("value", ["true", "True", "TRUE", "1", "yes", "on", " true "])
def test_truthy_flag_values_enable_a_source(monkeypatch, value):
    monkeypatch.setenv("SOME_FLAG", value)

    assert _bool_env("SOME_FLAG") is True


@pytest.mark.parametrize("value", ["false", "False", "0", "no", "off", "", "banana"])
def test_anything_else_leaves_a_source_off(monkeypatch, value):
    """Fails closed: an unparseable value must not enable a real source."""
    monkeypatch.setenv("SOME_FLAG", value)

    assert _bool_env("SOME_FLAG") is False


def test_unset_flag_uses_the_default(monkeypatch):
    monkeypatch.delenv("SOME_FLAG", raising=False)

    assert _bool_env("SOME_FLAG") is False
    assert _bool_env("SOME_FLAG", default=True) is True


def test_comma_separated_list_is_split_and_trimmed(monkeypatch):
    monkeypatch.setenv("ORIGINS", "https://a.example, https://b.example ,")

    assert _list_env("ORIGINS", []) == ["https://a.example", "https://b.example"]


def test_blank_list_env_falls_back_to_the_default(monkeypatch):
    monkeypatch.setenv("ORIGINS", "   ")

    assert _list_env("ORIGINS", ["*"]) == ["*"]


def test_database_url_defaults_to_local_sqlite(monkeypatch):
    """The service must run with zero configuration."""
    from backend.app.config import Settings

    monkeypatch.delenv("DATABASE_URL", raising=False)

    assert Settings.DATABASE_URL.startswith("sqlite") or "DATABASE_URL" in str(Settings.DATABASE_URL)


# ---------------------------------------------------------------------------
# Contract validation


def valid_create(**overrides) -> dict:
    body = {
        "certificate_id": "REC-1",
        "plant": {"id": "P", "type": "solar", "capacity_mw": 50.0, "lat": 23.0, "lon": 72.0},
        "generation": {
            "mwh_claimed": 100.0,
            "start": "2026-06-01T10:00:00Z",
            "end": "2026-06-01T14:00:00Z",
        },
        "issuer_id": "I",
        "buyer_id": "B",
    }
    body.update(overrides)
    return body


def test_a_well_formed_payload_validates():
    payload = CertificateCreate(**valid_create())

    assert payload.certificate_id == "REC-1"
    assert payload.transactions == []


def test_missing_required_fields_are_rejected():
    with pytest.raises(ValidationError):
        CertificateCreate(certificate_id="REC-1")


def test_non_numeric_capacity_is_rejected():
    with pytest.raises(ValidationError):
        CertificateCreate(**valid_create(plant={"id": "P", "type": "solar", "capacity_mw": "big",
                                                "lat": 23.0, "lon": 72.0}))


def test_timestamps_are_parsed_into_datetimes():
    payload = CertificateCreate(**valid_create())

    assert payload.generation.start.year == 2026
    assert payload.generation.end.hour == 14


def test_risk_score_above_one_is_rejected():
    """The Certificate contract promises a 0..1 score; a teammate module
    returning 1.4 must fail loudly here rather than reach the dashboard."""
    with pytest.raises(ValidationError):
        Certificate(
            **valid_create(),
            risk_score=1.4,
            risk_reasons=[],
            explanation="x",
            ledger=LedgerProof(hash="a" * 64, prev_hash=None, verified=True),
        )


def test_risk_score_below_zero_is_rejected():
    with pytest.raises(ValidationError):
        Certificate(
            **valid_create(),
            risk_score=-0.1,
            risk_reasons=[],
            explanation="x",
            ledger=LedgerProof(hash="a" * 64, prev_hash=None, verified=True),
        )


def test_ledger_proof_allows_a_null_previous_hash_for_the_genesis_block():
    proof = LedgerProof(hash="a" * 64, verified=True)

    assert proof.prev_hash is None


# ---------------------------------------------------------------------------
# Database session plumbing


def test_get_db_yields_a_session_and_closes_it():
    """The FastAPI dependency every /certificates route depends on."""
    from backend.app.db import get_db

    generator = get_db()
    session = next(generator)

    assert session.is_active
    generator.close()  # runs the finally: block


def test_init_db_creates_the_certificate_table():
    from sqlalchemy import inspect

    from backend.app.db import engine, init_db

    init_db()

    assert "onchain_certificates" in inspect(engine).get_table_names()

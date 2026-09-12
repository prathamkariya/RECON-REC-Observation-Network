"""
Shared test fixtures.

Two things must happen before any `backend.app` module is imported, so they
happen at the top of this file:

1. DATABASE_URL is pointed at a throwaway file. `app/db.py` builds its engine
   at import time from `settings.DATABASE_URL`, so monkeypatching it later is
   too late — without this, importing the app during tests creates/writes the
   developer's real `backend/recon.db`.
2. Every USE_REAL_* flag is forced off. `app/config.py` calls `load_dotenv()`
   at import, so a developer's own `backend/.env` (which may well have real
   sources enabled) would otherwise change what the unit tests assert. Real
   branches are opted into explicitly, per test, via the `real_sources`
   fixture.

`load_dotenv()` does not override variables already present in the
environment, so setting them here wins over backend/.env.
"""
import json
import os
import tempfile
from pathlib import Path

_TEST_DB_PATH = Path(tempfile.gettempdir()) / "recon_pytest.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"
for _flag in ("USE_REAL_ML", "USE_REAL_GRAPH", "USE_REAL_WEATHER", "USE_REAL_EXPLAIN", "USE_REAL_LEDGER"):
    os.environ[_flag] = "false"
os.environ.pop("ANTHROPIC_API_KEY", None)

from datetime import datetime, timezone  # noqa: E402

import pytest  # noqa: E402
from eth_account import Account  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from backend.app import service  # noqa: E402
from backend.app.clients import graph_client, ledger_client, ml_client, web3_client  # noqa: E402
from backend.app.config import settings  # noqa: E402
from backend.app.db import Base, get_db  # noqa: E402
from backend.app.main import app  # noqa: E402
from backend.app.schemas import CertificateCreate, Generation, Plant, Transaction  # noqa: E402

_FIXTURE_SOL = Path(__file__).parent / "fixtures" / "RECRegistry.sol"
_SOLC_VERSION = "0.8.20"

_compiled = None


# ---------------------------------------------------------------------------
# Isolation


@pytest.fixture(autouse=True)
def reset_module_state():
    """The service keeps its certificate store, ledger chain and graph caches
    in module-level globals. Without resetting them, a certificate written by
    one test is visible to the next — tests pass alone and fail as a suite."""
    service._CERT_STORE.clear()
    ledger_client._mock_ledger = ledger_client.InMemoryLedger()
    ledger_client._real_ledger_instance = None
    graph_client._batch_results = None
    graph_client._known_transactions.clear()
    graph_client._known_certificates.clear()
    ml_client._lookup = None
    ml_client._cursor.clear()
    yield
    service._CERT_STORE.clear()


@pytest.fixture(autouse=True)
def mock_sources(monkeypatch):
    """Belt-and-braces on top of the env vars set at import: every source is
    mock unless a test opts in. Keeps assertions about mock behaviour honest
    regardless of the developer's own .env."""
    for flag in ("USE_REAL_ML", "USE_REAL_GRAPH", "USE_REAL_WEATHER", "USE_REAL_EXPLAIN", "USE_REAL_LEDGER"):
        monkeypatch.setattr(settings, flag, False)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", None)


@pytest.fixture
def real_sources(monkeypatch):
    """Opt a test into the real branches. Returns a setter so a test can turn
    on exactly the sources it exercises: `real_sources("ML", "GRAPH")`."""

    def _enable(*names: str):
        for name in names:
            monkeypatch.setattr(settings, f"USE_REAL_{name.upper()}", True)

    return _enable


# ---------------------------------------------------------------------------
# Database / HTTP client


@pytest.fixture
def db_session():
    """In-memory SQLite shared across connections (StaticPool), so the session
    the test holds and the one the request handler uses see the same tables."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client():
    """TestClient with no database wired in — fine for every route that doesn't
    touch the on-chain certificate tables (/recs, /verify, /analytics, ...)."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client_with_db(db_session):
    """TestClient whose `get_db` dependency yields the test's own session, so
    /certificates routes read and write the in-memory database."""

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Domain fixtures


def make_record(**overrides) -> dict:
    """A CertificateCreate-shaped dict: clean solar certificate, midday, well
    under capacity. Tests override only the field under test, so what makes a
    given record suspicious stays visible in the test itself."""
    record = {
        "certificate_id": "REC-1001",
        "plant": {"id": "PLANT-A", "type": "solar", "capacity_mw": 50.0, "lat": 23.03, "lon": 72.58},
        "generation": {
            "mwh_claimed": 100.0,
            "start": datetime(2026, 6, 1, 10, tzinfo=timezone.utc),
            "end": datetime(2026, 6, 1, 14, tzinfo=timezone.utc),
        },
        "issuer_id": "ISSUER-A",
        "buyer_id": "BUYER-B",
        "transactions": [],
    }
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(record.get(key), dict):
            record[key] = {**record[key], **value}
        else:
            record[key] = value
    return record


@pytest.fixture
def clean_record() -> dict:
    return make_record()


@pytest.fixture
def payload_factory():
    """Builds a validated CertificateCreate from the same overrides."""

    def _build(**overrides) -> CertificateCreate:
        raw = make_record(**overrides)
        return CertificateCreate(
            certificate_id=raw["certificate_id"],
            plant=Plant(**raw["plant"]),
            generation=Generation(**raw["generation"]),
            issuer_id=raw["issuer_id"],
            buyer_id=raw["buyer_id"],
            transactions=[
                t if isinstance(t, Transaction) else Transaction(**t) for t in raw["transactions"]
            ],
        )

    return _build


def json_payload(**overrides) -> dict:
    """make_record() with datetimes as ISO strings, for POSTing over HTTP."""
    record = make_record(**overrides)
    record["generation"] = {
        **record["generation"],
        "start": record["generation"]["start"].isoformat(),
        "end": record["generation"]["end"].isoformat(),
    }
    record["transactions"] = [
        {**t, "transfer_timestamp": t["transfer_timestamp"].isoformat()}
        if isinstance(t.get("transfer_timestamp"), datetime)
        else t
        for t in record["transactions"]
    ]
    return record


# ---------------------------------------------------------------------------
# On-chain test harness


def _compile_contract():
    global _compiled
    if _compiled is None:
        import solcx

        solcx.install_solc(_SOLC_VERSION)
        result = solcx.compile_files(
            [str(_FIXTURE_SOL)], output_values=["abi", "bin"], solc_version=_SOLC_VERSION
        )
        contract_data = next(v for k, v in result.items() if k.endswith(":RECRegistry"))
        _compiled = (contract_data["abi"], contract_data["bin"])
    return _compiled


@pytest.fixture
def chain(monkeypatch, tmp_path):
    """Deploys fixtures/RECRegistry.sol to an in-process eth-tester chain and
    points settings at it, so web3_client runs its real code path against a
    real EVM with no Hardhat/Sepolia node. Yields the issuer wallet address."""
    from eth_tester.backends.pyevm.main import get_default_account_keys

    web3_client._w3 = None
    web3_client._contract = None
    web3_client._account = None

    monkeypatch.setattr(settings, "RPC_URL", "eth-tester")
    w3 = web3_client.get_w3()

    issuer_key = get_default_account_keys()[0].to_hex()
    issuer_address = Account.from_key(issuer_key).address

    abi, bytecode = _compile_contract()
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx_hash = Contract.constructor().transact({"from": issuer_address})
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    abi_path = tmp_path / "RECRegistry.json"
    abi_path.write_text(json.dumps({"abi": abi}))

    monkeypatch.setattr(settings, "CONTRACT_ADDRESS", receipt.contractAddress)
    monkeypatch.setattr(settings, "BACKEND_PRIVATE_KEY", issuer_key)
    monkeypatch.setattr(settings, "CONTRACT_ABI_PATH", str(abi_path))

    yield issuer_address

    web3_client._w3 = None
    web3_client._contract = None
    web3_client._account = None


@pytest.fixture
def recipient() -> str:
    """A wallet address that is not the backend issuer wallet."""
    return Account.create().address

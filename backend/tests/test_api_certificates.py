"""
HTTP contract for the on-chain registry: /certificates analyze, issue, list,
read and retire — against a real EVM via the `chain` fixture.

The status-code mapping is the point of most of these: the dashboard's issue
flow distinguishes "already certified" (409) from "chain is down" (502), and
gets neither right if the client's error classification is wrong.
"""
import pytest

pytestmark = pytest.mark.chain


def issue_body(**overrides) -> dict:
    body = {
        "plant": {"id": "PLANT-A", "type": "solar", "capacity_mw": 50.0, "lat": 23.03, "lon": 72.58},
        "generation": {
            "mwh_claimed": 100.0,
            "start": "2026-06-01T10:00:00Z",
            "end": "2026-06-01T14:00:00Z",
        },
        "issuer_id": "ISSUER-A",
    }
    body.update(overrides)
    return body


# ---------------------------------------------------------------------------
# POST /certificates/analyze — scoring only, no chain, no database


def test_analyze_scores_without_minting_anything(client_with_db, chain):
    response = client_with_db.post("/certificates/analyze", json=issue_body())

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"fraud_score", "risk_reasons", "explanation"}
    assert 0 <= body["fraud_score"] <= 100
    assert client_with_db.get("/certificates").json() == []


def test_analyze_flags_an_over_capacity_claim(client_with_db, chain):
    body = client_with_db.post(
        "/certificates/analyze",
        json=issue_body(generation={
            "mwh_claimed": 5000.0,
            "start": "2026-06-01T10:00:00Z",
            "end": "2026-06-01T14:00:00Z",
        }),
    ).json()

    assert body["fraud_score"] > 50
    assert body["risk_reasons"]


def test_analyze_needs_no_wallet_or_rpc_configured(client_with_db, monkeypatch):
    """The analysis step is deliberately chain-free so the frontend can show it
    before the user commits to minting — and so it works with no chain at all."""
    from backend.app.config import settings

    monkeypatch.setattr(settings, "CONTRACT_ADDRESS", None)
    monkeypatch.setattr(settings, "BACKEND_PRIVATE_KEY", None)

    assert client_with_db.post("/certificates/analyze", json=issue_body()).status_code == 200


def test_analyze_rejects_a_malformed_body(client_with_db):
    assert client_with_db.post("/certificates/analyze", json={"issuer_id": "X"}).status_code == 422


# ---------------------------------------------------------------------------
# POST /certificates/issue


def test_issuing_mints_and_persists_a_certificate(client_with_db, chain):
    response = client_with_db.post("/certificates/issue", json=issue_body())

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["token_id"], int)
    assert body["tx_hash"].startswith("0x")
    assert body["status"] == "issued"
    assert body["plant_id"] == "PLANT-A"
    assert body["explanation"]


def test_issuing_without_a_recipient_mints_to_the_backend_wallet(client_with_db, chain):
    """Callers never need a connected wallet just to issue."""
    body = client_with_db.post("/certificates/issue", json=issue_body()).json()

    assert body["owner_address"] == chain


def test_issuing_to_an_explicit_recipient(client_with_db, chain, recipient):
    body = client_with_db.post(
        "/certificates/issue", json=issue_body(to_address=recipient)
    ).json()

    assert body["owner_address"] == recipient


def test_certifying_the_same_generation_record_twice_returns_409(client_with_db, chain):
    """The one rule the chain enforces: a generation record can only be
    certified once. Double-counting is the fraud this whole project exists to
    prevent, so it must not be a generic 502."""
    client_with_db.post("/certificates/issue", json=issue_body())

    response = client_with_db.post("/certificates/issue", json=issue_body())

    assert response.status_code == 409
    assert "already been certified" in response.json()["detail"]


def test_issue_returns_502_when_the_chain_is_unreachable(client_with_db, monkeypatch):
    from backend.app.clients import web3_client

    def _explode(**kwargs):
        raise web3_client.ChainError("connection refused")

    monkeypatch.setattr(web3_client, "mint_certificate", _explode)
    monkeypatch.setattr(web3_client, "get_backend_address", lambda: "0x" + "11" * 20)
    # issue_certificate pre-flights a duplicate check against the chain before minting.
    monkeypatch.setattr(web3_client, "is_record_used", lambda *args: False)

    response = client_with_db.post("/certificates/issue", json=issue_body())

    assert response.status_code == 502


def test_issue_returns_403_when_the_wallet_is_not_an_authorized_issuer(client_with_db, monkeypatch):
    from backend.app.clients import web3_client

    def _explode(**kwargs):
        raise web3_client.NotAuthorizedError("Not an authorized issuer")

    monkeypatch.setattr(web3_client, "mint_certificate", _explode)
    monkeypatch.setattr(web3_client, "get_backend_address", lambda: "0x" + "11" * 20)
    # issue_certificate pre-flights a duplicate check against the chain before minting.
    monkeypatch.setattr(web3_client, "is_record_used", lambda *args: False)

    assert client_with_db.post("/certificates/issue", json=issue_body()).status_code == 403


# ---------------------------------------------------------------------------
# GET /certificates


def test_listing_is_empty_before_anything_is_issued(client_with_db, chain):
    assert client_with_db.get("/certificates").json() == []


def test_listing_returns_issued_certificates(client_with_db, chain):
    client_with_db.post("/certificates/issue", json=issue_body())
    client_with_db.post(
        "/certificates/issue",
        json=issue_body(generation={
            "mwh_claimed": 200.0,
            "start": "2026-06-02T10:00:00Z",
            "end": "2026-06-02T14:00:00Z",
        }),
    )

    body = client_with_db.get("/certificates").json()

    assert len(body) == 2
    assert {row["plant_id"] for row in body} == {"PLANT-A"}
    assert all(row["mint_tx_hash"].startswith("0x") for row in body)


# ---------------------------------------------------------------------------
# GET /certificates/{token_id}


def test_reading_a_certificate_merges_chain_and_database(client_with_db, chain):
    issued = client_with_db.post("/certificates/issue", json=issue_body()).json()

    body = client_with_db.get(f"/certificates/{issued['token_id']}").json()

    # On-chain half
    assert body["plant_id"] == "PLANT-A"
    assert body["retired_on_chain"] is False
    assert body["owner_address"] == chain
    # Off-chain half
    assert body["raw_record"]["issuer_id"] == "ISSUER-A"
    assert body["explanation"]
    assert body["mint_tx_hash"].startswith("0x")


def test_reading_an_unknown_certificate_returns_404(client_with_db, chain):
    response = client_with_db.get("/certificates/9999")

    assert response.status_code == 404


def test_reading_returns_502_when_the_chain_read_fails(client_with_db, chain, monkeypatch):
    """A chain that is down is an upstream failure (502), not a missing
    certificate (404) — the dashboard shows a different thing for each."""
    from backend.app.clients import web3_client

    issued = client_with_db.post("/certificates/issue", json=issue_body()).json()

    def _explode(token_id):
        raise web3_client.ChainError("connection refused")

    monkeypatch.setattr(web3_client, "get_certificate", _explode)

    response = client_with_db.get(f"/certificates/{issued['token_id']}")

    assert response.status_code == 502
    assert "On-chain read failed" in response.json()["detail"]


# ---------------------------------------------------------------------------
# POST /certificates/{token_id}/retire


def test_retiring_a_certificate_owned_by_the_backend_succeeds(client_with_db, chain):
    issued = client_with_db.post("/certificates/issue", json=issue_body()).json()

    response = client_with_db.post(f"/certificates/{issued['token_id']}/retire")

    assert response.status_code == 200
    assert response.json()["status"] == "retired"
    assert client_with_db.get(f"/certificates/{issued['token_id']}").json()["retired_on_chain"] is True


def test_retiring_twice_returns_409_not_502(client_with_db, chain, requires_custom_errors):
    """"Already retired" and "Record already certified" both contain "already",
    so the revert classifier used to report a second retire as a duplicate
    record and the API answered 502."""
    issued = client_with_db.post("/certificates/issue", json=issue_body()).json()
    client_with_db.post(f"/certificates/{issued['token_id']}/retire")

    response = client_with_db.post(f"/certificates/{issued['token_id']}/retire")

    assert response.status_code == 409
    assert "already been retired" in response.json()["detail"]


def test_retiring_a_certificate_the_backend_does_not_own_returns_403(client_with_db, chain, recipient):
    """Minted straight to a user's wallet, the backend can't sign the retire —
    that has to come from the owner's own wallet."""
    issued = client_with_db.post(
        "/certificates/issue", json=issue_body(to_address=recipient)
    ).json()

    response = client_with_db.post(f"/certificates/{issued['token_id']}/retire")

    assert response.status_code == 403


def test_retiring_an_unknown_certificate_returns_404(client_with_db, chain):
    assert client_with_db.post("/certificates/9999/retire").status_code == 404


def test_retiring_returns_502_when_the_chain_is_unreachable(client_with_db, chain, monkeypatch):
    from backend.app.clients import web3_client

    issued = client_with_db.post("/certificates/issue", json=issue_body()).json()

    def _explode(token_id, owner_address):
        raise web3_client.ChainError("connection refused")

    monkeypatch.setattr(web3_client, "retire_certificate", _explode)

    response = client_with_db.post(f"/certificates/{issued['token_id']}/retire")

    assert response.status_code == 502


def test_retiring_a_certificate_missing_from_the_chain_returns_404(client_with_db, chain, monkeypatch):
    from backend.app.clients import web3_client

    issued = client_with_db.post("/certificates/issue", json=issue_body()).json()

    def _explode(token_id, owner_address):
        raise web3_client.CertificateNotFoundError("gone")

    monkeypatch.setattr(web3_client, "retire_certificate", _explode)

    assert client_with_db.post(f"/certificates/{issued['token_id']}/retire").status_code == 404

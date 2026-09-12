"""
HTTP contract for the off-chain pipeline: /recs, /verify, /analytics, and the
service-status root. Asserted through a real TestClient so routing, status
codes and response-model serialisation are all covered.
"""
from backend.tests.conftest import json_payload


# ---------------------------------------------------------------------------
# Service status


def test_health_endpoint_reports_ok(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_reports_which_sources_are_mock_or_real(client):
    body = client.get("/").json()

    assert body["service"] == "RECON Backend API"
    assert set(body["sources"]) == {"ml", "graph", "weather", "explain", "ledger"}
    assert body["sources"]["ml"] == "mock"


def test_cors_allows_the_dashboard_origin(client):
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})

    assert response.headers["access-control-allow-origin"] == "*"


def test_wildcard_cors_does_not_also_allow_credentials(client):
    """"*" plus allow_credentials makes Starlette echo whichever origin asked
    and mark it credentialed — i.e. every site on the internet, not a wildcard.
    The two are mutually exclusive per the CORS spec."""
    response = client.get("/health", headers={"Origin": "http://evil.example"})

    assert "access-control-allow-credentials" not in response.headers


# ---------------------------------------------------------------------------
# POST /recs


def test_posting_a_certificate_returns_201_with_the_full_contract(client):
    response = client.post("/recs", json=json_payload())

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {
        "certificate_id", "plant", "generation", "issuer_id", "buyer_id",
        "risk_score", "risk_reasons", "explanation", "ledger",
    }
    assert set(body["ledger"]) == {"hash", "prev_hash", "verified"}


def test_posted_certificate_is_scored(client):
    body = client.post("/recs", json=json_payload(generation={"mwh_claimed": 500.0})).json()

    assert body["risk_score"] > 0.5
    assert body["risk_reasons"]
    assert body["explanation"]


def test_posting_an_incomplete_certificate_is_rejected(client):
    response = client.post("/recs", json={"certificate_id": "REC-1"})

    assert response.status_code == 422


def test_posting_a_certificate_with_a_bad_field_type_is_rejected(client):
    response = client.post("/recs", json=json_payload(plant={"capacity_mw": "fifty"}))

    assert response.status_code == 422


def test_transactions_are_optional(client):
    payload = json_payload()
    payload.pop("transactions")

    assert client.post("/recs", json=payload).status_code == 201


# ---------------------------------------------------------------------------
# GET /recs


def test_listing_is_empty_before_anything_is_ingested(client):
    assert client.get("/recs").json() == []


def test_listing_returns_ingested_certificates(client):
    client.post("/recs", json=json_payload(certificate_id="REC-1"))
    client.post("/recs", json=json_payload(certificate_id="REC-2"))

    body = client.get("/recs").json()

    assert {c["certificate_id"] for c in body} == {"REC-1", "REC-2"}


def test_fetching_one_certificate_by_id(client):
    client.post("/recs", json=json_payload(certificate_id="REC-42"))

    response = client.get("/recs/REC-42")

    assert response.status_code == 200
    assert response.json()["certificate_id"] == "REC-42"


def test_fetching_an_unknown_certificate_returns_404(client):
    response = client.get("/recs/REC-NOT-THERE")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# GET /verify


def test_verifying_an_untampered_certificate_succeeds(client):
    client.post("/recs", json=json_payload(certificate_id="REC-7"))

    body = client.get("/verify/REC-7").json()

    assert body["certificate_id"] == "REC-7"
    assert body["verified"] is True
    assert len(body["hash"]) == 64


def test_verifying_an_unknown_certificate_returns_404(client):
    assert client.get("/verify/REC-NOT-THERE").status_code == 404


def test_verification_fails_after_the_ledger_is_tampered_with(client):
    """End-to-end tamper evidence, over HTTP: ingest, edit the stored block
    behind the API's back, and the verify endpoint must report it."""
    from backend.app.clients import ledger_client

    client.post("/recs", json=json_payload(certificate_id="REC-9"))
    assert client.get("/verify/REC-9").json()["verified"] is True

    ledger_client.debug_tamper("REC-9", {"risk_score": 0.0})

    assert client.get("/verify/REC-9").json()["verified"] is False


# ---------------------------------------------------------------------------
# GET /analytics/summary


def test_analytics_summary_of_an_empty_service(client):
    body = client.get("/analytics/summary").json()

    assert body["total_certificates"] == 0
    assert body["flagged"] == 0
    assert body["data_sources"]["ml"] == "mock"


def test_analytics_summary_counts_flagged_certificates(client):
    client.post("/recs", json=json_payload(certificate_id="CLEAN"))
    client.post("/recs", json=json_payload(certificate_id="FRAUD", generation={"mwh_claimed": 500.0}))

    body = client.get("/analytics/summary").json()

    assert body["total_certificates"] == 2
    assert body["flagged"] == 1
    assert body["top_reasons"]


# ---------------------------------------------------------------------------
# POST /admin/graph-preload


def test_graph_preload_is_a_safe_noop_when_the_real_graph_is_off(client):
    """Always safe to call — load_dataset.py calls it unconditionally."""
    response = client.post(
        "/admin/graph-preload",
        json={
            "transactions": [
                {
                    "from_party_id": "A",
                    "to_party_id": "B",
                    "certificate_id": "REC-1",
                    "transfer_timestamp": "2026-06-01T15:00:00Z",
                }
            ],
            "certificates": [{"certificate_id": "REC-1", "generator_id": "A"}],
        },
    )

    assert response.status_code == 200
    assert response.json()["preloaded"] == 0


def test_graph_preload_rejects_a_malformed_body(client):
    assert client.post("/admin/graph-preload", json={"transactions": []}).status_code == 422

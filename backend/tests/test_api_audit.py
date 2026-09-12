"""
Auditor chat route. The reply text is Role 2's to produce (Claude, with a
deterministic offline fallback); what's tested here is the router's own job —
the response contract, validation, and which context it hands over.
"""
from backend.tests.conftest import json_payload


def test_chat_returns_the_documented_response_shape(client):
    response = client.post(
        "/audit/chat", json={"certificate_id": "REC-1001", "query": "Why was this flagged?"}
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"certificate_id", "reply"}
    assert body["certificate_id"] == "REC-1001"
    assert isinstance(body["reply"], str) and body["reply"]


def test_chat_answers_without_an_api_key_configured(client):
    """No ANTHROPIC_API_KEY in this environment — the endpoint must still
    answer from the deterministic fallback rather than erroring."""
    response = client.post("/audit/chat", json={"certificate_id": "REC-X", "query": "Explain."})

    assert response.status_code == 200
    assert response.json()["reply"]


def test_chat_uses_a_stored_certificate_as_context(client, monkeypatch):
    """A certificate already ingested through /recs is the best available
    context, and must be preferred over the on-disk dataset."""
    captured = {}

    def _fake_chat(cert_id, query, certs_df, txs_df, signal_lookup=None):
        captured["cert_id"] = cert_id
        captured["rows"] = len(certs_df)
        captured["signals"] = signal_lookup
        return {"certificate_id": cert_id, "reply": "grounded reply"}

    monkeypatch.setattr("backend.app.routers.audit.chat_session", _fake_chat)
    client.post("/recs", json=json_payload(certificate_id="REC-STORED"))

    body = client.post(
        "/audit/chat", json={"certificate_id": "REC-STORED", "query": "Why?"}
    ).json()

    assert body["reply"] == "grounded reply"
    assert captured["cert_id"] == "REC-STORED"
    assert captured["rows"] == 1
    assert "REC-STORED" in captured["signals"]


def test_chat_rejects_a_request_with_no_query(client):
    assert client.post("/audit/chat", json={"certificate_id": "REC-1"}).status_code == 422


def test_chat_rejects_a_request_with_no_certificate_id(client):
    assert client.post("/audit/chat", json={"query": "Why?"}).status_code == 422


def test_chat_is_also_served_on_the_documented_versioned_path(client):
    """docs/api-contract.md advertises /api/v1/audit/chat; both are mounted."""
    response = client.post(
        "/api/v1/audit/chat", json={"certificate_id": "REC-1001", "query": "Why?"}
    )

    assert response.status_code == 200
    assert response.json()["certificate_id"] == "REC-1001"

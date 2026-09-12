"""
ML adapter: capacity-ratio heuristic (mock) and Role 1's precomputed
Isolation Forest handoff (real).
"""
import json

import pytest

from backend.app.clients import ml_client
from backend.tests.conftest import make_record


# ---------------------------------------------------------------------------
# Mock heuristic


def test_clean_certificate_scores_low_with_no_reasons():
    # 100 MWh claimed over 4h from a 50 MW plant = 50% utilisation.
    result = ml_client.predict(make_record())

    assert result["risk_score"] < 0.2
    assert result["reasons"] == []


def test_claim_exceeding_plant_capacity_is_flagged():
    # 500 MWh over 4h from a 50 MW plant — 2.5x the physical maximum.
    result = ml_client.predict(make_record(generation={"mwh_claimed": 500.0}))

    assert result["risk_score"] > 0.5
    assert any("exceeds the plant's" in r for r in result["reasons"])


def test_claim_near_capacity_is_noted_but_not_strongly_flagged():
    # 180 MWh over 4h from a 50 MW plant = 90% utilisation.
    result = ml_client.predict(make_record(generation={"mwh_claimed": 180.0}))

    assert 0.2 <= result["risk_score"] < 0.5
    assert any("close to the plant's capacity" in r for r in result["reasons"])


def test_risk_score_is_always_within_zero_and_one():
    absurd = ml_client.predict(make_record(generation={"mwh_claimed": 10_000_000.0}))

    assert 0.0 <= absurd["risk_score"] <= 1.0


def test_zero_capacity_plant_does_not_divide_by_zero():
    result = ml_client.predict(
        make_record(plant={"capacity_mw": 0.0}, generation={"mwh_claimed": 10.0})
    )

    assert 0.0 <= result["risk_score"] <= 1.0
    assert result["reasons"]


# ---------------------------------------------------------------------------
# Real handoff lookup


def test_real_branch_reads_role1_score_for_a_known_certificate(real_sources):
    real_sources("ML")

    result = ml_client.predict(make_record(certificate_id="CERT000025"))

    # Role 1's tuned Isolation Forest scored this certificate 0.5427.
    assert result["risk_score"] == pytest.approx(0.543, abs=0.001)
    assert any("statistical_risk" in r for r in result["reasons"])


def test_real_branch_falls_back_to_heuristic_for_an_unknown_certificate(real_sources):
    """Anything outside Role 1's 1242-row training set — i.e. any genuinely new
    submission — has no precomputed score and must still get one."""
    real_sources("ML")

    result = ml_client.predict(
        make_record(certificate_id="REC-NEVER-SEEN", generation={"mwh_claimed": 500.0})
    )

    assert result["risk_score"] > 0.5
    assert any("exceeds the plant's" in r for r in result["reasons"])


def test_duplicate_certificate_ids_consume_their_scores_in_order(real_sources, monkeypatch):
    """certificate_id is deliberately non-unique in Role 1's data (duplicate_serial
    clones share one), and the handoff preserves both rows — so the second
    lookup must return the second score, not repeat the first."""
    real_sources("ML")
    monkeypatch.setattr(
        ml_client,
        "_lookup",
        {"CERT-DUP": [0.10, 0.90]},
    )

    first = ml_client.predict(make_record(certificate_id="CERT-DUP"))
    second = ml_client.predict(make_record(certificate_id="CERT-DUP"))
    third = ml_client.predict(make_record(certificate_id="CERT-DUP"))

    assert first["risk_score"] == pytest.approx(0.10)
    assert second["risk_score"] == pytest.approx(0.90)
    # Past the end, the last score is reused rather than raising.
    assert third["risk_score"] == pytest.approx(0.90)


def test_real_branch_falls_back_to_mock_when_handoff_file_is_missing(real_sources, monkeypatch, tmp_path):
    real_sources("ML")
    monkeypatch.setattr(ml_client, "_HANDOFF_PATH", tmp_path / "does-not-exist.json")
    monkeypatch.setattr(ml_client, "_lookup", None)

    result = ml_client.predict(make_record(generation={"mwh_claimed": 500.0}))

    assert result["risk_score"] > 0.5


def test_real_branch_falls_back_to_mock_when_handoff_file_is_corrupt(real_sources, monkeypatch, tmp_path):
    bad = tmp_path / "final_stat_risk.json"
    bad.write_text("{not json")
    real_sources("ML")
    monkeypatch.setattr(ml_client, "_HANDOFF_PATH", bad)
    monkeypatch.setattr(ml_client, "_lookup", None)

    result = ml_client.predict(make_record())

    assert 0.0 <= result["risk_score"] <= 1.0


def test_handoff_file_matches_the_shape_the_adapter_expects():
    """Guards the contract with Role 1: if their export changes shape, this
    fails here rather than silently degrading every score to the mock."""
    rows = json.loads(ml_client._HANDOFF_PATH.read_text())

    assert isinstance(rows, list) and rows
    assert {"certificate_id", "statistical_risk"} <= set(rows[0])
    assert all(0.0 <= float(r["statistical_risk"]) <= 1.0 for r in rows)

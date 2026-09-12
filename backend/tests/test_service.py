"""
Service layer: how the three signals fuse into one risk score, how a
certificate is composed and stored, and what the analytics rollup reports.
"""
from datetime import datetime, timezone

import pytest

from backend.app import service
from backend.app.schemas import Transaction


# ---------------------------------------------------------------------------
# Risk fusion (noisy-OR)


def test_no_signals_means_no_risk():
    assert service._combine_risk(0.0, 0.0, 0.0) == 0.0


def test_a_single_certain_signal_drives_risk_to_one():
    """The reason for noisy-OR over a weighted average: one conclusive signal
    (a 25x capacity overshoot) must not be diluted by two quiet ones."""
    assert service._combine_risk(1.0, 0.0, 0.0) == 1.0


def test_independent_signals_compound():
    # 1 - (0.5 * 0.5) = 0.75 — two medium signals are worse than either alone.
    assert service._combine_risk(0.5, 0.5) == 0.75


def test_combined_risk_never_exceeds_one():
    assert service._combine_risk(0.9, 0.9, 0.9) <= 1.0


def test_out_of_range_inputs_are_clamped():
    """A teammate module returning 1.4 or -0.2 must not produce a risk score
    outside 0..1, which the Certificate schema would reject."""
    assert service._combine_risk(1.4) == 1.0
    assert service._combine_risk(-0.2) == 0.0


def test_combining_is_order_independent():
    assert service._combine_risk(0.3, 0.7) == service._combine_risk(0.7, 0.3)


# ---------------------------------------------------------------------------
# Composition


def test_clean_certificate_is_scored_low_and_stored(payload_factory):
    certificate = service.compose_and_store(payload_factory())

    assert certificate.certificate_id == "REC-1001"
    assert certificate.risk_score < 0.2
    assert certificate.risk_reasons == []
    assert certificate.explanation
    assert certificate.ledger.verified is True
    assert len(certificate.ledger.hash) == 64


def test_over_capacity_certificate_is_scored_high_with_a_reason(payload_factory):
    certificate = service.compose_and_store(payload_factory(generation={"mwh_claimed": 500.0}))

    assert certificate.risk_score > 0.5
    assert any("exceeds the plant's" in r for r in certificate.risk_reasons)


def test_nighttime_solar_claim_is_flagged_by_the_weather_signal(payload_factory):
    certificate = service.compose_and_store(
        payload_factory(
            generation={
                "start": datetime(2026, 6, 1, 2, tzinfo=timezone.utc),
                "end": datetime(2026, 6, 1, 3, tzinfo=timezone.utc),
                "mwh_claimed": 4.2,
            }
        )
    )

    assert certificate.risk_score > 0.9
    assert any("nighttime" in r for r in certificate.risk_reasons)


def test_circular_trade_is_flagged_by_the_graph_signal(payload_factory):
    ts = datetime(2026, 6, 1, 15, tzinfo=timezone.utc)
    certificate = service.compose_and_store(
        payload_factory(
            transactions=[
                Transaction(from_party_id="A", to_party_id="B", transfer_timestamp=ts),
                Transaction(from_party_id="B", to_party_id="C", transfer_timestamp=ts),
                Transaction(from_party_id="C", to_party_id="A", transfer_timestamp=ts),
            ]
        )
    )

    assert certificate.risk_score >= 0.9
    assert any("Circular trading ring" in r for r in certificate.risk_reasons)


def test_multiple_signals_compound_into_a_higher_score_than_any_alone(payload_factory):
    """The pitch's core claim: a fraudster has to beat all three checks at once."""
    over_capacity_only = service.compose_and_store(
        payload_factory(certificate_id="REC-A", generation={"mwh_claimed": 500.0})
    )
    both = service.compose_and_store(
        payload_factory(
            certificate_id="REC-B",
            generation={
                "mwh_claimed": 500.0,
                "start": datetime(2026, 6, 1, 2, tzinfo=timezone.utc),
                "end": datetime(2026, 6, 1, 3, tzinfo=timezone.utc),
            },
        )
    )

    assert both.risk_score > over_capacity_only.risk_score
    assert len(both.risk_reasons) > len(over_capacity_only.risk_reasons)


def test_each_stored_certificate_extends_the_ledger_chain(payload_factory):
    first = service.compose_and_store(payload_factory(certificate_id="REC-1"))
    second = service.compose_and_store(payload_factory(certificate_id="REC-2"))

    assert first.ledger.prev_hash is None
    assert second.ledger.prev_hash == first.ledger.hash


# ---------------------------------------------------------------------------
# Retrieval


def test_get_certificate_returns_none_for_an_unknown_id():
    assert service.get_certificate("REC-NOT-THERE") is None


def test_stored_certificate_can_be_read_back(payload_factory):
    service.compose_and_store(payload_factory())

    found = service.get_certificate("REC-1001")

    assert found is not None
    assert found.certificate_id == "REC-1001"


def test_listing_returns_every_stored_certificate(payload_factory):
    service.compose_and_store(payload_factory(certificate_id="REC-1"))
    service.compose_and_store(payload_factory(certificate_id="REC-2"))

    assert {c.certificate_id for c in service.list_certificates()} == {"REC-1", "REC-2"}


def test_ledger_verification_is_recomputed_on_read_not_frozen_at_write(payload_factory):
    """Tamper-evidence is worthless if a read serves the `verified: true` that
    was computed before the tampering happened."""
    from backend.app.clients import ledger_client

    service.compose_and_store(payload_factory())
    assert service.get_certificate("REC-1001").ledger.verified is True

    ledger_client.debug_tamper("REC-1001", {"risk_score": 0.0})

    assert service.get_certificate("REC-1001").ledger.verified is False


# ---------------------------------------------------------------------------
# Analytics rollup


def test_summary_of_an_empty_store_reports_zeroes():
    summary = service.summary()

    assert summary["total_certificates"] == 0
    assert summary["flagged"] == 0
    assert summary["average_risk_score"] == 0.0
    assert summary["top_reasons"] == []


def test_summary_counts_only_certificates_over_the_flag_threshold(payload_factory):
    service.compose_and_store(payload_factory(certificate_id="CLEAN-1"))
    service.compose_and_store(payload_factory(certificate_id="CLEAN-2"))
    service.compose_and_store(
        payload_factory(certificate_id="FRAUD-1", generation={"mwh_claimed": 500.0})
    )

    summary = service.summary()

    assert summary["total_certificates"] == 3
    assert summary["flagged"] == 1


def test_summary_ranks_the_most_common_reasons_first(payload_factory):
    for i in range(3):
        service.compose_and_store(
            payload_factory(certificate_id=f"OVER-{i}", generation={"mwh_claimed": 500.0})
        )
    service.compose_and_store(payload_factory(certificate_id="SELF-DEAL", issuer_id="X", buyer_id="X"))

    top = service.summary()["top_reasons"]

    assert "exceeds the plant's" in top[0]
    assert len(top) <= 5


def test_summary_reports_which_sources_produced_the_numbers(payload_factory, real_sources):
    """A dashboard reading only /analytics/summary would otherwise have no way
    to tell a fully mocked rollup from a real one."""
    real_sources("ML")
    service.compose_and_store(payload_factory())

    sources = service.summary()["data_sources"]

    assert sources["ml"] == "real"
    assert sources["graph"] == "mock"


def test_average_risk_score_is_the_mean_over_all_certificates(payload_factory):
    service.compose_and_store(payload_factory(certificate_id="A"))
    service.compose_and_store(payload_factory(certificate_id="B", generation={"mwh_claimed": 500.0}))

    certs = service.list_certificates()
    expected = round(sum(c.risk_score for c in certs) / len(certs), 3)

    assert service.summary()["average_risk_score"] == pytest.approx(expected)

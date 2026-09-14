"""
Explainability adapter: auditor-readable text. Mock is a template built from
the merged reasons; the real branch calls Role 2's Claude explainer behind a
hard deadline.
"""
import time

from backend.app.clients import explain_client
from backend.tests.conftest import make_record


def signals(**overrides) -> dict:
    base = {
        "risk_score": 0.0,
        "risk_reasons": [],
        "isolation_forest_score": 0.0,
        "isolation_forest_flag": False,
        "graph_flag": False,
        "graph_risk": 0.0,
        "directly_in_cycle": False,
        "weather_mismatch": False,
        "weather_mismatch_score": 0.0,
        "weather_reason": None,
    }
    return {**base, **overrides}


# ---------------------------------------------------------------------------
# Mock template


def test_clean_certificate_is_described_as_clean():
    text = explain_client.explain(make_record(), signals())

    assert "REC-1001" in text
    assert "no significant fraud indicators" in text


def test_low_risk_certificate_with_a_minor_reason_still_reads_as_clean():
    """Below the 0.2 threshold the certificate is not worth an auditor's time,
    even if a soft reason was attached."""
    text = explain_client.explain(
        make_record(), signals(risk_score=0.1, risk_reasons=["Mildly atypical"])
    )

    assert "no significant fraud indicators" in text


def test_explanation_leads_with_the_first_reason():
    text = explain_client.explain(
        make_record(),
        signals(
            risk_score=0.9,
            risk_reasons=["Claimed generation exceeds capacity", "Circular trading ring detected"],
        ),
    )

    assert "flagged primarily because: Claimed generation exceeds capacity" in text
    assert "Additional signals: Circular trading ring detected" in text


def test_single_reason_produces_no_additional_signals_clause():
    text = explain_client.explain(
        make_record(), signals(risk_score=0.8, risk_reasons=["Circular trading ring detected"])
    )

    assert "flagged primarily because" in text
    assert "Additional signals" not in text


# ---------------------------------------------------------------------------
# Real branch


def test_real_branch_is_skipped_without_an_api_key(real_sources, monkeypatch):
    """USE_REAL_EXPLAIN on but no key configured — must use the template rather
    than attempting a call that can only fail."""
    real_sources("EXPLAIN")
    monkeypatch.setattr(explain_client.settings, "ANTHROPIC_API_KEY", None)

    called = []
    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.llm.explainer",
        type("M", (), {"generate_explanation": staticmethod(lambda *a, **k: called.append(1))}),
    )

    text = explain_client.explain(make_record(), signals())

    assert called == []
    assert "no significant fraud indicators" in text


def test_real_branch_receives_flat_record_and_full_signals(real_sources, monkeypatch):
    """generate_explanation early-exits unless it sees the real signal keys, and
    reads flat certificate fields. Passing only {risk_score, risk_reasons} meant
    it returned None for every certificate and Claude was never actually called."""
    captured = {}

    def _fake_generate(cert, sigs, force_generate=False):
        captured["cert"] = cert
        captured["signals"] = sigs
        captured["force_generate"] = force_generate
        return "Claude's explanation."

    real_sources("EXPLAIN")
    monkeypatch.setattr(explain_client.settings, "ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.llm.explainer",
        type("M", (), {"generate_explanation": staticmethod(_fake_generate)}),
    )

    text = explain_client.explain(make_record(), signals(risk_score=0.9, weather_mismatch=True))

    assert text == "Claude's explanation."
    assert captured["cert"]["energy_source"] == "solar"
    assert captured["cert"]["claimed_mwh"] == 100.0
    assert captured["force_generate"] is True
    assert "weather_mismatch" in captured["signals"]
    assert "isolation_forest_score" in captured["signals"]


def test_a_hanging_explainer_degrades_to_the_template(real_sources, monkeypatch):
    def _hang(cert, sigs, force_generate=False):
        time.sleep(1.0)
        raise AssertionError("should have timed out")

    real_sources("EXPLAIN")
    monkeypatch.setattr(explain_client.settings, "ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(explain_client.settings, "EXPLAIN_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.llm.explainer",
        type("M", (), {"generate_explanation": staticmethod(_hang)}),
    )

    started = time.monotonic()
    text = explain_client.explain(make_record(), signals(risk_score=0.9, risk_reasons=["Over capacity"]))
    elapsed = time.monotonic() - started

    assert elapsed < 0.5, "the deadline must actually bound the request, not just the wait"
    assert "flagged primarily because: Over capacity" in text


def test_an_empty_explainer_result_degrades_to_the_template(real_sources, monkeypatch):
    real_sources("EXPLAIN")
    monkeypatch.setattr(explain_client.settings, "ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.llm.explainer",
        type("M", (), {"generate_explanation": staticmethod(lambda *a, **k: None)}),
    )

    text = explain_client.explain(make_record(), signals(risk_score=0.9, risk_reasons=["Over capacity"]))

    assert "flagged primarily because: Over capacity" in text

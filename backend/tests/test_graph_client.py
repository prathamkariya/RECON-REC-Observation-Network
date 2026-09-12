"""
Graph adapter: trading-ring detection. Mock walks the record's own
transactions; the real branch delegates to Role 2's compute_graph_signal.
"""
from datetime import datetime, timezone

from backend.app.clients import graph_client
from backend.tests.conftest import make_record


def tx(from_party: str, to_party: str) -> dict:
    return {
        "from_party_id": from_party,
        "to_party_id": to_party,
        "transfer_timestamp": datetime(2026, 6, 1, 15, tzinfo=timezone.utc),
    }


# ---------------------------------------------------------------------------
# Mock detection


def test_straight_line_trade_is_not_flagged():
    result = graph_client.analyze(
        make_record(transactions=[tx("ISSUER-A", "BUYER-B"), tx("BUYER-B", "BUYER-C")])
    )

    assert result["graph_flag"] is False
    assert result["graph_risk"] == 0.0
    assert result["reasons"] == []


def test_circular_trade_is_flagged_as_a_ring():
    result = graph_client.analyze(
        make_record(
            transactions=[tx("A", "B"), tx("B", "C"), tx("C", "A")],
        )
    )

    assert result["graph_flag"] is True
    assert result["directly_in_cycle"] is True
    assert result["graph_risk"] == 0.9
    assert any("Circular trading ring" in r for r in result["reasons"])


def test_issuer_selling_to_itself_is_flagged_as_self_dealing():
    result = graph_client.analyze(make_record(issuer_id="PARTY-X", buyer_id="PARTY-X"))

    assert result["graph_flag"] is True
    assert result["graph_risk"] == 0.6
    assert result["directly_in_cycle"] is False
    assert any("same party" in r for r in result["reasons"])


def test_certificate_with_no_transactions_is_not_flagged():
    result = graph_client.analyze(make_record(transactions=[]))

    assert result["graph_flag"] is False
    assert result["graph_risk"] == 0.0


def test_two_party_round_trip_is_flagged():
    """A -> B -> A is the smallest wash-trade shape and must still count."""
    result = graph_client.analyze(make_record(transactions=[tx("A", "B"), tx("B", "A")]))

    assert result["directly_in_cycle"] is True
    assert result["graph_risk"] == 0.9


# ---------------------------------------------------------------------------
# Real branch and preloading


def test_preload_is_skipped_entirely_while_the_real_graph_is_off(monkeypatch):
    """analyze() only reads the batch cache on the real path, so preloading
    with the flag off would run whole-dataset Louvain detection to build a
    result nothing can read. load_dataset.py calls this unconditionally."""
    called = []

    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.graph.fraud_ring",
        type("M", (), {"compute_graph_signal": staticmethod(lambda t, c: called.append(1) or {})}),
    )

    result = graph_client.preload_batch([], [{"certificate_id": "REC-1", "generator_id": "A"}])

    assert result == -1
    assert called == []


def test_preload_caches_every_certificate_when_the_real_graph_is_on(real_sources, monkeypatch):
    real_sources("GRAPH")
    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.graph.fraud_ring",
        type(
            "M",
            (),
            {
                "compute_graph_signal": staticmethod(
                    lambda t, c: {
                        "REC-1": {"graph_flag": True, "graph_risk": 0.7, "directly_in_cycle": False},
                        "REC-2": {"graph_flag": False, "graph_risk": 0.0, "directly_in_cycle": False},
                    }
                )
            },
        ),
    )

    count = graph_client.preload_batch(
        [tx("A", "B")],
        [{"certificate_id": "REC-1", "generator_id": "A"}, {"certificate_id": "REC-2", "generator_id": "B"}],
    )

    assert count == 2
    assert graph_client.analyze(make_record(certificate_id="REC-1"))["graph_risk"] == 0.7


def test_preload_batch_reports_skipped_when_real_module_is_unavailable(real_sources, monkeypatch):
    """Returns -1 (not 0, and not an exception) so the caller can tell
    "nothing to preload" apart from "the real graph module isn't there"."""
    real_sources("GRAPH")
    import builtins

    real_import = builtins.__import__

    def _fail_on_fraud_ring(name, *args, **kwargs):
        if "fraud_ring" in name:
            raise ImportError("networkx missing")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", _fail_on_fraud_ring)

    assert graph_client.preload_batch([], []) == -1


def test_preloaded_results_are_served_without_recomputation(real_sources, monkeypatch):
    """A preloaded certificate must be answered from cache — recomputing
    Louvain per request gets progressively slower and is order-dependent."""
    real_sources("GRAPH")
    monkeypatch.setattr(
        graph_client,
        "_batch_results",
        {"REC-1001": {"graph_flag": True, "graph_risk": 0.85, "directly_in_cycle": True,
                      "cycle_path": ["A", "B", "A"]}},
    )

    calls = []

    def _should_not_be_called(*args, **kwargs):
        calls.append(args)
        raise AssertionError("compute_graph_signal must not run for a preloaded certificate")

    monkeypatch.setattr(
        "graph_explain.graph.fraud_ring.compute_graph_signal", _should_not_be_called, raising=False
    )

    result = graph_client.analyze(make_record(certificate_id="REC-1001"))

    assert calls == []
    assert result["graph_risk"] == 0.85
    assert result["directly_in_cycle"] is True
    assert any("A -> B -> A" in r for r in result["reasons"])


def test_real_branch_passes_generator_id_not_issuer_id(real_sources, monkeypatch):
    """compute_graph_signal keys off `generator_id`. Passing our own contract's
    `issuer_id` name made it read an empty string, so the cycle-through-generator
    check never fired and every certificate scored 0.0."""
    captured = {}

    def _fake_compute(transactions, certificates):
        captured["certificates"] = certificates
        return {"REC-1001": {"graph_flag": False, "graph_risk": 0.0, "directly_in_cycle": False}}

    real_sources("GRAPH")
    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.graph.fraud_ring",
        type("M", (), {"compute_graph_signal": staticmethod(_fake_compute)}),
    )

    graph_client.analyze(make_record(certificate_id="REC-1001", issuer_id="GEN-42"))

    assert captured["certificates"][0]["generator_id"] == "GEN-42"
    assert "issuer_id" not in captured["certificates"][0]


def test_real_branch_falls_back_to_mock_when_compute_raises(real_sources, monkeypatch):
    def _explode(transactions, certificates):
        raise RuntimeError("Role 2's module is broken")

    real_sources("GRAPH")
    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.graph.fraud_ring",
        type("M", (), {"compute_graph_signal": staticmethod(_explode)}),
    )

    result = graph_client.analyze(make_record(transactions=[tx("A", "B"), tx("B", "A")]))

    # Fell through to the mock walk, which still catches the round trip.
    assert result["graph_risk"] == 0.9

"""
Weather adapter: physical plausibility. Mock is a nighttime-solar check; the
real branch delegates to Role 2's Open-Meteo cross-check behind a hard timeout.
"""
from datetime import datetime, timezone

from backend.app.clients import weather_client
from backend.tests.conftest import make_record


def at_hour(hour: int) -> dict:
    return {
        "start": datetime(2026, 6, 1, hour, tzinfo=timezone.utc),
        "end": datetime(2026, 6, 1, hour, tzinfo=timezone.utc).replace(hour=min(hour + 1, 23)),
    }


# ---------------------------------------------------------------------------
# Mock check


def test_midday_solar_generation_is_plausible():
    result = weather_client.check(make_record(generation=at_hour(12)))

    assert result["weather_mismatch"] is False
    assert result["weather_mismatch_score"] == 0.0
    assert result["reason"] is None


def test_solar_generation_claimed_at_2am_is_physically_impossible():
    result = weather_client.check(make_record(generation=at_hour(2)))

    assert result["weather_mismatch"] is True
    assert result["weather_mismatch_score"] > 0.9
    assert "nighttime" in result["reason"]


def test_solar_generation_claimed_at_10pm_is_physically_impossible():
    result = weather_client.check(make_record(generation=at_hour(22)))

    assert result["weather_mismatch"] is True


def test_wind_generation_at_night_is_plausible():
    """Only solar is checked for time-of-day — wind runs around the clock, so
    flagging it would be a false positive."""
    result = weather_client.check(
        make_record(plant={"type": "wind"}, generation=at_hour(2))
    )

    assert result["weather_mismatch"] is False


def test_solar_claiming_zero_generation_at_night_is_not_flagged():
    """Claiming nothing overnight is exactly what a real solar plant reports."""
    result = weather_client.check(
        make_record(generation={**at_hour(2), "mwh_claimed": 0.0})
    )

    assert result["weather_mismatch"] is False


def test_energy_source_matching_is_case_insensitive():
    result = weather_client.check(
        make_record(plant={"type": "SOLAR"}, generation=at_hour(2))
    )

    assert result["weather_mismatch"] is True


# ---------------------------------------------------------------------------
# Real branch


def test_real_branch_receives_the_flat_shape_role2_reads(real_sources, monkeypatch):
    """compute_weather_mismatch reads flat keys (plant_lat, energy_source, ...).
    Passing our nested record never raised — every .get() just missed and
    defaulted, so energy_source became "" and the check silently passed
    everything. This pins the shape so that can't regress."""
    captured = {}

    def _fake_compute(cert):
        captured.update(cert)
        return {"weather_mismatch": True, "weather_mismatch_score": 0.8}

    real_sources("WEATHER")
    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.weather.weather_client",
        type("M", (), {"compute_weather_mismatch": staticmethod(_fake_compute)}),
    )

    result = weather_client.check(make_record())

    assert captured["energy_source"] == "solar"
    assert captured["plant_lat"] == 23.03
    assert captured["plant_lon"] == 72.58
    assert captured["claimed_mwh"] == 100.0
    assert captured["plant_rated_capacity_mwh"] == 50.0
    assert "generation_timestamp" in captured
    assert result["weather_mismatch"] is True
    assert result["weather_mismatch_score"] == 0.8


def test_a_hanging_weather_api_degrades_to_the_heuristic(real_sources, monkeypatch):
    """A slow upstream must never hang the request — the adapter times out and
    answers from the mock instead."""
    import time

    def _hang(cert):
        time.sleep(1.0)
        raise AssertionError("should have timed out")

    real_sources("WEATHER")
    monkeypatch.setattr(weather_client.settings, "WEATHER_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.weather.weather_client",
        type("M", (), {"compute_weather_mismatch": staticmethod(_hang)}),
    )

    started = time.monotonic()
    result = weather_client.check(make_record(generation=at_hour(2)))
    elapsed = time.monotonic() - started

    assert elapsed < 0.5, "the deadline must actually bound the request, not just the wait"
    assert result["weather_mismatch"] is True  # the mock still caught the 2am solar claim
    assert "fallback" in result["reason"] or "nighttime" in result["reason"]


def test_a_failing_weather_api_degrades_to_the_heuristic(real_sources, monkeypatch):
    def _explode(cert):
        raise ConnectionError("Open-Meteo unreachable")

    real_sources("WEATHER")
    monkeypatch.setitem(
        __import__("sys").modules,
        "graph_explain.weather.weather_client",
        type("M", (), {"compute_weather_mismatch": staticmethod(_explode)}),
    )

    result = weather_client.check(make_record(generation=at_hour(12)))

    assert result["weather_mismatch"] is False
    assert "unavailable" in result["reason"]

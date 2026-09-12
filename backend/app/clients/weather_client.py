"""
Adapter for Role 2's weather cross-check: check(record) ->
{"weather_mismatch": bool, "weather_mismatch_score": float, "reason": str|None}.

Mock: flags solar generation claimed during nighttime hours — no Open-Meteo
call required.

Real: imports graph_explain.weather.weather_client.compute_weather_mismatch,
behind USE_REAL_WEATHER, wrapped in a hard timeout. A slow/broken API
degrades to the mock heuristic instead of hanging or crashing the request.

compute_weather_mismatch expects Role 1's flat raw-certificate shape
(plant_lat, plant_lon, energy_source, claimed_mwh, plant_rated_capacity_mwh,
generation_timestamp) -- not our own nested contract (record["plant"]["lat"],
record["generation"]["mwh_claimed"], etc.). Confirmed empirically: passing
our nested record directly (as a prior version of this file did) never
raises -- every .get() call on the flat keys just silently misses and
defaults (energy_source defaults to "", which never matches "solar", so
the entire timing check is skipped every time), making USE_REAL_WEATHER
silently report "no mismatch" for every certificate regardless of input.
_flatten_for_weather_check() below builds the shape the function actually
reads.
"""
from ..config import settings
from ._deadline import call_with_deadline


def _flatten_for_weather_check(record: dict) -> dict:
    plant = record["plant"]
    generation = record["generation"]
    return {
        "plant_lat": plant["lat"],
        "plant_lon": plant["lon"],
        "energy_source": plant["type"],
        "claimed_mwh": generation["mwh_claimed"],
        "plant_rated_capacity_mwh": plant["capacity_mw"],
        "generation_timestamp": generation["start"],
    }

_NIGHTTIME_HOURS = set(range(19, 24)) | set(range(0, 6))  # naive UTC window, mock only


def _mock_check(record: dict) -> dict:
    plant = record["plant"]
    generation = record["generation"]
    is_solar = plant["type"].lower() == "solar"
    start_hour = generation["start"].hour

    if is_solar and start_hour in _NIGHTTIME_HOURS and generation["mwh_claimed"] > 0:
        return {
            "weather_mismatch": True,
            "weather_mismatch_score": 0.95,
            "reason": "Solar generation claimed during nighttime hours (no sunlight available)",
        }
    return {"weather_mismatch": False, "weather_mismatch_score": 0.0, "reason": None}


def _real_check_blocking(record: dict) -> dict:
    from graph_explain.weather.weather_client import compute_weather_mismatch  # teammate's module

    res = compute_weather_mismatch(_flatten_for_weather_check(record))
    mismatch = res.get("weather_mismatch", False)
    score = res.get("weather_mismatch_score", 0.0)
    return {
        "weather_mismatch": bool(mismatch),
        "weather_mismatch_score": float(score),
        "reason": "Weather cross-check flagged a physical implausibility" if mismatch else None,
    }


def check(record: dict) -> dict:
    if not settings.USE_REAL_WEATHER:
        return _mock_check(record)

    try:
        return call_with_deadline(
            _real_check_blocking, record, timeout=settings.WEATHER_TIMEOUT_SECONDS
        )
    except Exception:
        fallback = _mock_check(record)
        fallback["reason"] = fallback["reason"] or "Weather service unavailable — used fallback heuristic"
        return fallback

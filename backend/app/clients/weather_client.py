"""
Adapter for Role 2's weather cross-check: check(record) ->
{"weather_mismatch": bool, "weather_mismatch_score": float, "reason": str|None}.

Mock: flags solar generation claimed during nighttime hours — no Open-Meteo
call required.
Real: imports graph_explain.weather.weather_client (Open-Meteo), behind
USE_REAL_WEATHER, wrapped in a hard timeout. A slow/broken API degrades to
the mock heuristic instead of hanging or crashing the request.
"""
import concurrent.futures

from ..config import settings

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

    mismatch, score = compute_weather_mismatch(record)
    return {
        "weather_mismatch": bool(mismatch),
        "weather_mismatch_score": float(score),
        "reason": "Weather cross-check flagged a physical implausibility" if mismatch else None,
    }


def check(record: dict) -> dict:
    if not settings.USE_REAL_WEATHER:
        return _mock_check(record)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_real_check_blocking, record)
        try:
            return future.result(timeout=settings.WEATHER_TIMEOUT_SECONDS)
        except Exception:
            fallback = _mock_check(record)
            fallback["reason"] = fallback["reason"] or "Weather service unavailable — used fallback heuristic"
            return fallback

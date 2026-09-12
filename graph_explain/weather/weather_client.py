"""
Physical Plausibility Cross-Check (Weather Client) — Role 2, Phase 3.
File: graph_explain/weather/weather_client.py

Two independent signals, fused into one weather_mismatch score:
  1. Capacity plausibility  — claimed_mwh vs plant_rated_capacity_mwh
  2. Timing plausibility    — day/night logic (SOLAR ONLY per §1 of Phase 3 instructions)

Timezone rule (locked decision #1 in docs/schema_data.md):
  generation_timestamp is stored in IST. Read the hour directly for
  all internal day/night comparisons — NO timezone conversion needed internally.
  IST→UTC conversion is applied ONLY at the Open-Meteo API-call boundary.

Confirmed real data distribution this logic is calibrated against:
  - 689 solar, 553 wind certificates
  - Clean solar clusters hours 6–18 (near-zero before 6, tapers to zero after 18)
  - impossible_timing fraud claims generation at 22:06, 22:32, 01:25, 03:03, 00:07 IST
  - over_capacity fraud: e.g. 50.0 claimed vs 27.348 rated (~1.8x), 201.6 vs 49.6 (~4x)
  - Clean wind is uniform 24h — NO day/night check for wind
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Cache — persisted at graph_explain/ root
# ---------------------------------------------------------------------------
CACHE_FILE = os.path.join(os.path.dirname(__file__), "..", "weather_cache.json")


def _load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=2)
    except Exception as e:
        print(f"[WeatherCache] Warning: could not save cache: {e}")


# ---------------------------------------------------------------------------
# Timezone conversion — used ONLY at the API-call boundary
# ---------------------------------------------------------------------------
IST_OFFSET = timedelta(hours=5, minutes=30)


def ist_to_utc(ist_timestamp: datetime) -> datetime:
    """
    Converts a naive IST timestamp (as stored in generation_timestamp) to UTC,
    for the sole purpose of calling an external weather API that expects UTC.

    Do NOT use this for internal day/night logic — the stored IST hour is
    already correct for that per docs/schema_data.md locked decision #1.
    This function exists only at the API-call boundary.
    """
    return ist_timestamp - IST_OFFSET


# ---------------------------------------------------------------------------
# Open-Meteo historical weather client with caching
# ---------------------------------------------------------------------------

def get_historical_weather(lat: float, lon: float, date_utc: datetime) -> dict | None:
    """
    Fetches historical hourly weather for a given lat/lon/date from
    Open-Meteo's archive API. Caches responses locally keyed by
    (rounded lat, rounded lon, date) to avoid re-hitting the API and
    to stay within free-tier rate limits.

    IMPORTANT: date_utc must already be UTC — call ist_to_utc() first.
    This function does NOT perform timezone conversion itself.

    Returns Open-Meteo response dict, or None on any fetch error.
    Fails safe (returns None) — callers must handle None gracefully.
    """
    # Round for cache-key stability — weather doesn't differ meaningfully
    # between e.g. 25.5671 and 25.5673; rounding avoids cache misses on
    # trivially different float coordinates from the same plant.
    cache_key = f"{round(lat, 2)}_{round(lon, 2)}_{date_utc.strftime('%Y-%m-%d')}"
    cache = _load_cache()

    if cache_key in cache:
        return cache[cache_key]

    try:
        response = requests.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params={
                "latitude": lat,
                "longitude": lon,
                "start_date": date_utc.strftime("%Y-%m-%d"),
                "end_date": date_utc.strftime("%Y-%m-%d"),
                # Requesting both solar and wind variables in one call regardless
                # of energy_source — one API call serves any cert on that date,
                # and Open-Meteo charges per request, not per variable.
                "hourly": "cloud_cover,shortwave_radiation,wind_speed_100m",
                "timezone": "UTC",
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        cache[cache_key] = data
        _save_cache(cache)
        return data
    except Exception as exc:
        print(f"[WeatherClient] API fetch failed ({lat:.3f},{lon:.3f} {date_utc.date()}): {exc}")
        return None


def _extract_hourly_values(weather_data: dict, utc_hour: int) -> tuple[Any, Any, Any]:
    """
    Pulls cloud_cover, shortwave_radiation, and wind_speed_100m for a
    specific UTC hour from the Open-Meteo hourly response.
    Returns (None, None, None) if data is missing or malformed — callers
    must handle None to fail safe rather than crashing.
    """
    try:
        hourly = weather_data["hourly"]
        hour_idx = max(0, min(23, utc_hour))
        cloud = hourly.get("cloud_cover", [None])[hour_idx]
        radiation = hourly.get("shortwave_radiation", [None])[hour_idx]
        wind = hourly.get("wind_speed_100m", [None])[hour_idx]
        return cloud, radiation, wind
    except (KeyError, IndexError, TypeError):
        return None, None, None


# ---------------------------------------------------------------------------
# Thresholds — documented and justified against real data distribution
# ---------------------------------------------------------------------------

# Solar day/night boundary:
# Clean solar in this dataset: near-zero before hour 6, ramps from 7,
# peaks 11–12, tapers to zero by 18. Seeded impossible_timing fraud claims:
# 22:06, 22:32, 01:25, 03:03, 00:07 IST — unambiguously outside this window.
SOLAR_DAYLIGHT_START_HOUR = 6
SOLAR_DAYLIGHT_END_HOUR = 18

# Capacity ratio thresholds:
# Real over_capacity fraud: ~1.8x–4x rated. Any ratio > 1.0 is physically
# at-or-above the ceiling. A gradient from 1.0x→2.0x preserves the
# "borderline vs. impossible" distinction the project requires.
CAPACITY_RATIO_SUSPICIOUS_START = 1.0   # at rated capacity: mild concern starts
CAPACITY_RATIO_SUSPICIOUS_SEVERE = 2.0  # 2x rated: treat as maximal evidence


# ---------------------------------------------------------------------------
# Scoring sub-functions
# ---------------------------------------------------------------------------

def _capacity_mismatch_score(claimed_mwh: float, rated_capacity_mwh: float) -> float:
    """
    Returns a 0.0–1.0 gradient score for capacity implausibility.
      0.0 = well within rated capacity
      1.0 = at or beyond the severe-overshoot threshold (2x rated)
    Linear ramp between START and SEVERE — preserves gradient rather than
    a hard boolean cutoff so the explanation layer can distinguish severity.
    """
    if rated_capacity_mwh <= 0:
        return 0.0  # guard against bad/missing capacity data; don't crash
    ratio = claimed_mwh / rated_capacity_mwh
    if ratio <= CAPACITY_RATIO_SUSPICIOUS_START:
        return 0.0
    if ratio >= CAPACITY_RATIO_SUSPICIOUS_SEVERE:
        return 1.0
    return (ratio - CAPACITY_RATIO_SUSPICIOUS_START) / (
        CAPACITY_RATIO_SUSPICIOUS_SEVERE - CAPACITY_RATIO_SUSPICIOUS_START
    )


def _solar_timing_mismatch_score(
    generation_hour_ist: int,
    cloud_cover_pct: float | None,
    shortwave_radiation: float | None,
) -> float:
    """
    Returns a 0.0–1.0 gradient score for solar timing/irradiance implausibility.

    Hard night-time claim → 1.0 (matches the seeded impossible_timing fraud cases).
    Heavy cloud cover during daytime → 0.4 (weaker, gradient evidence — output
    legitimately drops on overcast days so this is NOT a hard flag).
    Clear daylight, no anomaly → 0.0

    generation_hour_ist: read directly from the stored IST timestamp —
    NO timezone conversion, per docs/schema_data.md locked decision #1.
    """
    if (
        generation_hour_ist < SOLAR_DAYLIGHT_START_HOUR
        or generation_hour_ist >= SOLAR_DAYLIGHT_END_HOUR
    ):
        return 1.0  # unambiguous night-time solar claim

    # Within daylight hours: weight by real irradiance if available.
    # shortwave_radiation near 0 during daylight is weak evidence — low
    # output is physically plausible on a genuinely overcast day.
    if shortwave_radiation is None:
        return 0.0  # no data → don't penalise on absence of evidence
    if shortwave_radiation < 50:  # W/m², roughly: very low daytime irradiance
        return 0.4
    return 0.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_weather_data(lat: float, lon: float, date_str: str) -> dict | None:
    """
    Thin adapter kept for backward compatibility with Phase 1 pipeline.py caller.
    date_str must be 'YYYY-MM-DD' in UTC.
    """
    try:
        date_utc = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None
    return get_historical_weather(lat, lon, date_utc)


def compute_weather_mismatch(certificate: dict, weather_data: dict | None = None) -> dict:
    """
    Fuses timing and capacity plausibility into one weather_mismatch signal.

    Accepts an optional pre-fetched weather_data dict (to allow callers to
    reuse one API response across multiple certificates on the same date).
    If weather_data is None, fetches it automatically.

    Input:
      certificate: dict with keys:
        plant_lat, plant_lon, energy_source, claimed_mwh,
        plant_rated_capacity_mwh, generation_timestamp (IST naive datetime or str)

    Output (matches docs/api-contract.md shape exactly):
      { "weather_mismatch": bool, "weather_mismatch_score": float 0.0–1.0 }

    Why max() not average for combining scores: capacity overshoot and timing
    impossibility are independent red flags. Averaging a severe capacity score
    against 0.0 timing would dilute a genuine signal. Either alone should be
    sufficient to drive the score up.
    """
    claimed_mwh = float(certificate.get("claimed_mwh", 0.0))
    rated_mwh = float(
        certificate.get("plant_rated_capacity_mwh",
        certificate.get("capacity_mwh", 1.0))
    )
    energy_source = str(certificate.get("energy_source", "")).lower()
    lat = float(certificate.get("plant_lat", 20.0))
    lon = float(certificate.get("plant_lon", 78.0))

    # 1. Capacity check (universal — applies to both solar and wind)
    capacity_score = _capacity_mismatch_score(claimed_mwh, rated_mwh)

    # 2. Timing check (solar ONLY — confirmed wind is uniform 24h in this dataset)
    timing_score = 0.0
    if energy_source == "solar":
        # Parse generation_timestamp — stored in IST, read hour directly.
        # Do NOT convert to UTC here — that would shift the hour by 5:30 and
        # make a 1 AM IST claim appear to be a 7:30 PM UTC claim.
        ts = certificate.get("generation_timestamp")
        if isinstance(ts, str):
            try:
                dt_ist = datetime.fromisoformat(ts.replace("Z", ""))
            except ValueError:
                dt_ist = datetime.now()
        elif isinstance(ts, datetime):
            dt_ist = ts
        else:
            dt_ist = datetime.now()

        generation_hour_ist = dt_ist.hour  # IST hour — correct per locked decision #1

        # Fetch weather if not pre-provided
        if weather_data is None:
            # Convert to UTC only for the API call
            dt_utc = ist_to_utc(dt_ist.replace(tzinfo=None)
                                 if dt_ist.tzinfo else dt_ist)
            date_str_utc = dt_utc.strftime("%Y-%m-%d")
            weather_data = get_historical_weather(lat, lon,
                                                  datetime.strptime(date_str_utc, "%Y-%m-%d"))

        # Extract weather at the UTC hour corresponding to the IST generation time
        if weather_data is not None:
            dt_ist_naive = dt_ist.replace(tzinfo=None) if dt_ist.tzinfo else dt_ist
            dt_utc_for_hour = ist_to_utc(dt_ist_naive)
            utc_hour = dt_utc_for_hour.hour
            cloud_cover, radiation, _ = _extract_hourly_values(weather_data, utc_hour)
        else:
            cloud_cover, radiation = None, None

        timing_score = _solar_timing_mismatch_score(
            generation_hour_ist, cloud_cover, radiation
        )
    # energy_source == "wind": timing_score stays 0.0
    # (uniform 24h distribution confirmed — applying day/night would generate
    #  false positives on legitimate night-time wind generation)

    combined_score = max(capacity_score, timing_score)

    # Flag logic is asymmetric by intent:
    # - Capacity overshoot: ANY score > 0 means claimed > rated capacity, which
    #   is always physically suspicious regardless of magnitude. Even 1.07x is
    #   not physically achievable — it's not a borderline case, it's a violation.
    # - Timing mismatch: a 0.4 overcast-daytime score is explicitly "weak, gradient
    #   evidence" per Phase 3 instructions — worth noting but NOT a hard flag.
    #   Only score >= 0.5 (night-time claim or severe irradiance mismatch) flags.
    is_capacity_flag = capacity_score > 0.0
    is_timing_flag = timing_score >= 0.5

    return {
        "weather_mismatch": is_capacity_flag or is_timing_flag,
        "weather_mismatch_score": round(combined_score, 4),
    }

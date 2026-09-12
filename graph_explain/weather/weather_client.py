"""
Physical Plausibility Cross-Check (Weather Client) for REC Fraud Detection System (Role 2).
Cross-checks claimed renewable energy generation against physical and meteorological reality:
- Capacity factor sanity check (claimed_mwh vs capacity_mwh)
- Day/Night solar plausibility with timezone-correct solar hour & Open-Meteo historical irradiance
- Wind speed plausibility checks
- Local file caching (weather_cache.json) to respect rate limits
- Graded mismatch scores (0.0 to 1.0) preserving borderline vs impossible distinctions
"""

import os
import json
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Tuple, Optional
import requests

CACHE_FILE = os.path.join(os.path.dirname(__file__), "..", "weather_cache.json")

def _load_cache() -> Dict[str, Any]:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def _save_cache(cache: Dict[str, Any]) -> None:
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=2)
    except Exception as e:
        print(f"[WeatherCache] Warning: Could not save cache: {e}")

IST = timezone(timedelta(hours=5, minutes=30))

def get_local_solar_hour_ist(dt_ist: datetime, lon: float) -> float:
    """
    Computes true solar local time hour (0.0 to 24.0) from IST timestamp and longitude.
    India Standard Meridian is 82.5° East.
    Formula: 1 degree longitude = 4 minutes (1/15 hour) time difference from 82.5°E.
    """
    ist_hours = dt_ist.hour + (dt_ist.minute / 60.0) + (dt_ist.second / 3600.0)
    solar_offset_hours = (lon - 82.5) / 15.0
    solar_hour = (ist_hours + solar_offset_hours) % 24.0
    return solar_hour

def fetch_weather_data(lat: float, lon: float, date_str: str) -> Optional[Dict[str, Any]]:
    """
    Fetches historical weather & solar radiation from Open-Meteo API with local caching.
    Params:
        lat, lon: Plant coordinates
        date_str: 'YYYY-MM-DD'
    """
    cache = _load_cache()
    cache_key = f"{round(lat, 3)}_{round(lon, 3)}_{date_str}"
    if cache_key in cache:
        return cache[cache_key]

    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "start_date": date_str,
        "end_date": date_str,
        "hourly": "shortwave_radiation_instant,direct_normal_irradiance,wind_speed_10m",
        "timezone": "UTC"
    }

    try:
        resp = requests.get(url, params=params, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            cache[cache_key] = data
            _save_cache(cache)
            return data
    except Exception:
        pass

    return None

def compute_weather_mismatch(cert: Dict[str, Any]) -> Dict[str, Any]:
    """
    Cross-checks the physical plausibility of generation claims.
    Supports both 'plant_rated_capacity_mwh' (Role 1 schema) and 'capacity_mwh'.
    Correctly accounts for IST (UTC+5:30) timestamps.
    """
    claimed_mwh = float(cert.get("claimed_mwh", 0.0))
    capacity_mwh = float(cert.get("plant_rated_capacity_mwh", cert.get("capacity_mwh", 1.0)))
    energy_source = str(cert.get("energy_source", "")).lower()
    lat = float(cert.get("plant_lat", 0.0))
    lon = float(cert.get("plant_lon", 0.0))
    ts = cert.get("generation_timestamp")

    # 1. Capacity Factor Impossibility Check (Universal)
    if capacity_mwh > 0 and claimed_mwh > capacity_mwh * 1.02:
        over_ratio = (claimed_mwh / capacity_mwh)
        score = min(1.0, round(0.7 + 0.3 * min(1.0, over_ratio - 1.0), 3))
        return {
            "certificate_id": cert.get("certificate_id"),
            "weather_mismatch": True,
            "weather_mismatch_score": score,
            "reason": f"Claimed generation ({claimed_mwh} MWh) exceeds plant rated capacity ({capacity_mwh} MWh). Physical impossibility."
        }

    # 2. Parse generation timestamp (IST locked decision)
    if isinstance(ts, str):
        try:
            if ts.endswith("Z"):
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(IST)
            else:
                dt = datetime.fromisoformat(ts)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=IST)
        except Exception:
            dt = datetime.now(IST)
    elif isinstance(ts, datetime):
        dt = ts if ts.tzinfo is not None else ts.replace(tzinfo=IST)
    else:
        dt = datetime.now(IST)

    solar_hour = get_local_solar_hour_ist(dt, lon)
    dt_utc = dt.astimezone(timezone.utc)
    date_str = dt_utc.strftime("%Y-%m-%d")

    # 3. Solar Generation Plausibility
    if energy_source == "solar":
        # Deep night in IST (10 PM to 4:59 AM) or solar hour outside daylight envelope
        is_night = (dt.hour in [22, 23, 0, 1, 2, 3, 4]) or (solar_hour < 5.0) or (solar_hour > 20.0)

        if is_night:
            return {
                "certificate_id": cert.get("certificate_id"),
                "weather_mismatch": True,
                "weather_mismatch_score": 1.0,
                "reason": f"Solar generation claimed at local solar time {solar_hour:.1f}:00 hrs ({dt.strftime('%H:%M')} IST nighttime in India). Irradiance is strictly 0 W/m²."
            }

        # For normal daytime capacity factor (<45%), solar generation is fully plausible
        cap_factor = (claimed_mwh / capacity_mwh) if capacity_mwh > 0 else 0
        if cap_factor <= 0.45:
            return {
                "certificate_id": cert.get("certificate_id"),
                "weather_mismatch": False,
                "weather_mismatch_score": 0.0,
                "reason": f"Solar generation ({claimed_mwh} MWh, capacity factor {cap_factor*100:.1f}%) is within expected daytime limits."
            }

        # Try historical irradiance API cross-check for high output claims
        weather_data = fetch_weather_data(lat, lon, date_str)
        if weather_data and "hourly" in weather_data:
            hour_idx = min(23, max(0, dt_utc.hour))
            irradiance = weather_data["hourly"].get("direct_normal_irradiance", [None])[hour_idx]
            if irradiance is not None:
                if irradiance < 20.0 and cap_factor > 0.5:
                    return {
                        "certificate_id": cert.get("certificate_id"),
                        "weather_mismatch": True,
                        "weather_mismatch_score": 0.85,
                        "reason": f"Severe weather mismatch: Claimed {claimed_mwh} MWh during near-zero solar irradiance ({irradiance} W/m² recorded)."
                    }
                elif irradiance < 100.0 and cap_factor > 0.8:
                    return {
                        "certificate_id": cert.get("certificate_id"),
                        "weather_mismatch": True,
                        "weather_mismatch_score": 0.65,
                        "reason": f"Borderline solar mismatch: High claimed output during overcast conditions ({irradiance} W/m²)."
                    }

    # 3. Wind Generation Plausibility
    elif energy_source == "wind":
        weather_data = fetch_weather_data(lat, lon, date_str)
        if weather_data and "hourly" in weather_data:
            hour_idx = min(23, max(0, dt_utc.hour))
            wind_speed = weather_data["hourly"].get("wind_speed_10m", [None])[hour_idx]
            # Standard turbine cut-in speed is 3.0 m/s
            if wind_speed is not None and wind_speed < 1.0 and (claimed_mwh / capacity_mwh) > 0.5:
                return {
                    "certificate_id": cert.get("certificate_id"),
                    "weather_mismatch": True,
                    "weather_mismatch_score": 0.8,
                    "reason": f"Wind mismatch: Wind speed at plant was {wind_speed} m/s (below cut-in threshold), but high output was claimed."
                }

    # If passes all checks
    return {
        "certificate_id": cert.get("certificate_id"),
        "weather_mismatch": False,
        "weather_mismatch_score": 0.0,
        "reason": "Claimed generation is physically plausible and matches meteorological conditions."
    }

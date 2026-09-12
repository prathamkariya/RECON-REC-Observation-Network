"""
Phase 3 validation script for weather_client.py.

Runs all checks from ROLE2_PHASE3_INSTRUCTIONS.md §5 and §6.
Does NOT call the Open-Meteo API — exercises the pure-logic path
(timing and capacity scoring) which is what matters for the DoD.
API call integration is tested separately to avoid burning rate limits.

Run from repo root:
    D:\\apps\\Anaconda\\python.exe graph_explain/tests/validate_phase3.py

Or from graph_explain/:
    D:\\apps\\Anaconda\\python.exe tests/validate_phase3.py
"""

import sys
import os
from datetime import datetime

_HERE = os.path.abspath(os.path.dirname(__file__))
_GRAPH_EXPLAIN = os.path.abspath(os.path.join(_HERE, ".."))
_REPO_ROOT = os.path.abspath(os.path.join(_GRAPH_EXPLAIN, ".."))
for p in [_GRAPH_EXPLAIN, _REPO_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

import pandas as pd
from weather.weather_client import (
    ist_to_utc,
    _capacity_mismatch_score,
    _solar_timing_mismatch_score,
    compute_weather_mismatch,
    SOLAR_DAYLIGHT_START_HOUR,
    SOLAR_DAYLIGHT_END_HOUR,
)

DATA_DIR = os.path.join(_REPO_ROOT, "data")
pass_count = 0
fail_count = 0

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 1: IST→UTC conversion is correct and used ONLY at API boundary
# ─────────────────────────────────────────────────────────────────────────────
print("── CHECK 1: ist_to_utc correctness ───────────────────────────────────")
from datetime import timedelta
ist_1am = datetime(2024, 6, 15, 1, 0, 0)   # 01:00 IST (nighttime fraud case)
utc = ist_to_utc(ist_1am)
expected_utc_hour = 19  # 01:00 IST - 5:30 = 19:30 UTC previous day
# 1:00 - 5:30 = -4:30 → previous day 19:30
assert utc == datetime(2024, 6, 14, 19, 30, 0), f"Expected 2024-06-14 19:30, got {utc}"
# The IST hour (1) is preserved for day/night logic — we DON'T convert for that
assert ist_1am.hour == 1, "IST hour must be read directly, not converted"
print(f"  PASS: 01:00 IST → {utc} UTC (correct, IST hour=1 preserved for day/night logic)")
pass_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 2: Capacity scoring gradient
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 2: Capacity mismatch gradient ───────────────────────────────")
cases = [
    (10.0,  27.0, 0.0,   "well within rated (0.37x)"),
    (27.0,  27.0, 0.0,   "exactly at rated (1.0x) — boundary, score=0"),
    (27.5,  27.0, None,  "just over (1.019x) — small positive score"),
    (40.0,  27.0, None,  "1.48x rated — mid-gradient"),
    (50.0,  27.348, None,"~1.83x — real over_capacity example from data"),
    (54.0,  27.0, 1.0,   "exactly 2x — max score"),
    (201.6, 49.6, 1.0,   "~4.06x — real over_capacity wind example from data"),
]
all_ok = True
for claimed, rated, expected, label in cases:
    score = _capacity_mismatch_score(claimed, rated)
    if expected is not None:
        match = abs(score - expected) < 1e-6
        if not match:
            print(f"  FAIL [{label}]: expected {expected}, got {score:.4f}")
            all_ok = False
        else:
            print(f"  OK   [{label}]: score={score:.4f}")
    else:
        in_range = 0.0 < score < 1.0
        if not in_range:
            print(f"  FAIL [{label}]: expected gradient (0,1) but got {score:.4f}")
            all_ok = False
        else:
            print(f"  OK   [{label}]: score={score:.4f} (gradient)")

if all_ok:
    print("  PASS: Capacity gradient correct")
    pass_count += 1
else:
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 3: Solar timing scoring (nighttime=1.0, daytime cloudy=0.4, clear=0.0)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 3: Solar timing mismatch scoring ────────────────────────────")
timing_cases = [
    (22, None, None, 1.0,  "22:xx IST — real impossible_timing example"),
    (1,  None, None, 1.0,  "01:xx IST — real impossible_timing example"),
    (3,  None, None, 1.0,  "03:xx IST — real impossible_timing example"),
    (0,  None, None, 1.0,  "00:xx IST — real impossible_timing example"),
    (12, None, 500,  0.0,  "12:xx IST, good irradiance — clean daytime"),
    (10, None, 30,   0.4,  "10:xx IST, low irradiance — overcast, mild flag"),
    (10, None, None, 0.0,  "10:xx IST, no weather data — don't penalise"),
    (5,  None, None, 1.0,  "05:xx IST — just before SOLAR_DAYLIGHT_START_HOUR=6"),
    (18, None, None, 1.0,  "18:xx IST — SOLAR_DAYLIGHT_END_HOUR (exclusive)"),
    (17, None, 100, 0.0,   "17:xx IST, adequate irradiance — clean"),
]
all_ok = True
for hour, cloud, radiation, expected, label in timing_cases:
    score = _solar_timing_mismatch_score(hour, cloud, radiation)
    match = abs(score - expected) < 1e-6
    if not match:
        print(f"  FAIL [{label}]: expected {expected}, got {score:.4f}")
        all_ok = False
    else:
        print(f"  OK   [{label}]: score={score:.4f}")

if all_ok:
    print("  PASS: Solar timing scoring correct")
    pass_count += 1
else:
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 4: Wind certs at night NEVER get flagged on timing
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 4: Wind certs at night — timing_score must stay 0.0 ─────────")
night_hours = [0, 1, 2, 3, 22, 23]
wind_fails = []
for h in night_hours:
    cert = {
        "energy_source": "wind",
        "claimed_mwh": 10.0,
        "plant_rated_capacity_mwh": 50.0,
        "plant_lat": 22.0,
        "plant_lon": 80.0,
        "generation_timestamp": datetime(2024, 6, 15, h, 0, 0),
    }
    # Pass empty weather_data dict to avoid real API call
    result = compute_weather_mismatch(cert, weather_data={})
    if result["weather_mismatch"]:
        wind_fails.append(h)
        print(f"  FAIL: Wind cert at {h:02d}:00 IST flagged (score={result['weather_mismatch_score']})")
    else:
        print(f"  OK   wind hour={h:02d}: score={result['weather_mismatch_score']:.4f} (not flagged)")

if wind_fails:
    fail_count += 1
else:
    print("  PASS: No wind night certs falsely flagged on timing")
    pass_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 5: impossible_timing recall on real data (no API — timing only)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 5: impossible_timing recall on real data ────────────────────")
certs_df = pd.read_csv(os.path.join(DATA_DIR, "certificates.csv"),
                       parse_dates=["generation_timestamp"])
impossible = certs_df[certs_df["fraud_type"] == "impossible_timing"]
missed = []
for _, row in impossible.iterrows():
    cert = row.to_dict()
    # Pass empty weather dict — timing fraud is caught by hour check alone,
    # no API call needed. This avoids burning rate limits during validation.
    result = compute_weather_mismatch(cert, weather_data={})
    if not result["weather_mismatch"]:
        missed.append({
            "id": row["certificate_id"],
            "hour": row["generation_timestamp"].hour,
            "source": row["energy_source"],
            "score": result["weather_mismatch_score"],
        })

total = len(impossible)
caught = total - len(missed)
if missed:
    print(f"  FAIL: {caught}/{total} caught. Missed certs:")
    for m in missed[:5]:
        print(f"    {m}")
    fail_count += 1
else:
    print(f"  PASS: {caught}/{total} impossible_timing certs correctly flagged")
    pass_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 6: over_capacity recall on real data (no API needed)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 6: over_capacity recall on real data ────────────────────────")
overcap = certs_df[certs_df["fraud_type"] == "over_capacity"]
missed_cap = []
for _, row in overcap.iterrows():
    cert = row.to_dict()
    result = compute_weather_mismatch(cert, weather_data={})
    if not result["weather_mismatch"]:
        ratio = row["claimed_mwh"] / row["plant_rated_capacity_mwh"]
        missed_cap.append({
            "id": row["certificate_id"],
            "ratio": round(ratio, 3),
            "score": result["weather_mismatch_score"],
        })

total_cap = len(overcap)
caught_cap = total_cap - len(missed_cap)
if missed_cap:
    print(f"  FAIL: {caught_cap}/{total_cap} caught. Missed (check threshold):")
    for m in missed_cap[:5]:
        print(f"    {m}")
    fail_count += 1
else:
    print(f"  PASS: {caught_cap}/{total_cap} over_capacity certs correctly flagged")
    pass_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 7: Output shape matches API contract
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 7: API contract shape ───────────────────────────────────────")
sample_cert = {
    "energy_source": "solar",
    "claimed_mwh": 5.0,
    "plant_rated_capacity_mwh": 10.0,
    "plant_lat": 22.0,
    "plant_lon": 80.0,
    "generation_timestamp": datetime(2024, 6, 15, 12, 0, 0),
}
result = compute_weather_mismatch(sample_cert, weather_data={})
required_keys = {"weather_mismatch", "weather_mismatch_score"}
shape_ok = (
    required_keys == set(result.keys())
    and isinstance(result["weather_mismatch"], bool)
    and isinstance(result["weather_mismatch_score"], float)
    and 0.0 <= result["weather_mismatch_score"] <= 1.0
)
if shape_ok:
    print(f"  PASS: Shape correct — {result}")
    pass_count += 1
else:
    print(f"  FAIL: Shape mismatch — got {result}")
    fail_count += 1

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 8: Gradient — mock borderline cert scores between 0.0 and 1.0
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CHECK 8: Gradient values (not just 0.0 or 1.0) ───────────────────")
# Overcast daytime solar: timing score 0.4, capacity fine → gradient but NOT flagged
# This validates that 0.4 cloudy-day evidence is preserved without triggering a hard flag.
# (A capacity borderline cert at 1.4x WOULD be flagged since any capacity overshoot flags.)
overcast_daytime = {
    "energy_source": "solar",
    "claimed_mwh": 5.0,             # well within rated — no capacity issue
    "plant_rated_capacity_mwh": 10.0,
    "plant_lat": 22.0,
    "plant_lon": 80.0,
    "generation_timestamp": datetime(2024, 6, 15, 10, 0, 0),  # 10 AM IST — daytime
}
# Simulate overcast weather data: low shortwave_radiation triggers 0.4 timing score
overcast_weather = {
    "hourly": {
        "cloud_cover":         [90]*24,
        "shortwave_radiation": [20]*24,   # < 50 W/m² → timing score = 0.4
        "wind_speed_100m":     [5]*24,
    }
}
r = compute_weather_mismatch(overcast_daytime, weather_data=overcast_weather)
score_ok = abs(r["weather_mismatch_score"] - 0.4) < 1e-4
not_flagged = not r["weather_mismatch"]  # 0.4 timing score should NOT flag (< 0.5 threshold)
if score_ok and not_flagged:
    print(f"  PASS: Overcast daytime score={r['weather_mismatch_score']:.4f}, flagged={r['weather_mismatch']} (gradient preserved, not hard-flagged)")
    pass_count += 1
else:
    print(f"  FAIL: Expected score=0.4, flagged=False — got score={r['weather_mismatch_score']}, flagged={r['weather_mismatch']}")
    fail_count += 1


# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"Phase 3 validation: {pass_count} PASSED, {fail_count} FAILED")
if fail_count == 0:
    print("ALL PHASE 3 CHECKS PASSED (no API calls needed) ✓")
else:
    print("SOME CHECKS FAILED — review output above")
print("="*60)

sys.exit(0 if fail_count == 0 else 1)

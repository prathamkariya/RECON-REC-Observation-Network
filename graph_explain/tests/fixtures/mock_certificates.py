"""
Phase 1 Mock Fixture Set -- 8 hand-crafted records covering every required case.
All coordinates are within India's territory (locked decision: no conversion needed).
Timestamps are in IST (locked decision from docs/schema_data.md).

Expected-output notes are written alongside each record BEFORE any detection
logic -- this is the test spec that Phase 2/3 must satisfy.

Schema fields match docs/data-schema.md exactly:
  certificate_id, generator_id, plant_lat, plant_lon, generation_timestamp,
  energy_source, claimed_mwh, plant_rated_capacity_mwh

NOTE: certificate_id is NOT assumed unique (see duplicate-serial case).
Disambiguation key: (certificate_id, generator_id, generation_timestamp).
"""

from typing import List, Dict, Any

# CASE 1 - Clean solar certificate (linear chain, plausible daytime output)
# Expected: graph_flag=False, graph_risk~0.0, weather_mismatch=False, score~0.0
_CERT_CLEAN_SOLAR: Dict[str, Any] = {
    "certificate_id": "REC-MOCK-CLEAN-001",
    "generator_id": "GEN_JAIPUR_SOLAR_01",
    "plant_lat": 26.9124,
    "plant_lon": 75.7873,
    "generation_timestamp": "2026-05-15T09:00:00+05:30",
    "energy_source": "solar",
    "claimed_mwh": 42.5,
    "plant_rated_capacity_mwh": 100.0,
    "_expected_graph_flag": False,
    "_expected_weather_mismatch": False,
    "_expected_explanation": None,
}

# CASE 2 - Clean wind certificate (linear chain, plausible output)
# Expected: graph_flag=False, graph_risk~0.0, weather_mismatch=False, score~0.0
_CERT_CLEAN_WIND: Dict[str, Any] = {
    "certificate_id": "REC-MOCK-CLEAN-002",
    "generator_id": "GEN_KANYAKUMARI_WIND_01",
    "plant_lat": 8.0883,
    "plant_lon": 77.5385,
    "generation_timestamp": "2026-06-20T14:00:00+05:30",
    "energy_source": "wind",
    "claimed_mwh": 28.0,
    "plant_rated_capacity_mwh": 80.0,
    "_expected_graph_flag": False,
    "_expected_weather_mismatch": False,
    "_expected_explanation": None,
}

# CASE 3 - Circular trading ring: PARTY_A->PARTY_B->PARTY_C->PARTY_A
# Transaction chain: GEN_RING_01 -> PARTY_A -> PARTY_B -> PARTY_C -> PARTY_A
# Expected: graph_flag=True, graph_risk>=0.85, directly_in_cycle=True
_CERT_RING: Dict[str, Any] = {
    "certificate_id": "REC-MOCK-RING-001",
    "generator_id": "GEN_RING_01",
    "plant_lat": 31.1048,
    "plant_lon": 77.1734,
    "generation_timestamp": "2026-05-18T10:00:00+05:30",
    "energy_source": "hydro",
    "claimed_mwh": 35.0,
    "plant_rated_capacity_mwh": 50.0,
    "_expected_graph_flag": True,
    "_expected_graph_risk_min": 0.85,
    "_expected_weather_mismatch": False,
    "_expected_explanation_contains": "circular",
}

# CASE 4 - Physically-impossible: solar at 2 AM IST (deep night).
# solar_hour ~= 2 AM local -- strictly zero irradiance.
# Expected: weather_mismatch=True, weather_mismatch_score=1.0
_CERT_SOLAR_NIGHT: Dict[str, Any] = {
    "certificate_id": "REC-MOCK-NIGHT-001",
    "generator_id": "GEN_AHMEDABAD_SOLAR_01",
    "plant_lat": 23.0225,
    "plant_lon": 72.5714,
    "generation_timestamp": "2026-07-10T02:00:00+05:30",
    "energy_source": "solar",
    "claimed_mwh": 48.0,
    "plant_rated_capacity_mwh": 100.0,
    "_expected_graph_flag": False,
    "_expected_weather_mismatch": True,
    "_expected_weather_mismatch_score": 1.0,
    "_expected_explanation_contains": ["night", "irradiance"],
}

# CASE 5 - Over-capacity: claimed_mwh (35) >> plant_rated_capacity_mwh (10)
# Ratio = 3.5x -- physical impossibility (capacity factor > 100%).
# Expected: weather_mismatch=True, weather_mismatch_score>=0.7
_CERT_OVERCAP: Dict[str, Any] = {
    "certificate_id": "REC-MOCK-OVERCAP-001",
    "generator_id": "GEN_PUNE_SOLAR_01",
    "plant_lat": 18.5204,
    "plant_lon": 73.8567,
    "generation_timestamp": "2026-05-15T10:00:00+05:30",
    "energy_source": "solar",
    "claimed_mwh": 35.0,
    "plant_rated_capacity_mwh": 10.0,
    "_expected_graph_flag": False,
    "_expected_weather_mismatch": True,
    "_expected_weather_mismatch_score_min": 0.7,
    "_expected_explanation_contains": "capacity",
}

# CASE 6 - Duplicate serial: same certificate_id, two separate generator origins.
# Both chains are clean linear chains -- no cycle, no overcap.
# Key rule: do NOT assume unique certificate_id.
# Expected: BOTH certificates evaluate independently without triggering flags.
_CERT_DUPE_A: Dict[str, Any] = {
    "certificate_id": "REC-MOCK-DUPE-001",
    "generator_id": "GEN_DUPE_LEGITIMATE",
    "plant_lat": 12.9716,
    "plant_lon": 77.5946,
    "generation_timestamp": "2026-04-10T11:00:00+05:30",
    "energy_source": "solar",
    "claimed_mwh": 20.0,
    "plant_rated_capacity_mwh": 60.0,
    "_expected_graph_flag": False,
    "_expected_weather_mismatch": False,
    "_note": "Duplicate serial pair: legitimate origin -- should evaluate as clean.",
}

_CERT_DUPE_B: Dict[str, Any] = {
    "certificate_id": "REC-MOCK-DUPE-001",
    "generator_id": "GEN_DUPE_FRAUDULENT",
    "plant_lat": 22.5726,
    "plant_lon": 88.3639,
    "generation_timestamp": "2026-04-10T11:05:00+05:30",
    "energy_source": "solar",
    "claimed_mwh": 20.0,
    "plant_rated_capacity_mwh": 60.0,
    "_expected_graph_flag": False,
    "_expected_weather_mismatch": False,
    "_note": "Duplicate serial pair: cloned chain -- Role 2 evaluates each independently.",
}

# CASE 7 - Borderline: solar at 7:30 AM IST, 60% capacity factor.
# Tests whether scoring produces a gradient NOT a hard 0 or 1.
# Expected: weather_mismatch=False (plausible), score < 0.5
_CERT_BORDERLINE: Dict[str, Any] = {
    "certificate_id": "REC-MOCK-BORDERLINE-001",
    "generator_id": "GEN_BHOPAL_SOLAR_01",
    "plant_lat": 23.2599,
    "plant_lon": 77.4126,
    "generation_timestamp": "2026-05-20T07:30:00+05:30",
    "energy_source": "solar",
    "claimed_mwh": 54.0,
    "plant_rated_capacity_mwh": 90.0,
    "_expected_graph_flag": False,
    "_expected_weather_mismatch": False,
    "_expected_weather_mismatch_score_max": 0.5,
    "_note": "Borderline gradient case -- score should be moderate, not hard flag.",
}

# CASE 8 - Edge case: Only 1 transaction for this certificate.
# With only 1 edge (A->B), simple_cycles cannot find a cycle.
# Expected: graph_flag=False, graph_risk~0.0
_CERT_SHORT_CHAIN: Dict[str, Any] = {
    "certificate_id": "REC-MOCK-SHORT-001",
    "generator_id": "GEN_SHORT_01",
    "plant_lat": 25.3176,
    "plant_lon": 82.9739,
    "generation_timestamp": "2026-05-25T08:00:00+05:30",
    "energy_source": "solar",
    "claimed_mwh": 15.0,
    "plant_rated_capacity_mwh": 50.0,
    "_expected_graph_flag": False,
    "_expected_graph_risk_max": 0.35,
    "_note": "Only 1 transaction (generator->buyer). Mathematically no cycle possible.",
}


MOCK_CERTIFICATES: List[Dict[str, Any]] = [
    _CERT_CLEAN_SOLAR,
    _CERT_CLEAN_WIND,
    _CERT_RING,
    _CERT_SOLAR_NIGHT,
    _CERT_OVERCAP,
    _CERT_DUPE_A,
    _CERT_DUPE_B,
    _CERT_BORDERLINE,
    _CERT_SHORT_CHAIN,
]

MOCK_TRANSACTIONS: List[Dict[str, Any]] = [
    # CASE 1 - Clean solar: linear chain, no cycle
    {"from_party_id": "GEN_JAIPUR_SOLAR_01", "to_party_id": "TRD_ALPHA",     "certificate_id": "REC-MOCK-CLEAN-001",     "transfer_timestamp": "2026-05-15T09:30:00+05:30"},
    {"from_party_id": "TRD_ALPHA",           "to_party_id": "UTL_DELHI_01",   "certificate_id": "REC-MOCK-CLEAN-001",     "transfer_timestamp": "2026-05-15T11:00:00+05:30"},
    # CASE 2 - Clean wind: linear chain, no cycle
    {"from_party_id": "GEN_KANYAKUMARI_WIND_01", "to_party_id": "TRD_BETA",    "certificate_id": "REC-MOCK-CLEAN-002",   "transfer_timestamp": "2026-06-20T15:00:00+05:30"},
    {"from_party_id": "TRD_BETA",               "to_party_id": "UTL_MUMBAI_01","certificate_id": "REC-MOCK-CLEAN-002",   "transfer_timestamp": "2026-06-20T17:00:00+05:30"},
    # CASE 3 - Ring: PARTY_A->PARTY_B->PARTY_C->PARTY_A (origin rule: GEN_RING_01 first)
    {"from_party_id": "GEN_RING_01", "to_party_id": "PARTY_A", "certificate_id": "REC-MOCK-RING-001", "transfer_timestamp": "2026-05-18T08:00:00+05:30"},
    {"from_party_id": "PARTY_A",     "to_party_id": "PARTY_B", "certificate_id": "REC-MOCK-RING-001", "transfer_timestamp": "2026-05-18T09:00:00+05:30"},
    {"from_party_id": "PARTY_B",     "to_party_id": "PARTY_C", "certificate_id": "REC-MOCK-RING-001", "transfer_timestamp": "2026-05-18T10:00:00+05:30"},
    {"from_party_id": "PARTY_C",     "to_party_id": "PARTY_A", "certificate_id": "REC-MOCK-RING-001", "transfer_timestamp": "2026-05-18T11:00:00+05:30"},
    # CASE 4 - Night solar: single transfer
    {"from_party_id": "GEN_AHMEDABAD_SOLAR_01", "to_party_id": "UTL_AHMEDABAD_01", "certificate_id": "REC-MOCK-NIGHT-001",    "transfer_timestamp": "2026-07-10T02:30:00+05:30"},
    # CASE 5 - Over-capacity: single transfer
    {"from_party_id": "GEN_PUNE_SOLAR_01", "to_party_id": "UTL_PUNE_01", "certificate_id": "REC-MOCK-OVERCAP-001", "transfer_timestamp": "2026-05-15T10:30:00+05:30"},
    # CASE 6 - Duplicate serial: two independent chains for same cert_id
    {"from_party_id": "GEN_DUPE_LEGITIMATE",  "to_party_id": "TRD_GAMMA",   "certificate_id": "REC-MOCK-DUPE-001", "transfer_timestamp": "2026-04-10T11:30:00+05:30"},
    {"from_party_id": "TRD_GAMMA",            "to_party_id": "UTL_BLR_01",  "certificate_id": "REC-MOCK-DUPE-001", "transfer_timestamp": "2026-04-10T13:00:00+05:30"},
    {"from_party_id": "GEN_DUPE_FRAUDULENT",  "to_party_id": "TRD_DELTA",   "certificate_id": "REC-MOCK-DUPE-001", "transfer_timestamp": "2026-04-10T11:35:00+05:30"},
    {"from_party_id": "TRD_DELTA",            "to_party_id": "UTL_CHN_01",  "certificate_id": "REC-MOCK-DUPE-001", "transfer_timestamp": "2026-04-10T13:05:00+05:30"},
    # CASE 7 - Borderline: single clean chain
    {"from_party_id": "GEN_BHOPAL_SOLAR_01", "to_party_id": "TRD_EPSILON",    "certificate_id": "REC-MOCK-BORDERLINE-001", "transfer_timestamp": "2026-05-20T08:00:00+05:30"},
    {"from_party_id": "TRD_EPSILON",         "to_party_id": "UTL_BHOPAL_01", "certificate_id": "REC-MOCK-BORDERLINE-001", "transfer_timestamp": "2026-05-20T10:00:00+05:30"},
    # CASE 8 - Short chain: exactly 1 edge -- cannot form cycle
    {"from_party_id": "GEN_SHORT_01", "to_party_id": "UTL_VARANASI_01", "certificate_id": "REC-MOCK-SHORT-001", "transfer_timestamp": "2026-05-25T08:30:00+05:30"},
]

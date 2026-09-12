# REC Fraud Detection — Data Schema
**Owner:** Role 1 (Data & ML Lead) · **Dataset version:** v1 (seed=42, reproducible)

---

## Tables

### `certificates`
| Field | Type | Notes |
|---|---|---|
| `certificate_id` | string | **Not guaranteed unique** — `duplicate_serial` fraud rows intentionally reuse an existing `certificate_id`. Check for duplicates rather than assuming uniqueness. |
| `generator_id` | string | Shares the same ID namespace as `from_party_id`/`to_party_id` in `transactions`. |
| `plant_lat`, `plant_lon` | float | Within India's bounding box. |
| `energy_source` | string | `solar` or `wind`. |
| `claimed_mwh` | float | Use this — and `plant_rated_capacity_mwh` — for capacity-ratio checks. |
| `plant_rated_capacity_mwh` | float | Optional sanity cap for Role 2's weather-derived expected output. |
| `generation_timestamp` | datetime | **Use this for physical/weather checks.** Stored in **IST (UTC+5:30) directly — no conversion needed.** |
| `issuance_timestamp` | datetime | Administrative only — can be hours/days after `generation_timestamp`. Do NOT use this for weather/physical plausibility checks. |
| `is_fraud` | bool | **Ground truth — evaluation only. Never a model input.** |
| `fraud_type` | string / null | One of: `duplicate_serial`, `over_capacity`, `impossible_timing`, `timestamp_collision`, `circular_trading`. |

### `transactions`
| Field | Type | Notes |
|---|---|---|
| `transaction_id` | string | Unique. |
| `certificate_id` | string | Foreign key into `certificates` (not unique there — see above). |
| `from_party_id`, `to_party_id` | string | Same ID namespace as `generator_id`. |
| `transfer_timestamp` | datetime | Stored in IST, same convention as `certificates`. |

---

## Locked decisions (confirmed with team)

1. **Timezone: IST throughout, no conversion.** All plants are in India (one civil timezone nationwide), so `generation_timestamp` and `transfer_timestamp` are stored directly in IST. Role 2 reads the hour straight off the stored value for day/night checks.
   - *Caveat for the report:* IST is used uniformly as a simplification; true per-longitude solar time (India spans ~68–97°E) would be a production refinement, not needed at this scale.
   - *Flag for Role 2:* when calling Open-Meteo/NASA POWER, convert to UTC or pass an explicit timezone param for that API call — the external API likely expects UTC even though our stored data doesn't.

2. **`generator_id` is the graph's origin node.** Every certificate's transaction chain starts with an issuance row: `from_party_id == generator_id`. Verified programmatically in this dataset — 0 certificates are missing a valid issuance row.

3. **`is_fraud` / `fraud_type` are evaluation-only labels.** If any downstream detection logic (e.g. Role 2's cycle or weather checks) reads these fields directly, it isn't detecting fraud — it's echoing the label back. Keep them out of every feature pipeline.

4. **`certificate_id` is NOT a unique join key against `transactions` — this is intentional.** `duplicate_serial` fraud clones a certificate row under the same `certificate_id`, and each clone gets its own independently-generated transaction chain. This means a single `certificate_id` can have **two separate issuance events with different buyers** in `transactions` — that's the actual fraud pattern being modeled (the same serial was issued and traded twice through separate chains), not a data error. Graph-building code should not assume one issuance chain per certificate; group/validate by `(certificate_id, generator_id, generation_timestamp)` or similar if you need to disambiguate the two versions.

5. **Every `circular_trading`-labeled certificate is guaranteed to contain a real cycle** back to its own `generator_id` — enforced in `generator.py` (`n_transfers` is forced to ≥3 whenever a certificate is flagged circular, since a cycle needs at least 3 hops). Verified on every run: 0/42 circular_trading certs are missing an actual cycle in the current dataset. If you ever see recall drop to near-zero on this fraud type, check the dataset version first — this guarantee wasn't in place before this fix.

---

## Worked example (one certificate, full transaction chain)

**Certificate `CERT000008`** — clean (non-fraud) example, wind plant, 3 transfers after issuance:

```json
{
  "certificate_id": "CERT000008",
  "generator_id": "PTY00154",
  "plant_lat": 25.56747,
  "plant_lon": 74.87958,
  "energy_source": "wind",
  "claimed_mwh": 2.594,
  "plant_rated_capacity_mwh": 11.615,
  "generation_timestamp": "2026-09-10 20:48:06",
  "issuance_timestamp": "2026-09-13 23:01:01",
  "is_fraud": false,
  "fraud_type": null
}
```

Its transaction chain (issuance = row 1, `from_party_id == generator_id`):

| transaction_id | from_party_id | to_party_id | transfer_timestamp |
|---|---|---|---|
| TXN0000024 | PTY00154 (= generator_id) | PTY00004 | 2026-09-10 21:51:22 |
| TXN0000025 | PTY00004 | PTY00002 | 2026-09-11 05:51:44 |
| TXN0000026 | PTY00002 | PTY00007 | 2026-09-11 13:39:43 |
| TXN0000027 | PTY00007 | PTY00001 | 2026-09-11 20:43:48 |

This is the pattern every certificate follows: row 1 always originates from `generator_id`, subsequent rows chain forward through the market.

For a fraud example, `CERT000001` (fraud_type = `circular_trading`) closes its chain back to its own `generator_id` (`PTY00157 → PTY00099 → PTY00275 → PTY00002 → PTY00157`) — this is the pattern Role 2's cycle detection should catch.

---

## Dataset summary (v1)

- 1,200 unique certificates (1,242 rows including duplicate-serial fraud clones)
- 3,721 transactions, avg 3.10 per certificate
- Fraud rate: 16.9%, evenly split across 5 fraud types (42 each)
- Fully reproducible with seed=42 (`generate_data.py`)clone = certs_df.loc[idx].to_dict()
clone["is_fraud"] = True
clone["fraud_type"] = "duplicate_serial"
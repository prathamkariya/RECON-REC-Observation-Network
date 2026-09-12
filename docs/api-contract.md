# API Contract — REC Fraud Detection System

Backend FastAPI Service (Role 4 `backend/`). Defined once in
`backend/app/schemas.py`; everyone builds to this shape. It does not change
when a mock data source is swapped for a real one.

## The `Certificate` contract

```json
{
  "certificate_id": "REC-1001",
  "plant": { "id": "PLANT-A", "type": "solar", "capacity_mw": 50, "lat": 23.03, "lon": 72.58 },
  "generation": { "mwh_claimed": 120, "start": "2026-06-01T10:00:00Z", "end": "2026-06-01T14:00:00Z" },
  "issuer_id": "ISSUER-A",
  "buyer_id": "BUYER-B",
  "risk_score": 0.12,
  "risk_reasons": ["..."],
  "explanation": "Plain-English summary for an auditor.",
  "ledger": { "hash": "sha256...", "prev_hash": "sha256... | null", "verified": true }
}
```

- `risk_score` — Role 1 (ML), blended with Role 2's graph/weather signals.
- `risk_reasons` — Roles 1 + 2 merged into one list.
- `explanation` — Role 2's Claude-generated plain-English summary.
- `ledger` — Role 3's tamper-evident hash-chain proof.

## Endpoints

### 1. List certificates
- **GET** `/recs`
- **Response**: `Certificate[]`

### 2. Get one certificate
- **GET** `/recs/{certificate_id}`
- **Response**: `Certificate`, or `404` if not found.

### 3. Ingest & score a certificate
- **POST** `/recs`
- **Request body** (`CertificateCreate`):
```json
{
  "certificate_id": "REC-1001",
  "plant": { "id": "PLANT-A", "type": "solar", "capacity_mw": 50, "lat": 23.03, "lon": 72.58 },
  "generation": { "mwh_claimed": 120, "start": "2026-06-01T10:00:00Z", "end": "2026-06-01T14:00:00Z" },
  "issuer_id": "ISSUER-A",
  "buyer_id": "BUYER-B",
  "transactions": [
    { "from_party_id": "ISSUER-A", "to_party_id": "BUYER-B", "transfer_timestamp": "2026-06-01T15:00:00Z" }
  ]
}
```
`transactions` is optional context used for fraud-ring detection; it is not
stored on the returned `Certificate`.
- **Response**: `Certificate` (201), scored and written to the ledger.

### 4. Ledger tamper check
- **GET** `/verify/{certificate_id}`
- **Response**:
```json
{ "certificate_id": "REC-1001", "verified": true, "hash": "sha256...", "prev_hash": "sha256..." }
```
`404` if the certificate hasn't been ingested. `verified: false` means the
stored ledger block (or an earlier one in the chain) was retroactively
edited after being written.

### 5. Analytics summary
- **GET** `/analytics/summary`
- **Response**:
```json
{ "total_certificates": 5, "flagged": 3, "average_risk_score": 0.41, "top_reasons": ["..."] }
```

### 6. Service status
- **GET** `/`
- **Response**: which of ML / graph / weather / explain / ledger are
  currently backed by mock vs. real data, per `backend/app/config.py`'s
  `USE_REAL_*` flags.

## Data schema reference

See `docs/data-schema.md` for the underlying field-level definitions each
role's raw data conforms to before it's aggregated into the contract above.

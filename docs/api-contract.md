# API Contract — REC Fraud Detection System

Backend FastAPI Service (Role 4 `backend/`). Defined once in
`backend/app/schemas.py`; everyone builds to this shape. It does not change
when a mock data source is swapped for a real one.

The service exposes **two pipelines over the same risk assessment**:

| | Off-chain (`/recs`) | On-chain (`/certificates`) |
|---|---|---|
| Identified by | `certificate_id` (a string you supply) | `token_id` (assigned by the contract) |
| Proof of record | SHA-256 hash chain (`/verify/{id}`) | ERC-721 mint on RECRegistry.sol |
| Storage | In-process store + ledger | Postgres/SQLite + the chain |
| Needs a chain configured | No | Yes (`RPC_URL`, `CONTRACT_ADDRESS`, `BACKEND_PRIVATE_KEY`) |

Both score a record identically — `/certificates` calls the same
`service.assess_risk()` that `/recs` does. Use `/recs` for bulk analysis of a
dataset, `/certificates` for issuing a real certificate the dashboard can
show on-chain provenance for.

Interactive docs for everything below: `GET /docs`.

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

## Off-chain endpoints (`/recs`)

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
{
  "total_certificates": 5,
  "flagged": 3,
  "average_risk_score": 0.41,
  "top_reasons": ["..."],
  "data_sources": { "ml": "real", "graph": "mock", "weather": "mock", "explain": "mock", "ledger": "mock" }
}
```
`data_sources` is on the rollup itself so a dashboard reading only this
endpoint can tell a mocked rollup from a fully validated one.

### 6. Service status
- **GET** `/`
- **Response**: which of ML / graph / weather / explain / ledger are
  currently backed by mock vs. real data, per `backend/app/config.py`'s
  `USE_REAL_*` flags.
- **GET** `/health` → `{"status": "ok"}` (container healthcheck).

## On-chain endpoints (`/certificates`)

Certificates minted on `RECRegistry.sol` (ERC-721). These need `RPC_URL`,
`CONTRACT_ADDRESS` and `BACKEND_PRIVATE_KEY` configured — except
`/analyze`, which is deliberately chain-free.

### 7. Analyze without minting
- **POST** `/certificates/analyze`
- **Request body** (`CertificateIssueRequest`):
```json
{
  "to_address": "0x... (optional — defaults to the backend issuer wallet)",
  "plant": { "id": "PLANT-A", "type": "solar", "capacity_mw": 50, "lat": 23.03, "lon": 72.58 },
  "generation": { "mwh_claimed": 120, "start": "2026-06-01T10:00:00Z", "end": "2026-06-01T14:00:00Z" },
  "issuer_id": "ISSUER-A"
}
```
- **Response** `200`: `{ "fraud_score": 0-100, "risk_reasons": ["..."], "explanation": "..." }`

Runs the same ML → graph → weather pipeline as `POST /recs`, but mints
nothing and stores nothing, so the frontend can show analysis as its own step
before the user commits. Needs no wallet or RPC configured.

### 8. Issue (mint) a certificate
- **POST** `/certificates/issue` — same request body as `/analyze`
- **Response** `201`: `{ token_id, tx_hash, owner_address, plant_id, energy_mwh, generation_timestamp, fraud_score, risk_reasons, explanation, status }`
- `409` — this generation record was already certified. The contract rejects a
  repeat `(plantId, energyMWh, generationTimestamp)`; this is the
  double-counting guarantee.
- `403` — the backend wallet is not an authorized issuer on the contract.
- `502` — the chain is unreachable or the transaction reverted for another reason.

### 9. List issued certificates
- **GET** `/certificates`
- **Response**: `CertificateListItem[]` — the off-chain rows, so listing many
  certificates costs no chain reads. Use #10 for live-verified detail.

### 10. Get one certificate (chain + database merged)
- **GET** `/certificates/{token_id}`
- **Response**: the on-chain struct (`plant_id`, `energy_mwh`, `fraud_score`,
  `retired_on_chain`, `owner_address`) merged with the off-chain row
  (`risk_reasons`, `explanation`, `raw_record`, `mint_tx_hash`, `status`).
- `404` unknown `token_id` · `502` chain unreachable.

### 11. Retire a certificate
- **POST** `/certificates/{token_id}/retire`
- **Response** `200`: `{ token_id, tx_hash, status: "retired" }`
- `409` already retired · `403` the backend wallet is not the owner (a
  certificate minted straight to a user's wallet must be retired by that
  wallet) · `404` unknown `token_id` · `502` chain unreachable.

## Auditor chat

### 12. Ask about a certificate
- **POST** `/audit/chat` (also mounted at `/api/v1/audit/chat`)
- **Request body**: `{ "certificate_id": "REC-1001", "query": "Why was this flagged?" }`
- **Response**: `{ "certificate_id": "REC-1001", "reply": "..." }`

Grounded in a certificate already ingested via `/recs` when there is one,
otherwise in the `data/` CSVs. Answers without `ANTHROPIC_API_KEY` set, using
Role 2's deterministic offline fallback.

## Admin

### 13. Preload the fraud-ring graph
- **POST** `/admin/graph-preload`
- **Request body**: `{ "transactions": [...], "certificates": [{ "certificate_id", "generator_id" }] }`
- **Response**: `{ "preloaded": <count> }`

Runs Role 2's whole-dataset graph analysis once and caches every
certificate's result, so a bulk load doesn't recompute Louvain community
detection per request. Safe to call unconditionally — a no-op returning
`{"preloaded": 0}` when `USE_REAL_GRAPH` is off. See
`backend/scripts/load_dataset.py`, which calls it automatically.

## Data schema reference

See `docs/schema_data.md` for the underlying field-level definitions each
role's raw data conforms to before it's aggregated into the contract above.

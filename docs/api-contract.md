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
  `USE_REAL_*` flags, plus a `chain` object reporting whether the on-chain
  registry is actually usable:
```json
{
  "chain": {
    "rpc_url": "http://127.0.0.1:8545",
    "connected": true,
    "contract_address": "0x5FbD...",
    "issuer_wallet": "0xf39F...",
    "ready": true
  }
}
```
`ready: false` is why every `/certificates` route will fail — check it before
debugging a 502. The issuer wallet is a public address; the private key is
never exposed by any endpoint.
- **GET** `/health` → `{"status": "ok"}` (container healthcheck).

## On-chain certificates (`/certificates`)

A separate pipeline from `/recs`. Where `/recs` scores a certificate and writes
it to the hash-chain ledger, `/certificates` scores it and **mints an ERC-721**
on `RECRegistry.sol`, then stores the off-chain half (raw payload, reasoning,
tx hash) in the database. See `contracts/README.md` for the contract itself.

Deployed on Sepolia at
[`0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59`](https://sepolia.etherscan.io/address/0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59#code)
(source verified), with a local Hardhat deployment alongside it. A mint on a
public network takes roughly 15-20 seconds to confirm, so `/certificates/issue`
is a slow endpoint by nature — the UI shows analysis as a separate step
(`/certificates/analyze`) partly for that reason.

These routes need `RPC_URL` reachable, a deployed contract, and a funded
`BACKEND_PRIVATE_KEY` issuer wallet — see `GET /` above — except `/analyze`,
which is deliberately chain-free.

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

Runs the same ML → graph → weather pipeline as `POST /recs`, but touches
neither the chain nor the database, so the UI can show analysis as a distinct
step before the user commits to minting. Needs no wallet or RPC configured.

### 8. Issue (mint)
- **POST** `/certificates/issue` → `201` — same request body as `/analyze`.
  Omit `to_address` to mint to the backend's own issuer wallet — callers never
  need a connected wallet.
- **Response** `201`: `{ token_id, tx_hash, owner_address, plant_id, energy_mwh, generation_timestamp, fraud_score, risk_reasons, explanation, status }`
- Duplicate generation records are rejected with `409` via a free `isRecordUsed`
  view call **before** the risk pipeline runs, so a duplicate costs no gas and
  no pipeline time. The contract itself also rejects a repeat
  `(plantId, energyMWh, generationTimestamp)` — the double-counting guarantee.

| Status | Meaning |
| --- | --- |
| `201` | minted; returns `token_id`, `tx_hash`, score, reasons, explanation |
| `409` | this `(plantId, energyMWh, generationTimestamp)` is already certified |
| `403` | the backend wallet isn't an authorized issuer |
| `422` | the contract rejected an argument (e.g. fraud score > 100) |
| `502` | the chain call failed for any other reason |

### 9. Get one certificate (chain + database merged)
- **GET** `/certificates/{token_id}`
- Merges the **live** on-chain `getCertificate()` + `ownerOf()` (`plant_id`,
  `energy_mwh`, `fraud_score`, `retired_on_chain`, `owner_address`) with the
  off-chain database row (`risk_reasons`, `explanation`, `raw_record`,
  `mint_tx_hash`, `status`).
- `404` if the token doesn't exist on-chain or we hold no row for it ·
  `502` chain unreachable.

### 10. List certificates
- **GET** `/certificates`
- **Response**: `CertificateListItem[]` — off-chain rows only, so listing stays
  fast with no chain read per item. Use #9 for live-verified detail.

### 11. Transfer
- **POST** `/certificates/{token_id}/transfer`
- Body: `{to_address}`. Returns the new owner and the transfer tx hash.

| Status | Meaning |
| --- | --- |
| `200` | transferred |
| `409` | the certificate is retired and can no longer move |
| `403` | the backend wallet doesn't own it (see the custodial note below) |
| `404` | unknown token |
| `422` | the contract rejected an argument (e.g. an invalid receiver) |
| `502` | the chain call failed for any other reason |

### 12. Retire
- **POST** `/certificates/{token_id}/retire`
- **Response** `200`: `{ token_id, tx_hash, status: "retired" }`
- Marks the certificate consumed. Irreversible, and blocks all future transfers.

| Status | Meaning |
| --- | --- |
| `200` | retired |
| `409` | already retired |
| `403` | the backend wallet doesn't own it |
| `404` | unknown token |
| `502` | chain unreachable |

**Custodial constraint.** The backend signs only as its own wallet. Transfer and
retire therefore work only while the backend custodies the certificate. If one
is minted directly to an end-user wallet, that user must sign those actions
from their own wallet client-side — the API returns `403` with an explanation
rather than sending a transaction that would revert.

## Auditor chat

### 13. Ask about a certificate
- **POST** `/audit/chat` (also mounted at `/api/v1/audit/chat`)
- **Request body**: `{ "certificate_id": "REC-1001", "query": "Why was this flagged?" }`
- **Response**: `{ "certificate_id": "REC-1001", "reply": "..." }`

Grounded in a certificate already ingested via `/recs` when there is one,
otherwise in the `data/` CSVs. Answers without `ANTHROPIC_API_KEY` set, using
Role 2's deterministic offline fallback.

## Admin

### 14. Preload the fraud-ring graph
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

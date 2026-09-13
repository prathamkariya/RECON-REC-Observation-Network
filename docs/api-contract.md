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

These routes need a reachable node, a deployed contract, and a funded issuer
wallet — see `GET /` above.

### 1. Analyze without minting
- **POST** `/certificates/analyze`
- Runs the full risk pipeline and returns `{fraud_score, risk_reasons,
  explanation}`. Touches neither the chain nor the database, so the UI can show
  analysis as a distinct step before the user commits to minting. Needs no
  wallet or RPC configured.

### 2. Issue (mint)
- **POST** `/certificates/issue` → `201`
- Body: `{to_address?, plant, generation, issuer_id}`. Omit `to_address` to
  mint to the backend's own issuer wallet — callers never need a connected
  wallet.
- Duplicate generation records are rejected with `409` via a free `isRecordUsed`
  view call **before** the risk pipeline runs, so a duplicate costs no gas and
  no pipeline time.

| Status | Meaning |
| --- | --- |
| `201` | minted; returns `token_id`, `tx_hash`, score, reasons, explanation |
| `409` | this `(plantId, energyMWh, generationTimestamp)` is already certified |
| `403` | the backend wallet isn't an authorized issuer |
| `422` | the contract rejected an argument (e.g. fraud score > 100) |
| `502` | the chain call failed for any other reason |

### 3. Get one certificate
- **GET** `/certificates/{token_id}`
- Merges the **live** on-chain `getCertificate()` + `ownerOf()` with the
  off-chain database row. `404` if the token doesn't exist on-chain or we hold
  no row for it.

### 4. List certificates
- **GET** `/certificates`
- Off-chain rows only — no chain read per item, so listing stays fast. Use the
  detail route for live-verified data.

### 5. Transfer
- **POST** `/certificates/{token_id}/transfer`
- Body: `{to_address}`. Returns the new owner and the transfer tx hash.

| Status | Meaning |
| --- | --- |
| `200` | transferred |
| `409` | the certificate is retired and can no longer move |
| `403` | the backend wallet doesn't own it (see the custodial note below) |
| `404` | unknown token |

### 6. Retire
- **POST** `/certificates/{token_id}/retire`
- Marks the certificate consumed. Irreversible, and blocks all future transfers.

| Status | Meaning |
| --- | --- |
| `200` | retired |
| `409` | already retired |
| `403` | the backend wallet doesn't own it |
| `404` | unknown token |

**Custodial constraint.** The backend signs only as its own wallet. Transfer and
retire therefore work only while the backend custodies the certificate. If one
is minted directly to an end-user wallet, that user must sign those actions
from their own wallet client-side — the API returns `403` with an explanation
rather than sending a transaction that would revert.

## Data schema reference

See `docs/data-schema.md` for the underlying field-level definitions each
role's raw data conforms to before it's aggregated into the contract above.

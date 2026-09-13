# RECON — REC Observation Network

**REC fraud detection and on-chain certificate registry** · HackOut'26 · Team Synapse'27

RECON watches Renewable Energy Certificates (RECs) for fraud before and after
they are issued. Every certificate runs through a multi-signal pipeline (ML
risk score, trading-ring graph analysis, weather plausibility, plain-English
explanation, tamper-evident ledger). The settled facts — *this generation
record was certified once* and *this certificate is retired* — live on an
ERC-721 registry on Ethereum.

This folder is the merged project: the **new dashboard UI** (control room,
network intelligence, physical validation, audit trail) running on the
**existing working backend**, contracts, ML and data layers.

---

## Contents

- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Dashboard pages](#dashboard-pages)
- [Quick start (local)](#quick-start-local)
- [Configuration](#configuration)
- [Docker](#docker)
- [API reference](#api-reference)
- [Smart contract](#smart-contract)
- [Tests](#tests)
- [What changed in this merge](#what-changed-in-this-merge)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
                         ┌──────────────────────────────────┐
  Browser ──────────────▶│  dashboard/  (Next.js 16, :3000) │
     │                   │  Firebase auth · React Query     │
     │                   └───────────────┬──────────────────┘
     │ read-only chain                   │ REST (NEXT_PUBLIC_API_URL)
     │ verification (wagmi/viem)         ▼
     │                   ┌──────────────────────────────────┐
     │                   │  backend/  (FastAPI, :8000)      │
     │                   │                                  │
     │                   │  ml_client ─────▶ ml/            │  Role 1: Isolation Forest risk
     │                   │  graph_client ──▶ graph_explain/ │  Role 2: fraud rings (Louvain)
     │                   │  weather_client ▶ graph_explain/ │          weather plausibility
     │                   │  explain_client ▶ graph_explain/ │          Claude explanation
     │                   │  ledger_client ─▶ ledger_cloud/  │  Role 3: hash-chained ledger
     │                   │  web3_client ──┐                 │  Role 4: aggregation API
     │                   └────────────────┼─────────────────┘
     │                                    │ signs mint / retire / transfer
     ▼                                    ▼
  ┌──────────────────────────────────────────────────────────┐
  │  contracts/RECRegistry.sol  (ERC-721)                    │
  │  Sepolia 0x2819…4B59  ·  or local Hardhat node :8545     │
  └──────────────────────────────────────────────────────────┘
```

**Design rule: the response shape never changes, only the source behind it.**
Every signal sits behind a client adapter in `backend/app/clients/` with a
working mock (the default) and a real branch, switched by a `USE_REAL_*` flag.
A real source that errors or times out falls back to its mock, so one broken
module never takes the pipeline down.

---

## Repository layout

```
RECON/
├── dashboard/            Next.js 16 frontend (new UI)
│   ├── app/(app)/        signed-in console: dashboard, certificates, fraud,
│   │                     network, physical, issue, audit
│   ├── app/(auth)/       signin, signup, forgot-password
│   ├── app/verify/       public certificate verification
│   ├── app/how-it-works/ public explainer
│   ├── components/       shell, control-room, investigation, network,
│   │                     physical, landing, glass, motion, ui (shadcn) …
│   └── lib/              api.ts (backend client), analytics.ts, contract.ts,
│                         wagmi.ts, firebase.ts, mock/data.ts
├── backend/              FastAPI aggregation API
│   ├── app/clients/      one adapter per signal (mock + real) + web3_client
│   ├── app/routers/      recs, certificates, verify, analytics, audit, admin
│   ├── app/contracts/    RECRegistry ABI + deployed addresses (generated)
│   ├── scripts/          load_dataset.py, seed_onchain.py
│   ├── tests/            on-chain test suite
│   ├── requirements.txt       runtime deps (what Docker installs)
│   └── requirements-dev.txt   + test deps (pytest, eth-tester, py-solc-x)
├── contracts/            Hardhat project: RECRegistry.sol, deploy script, tests
├── ml/                   synthetic data, feature engineering, Isolation Forest,
│                         autoencoder; handoff/ = scores the backend reads
├── graph_explain/        fraud-ring graph, weather client, LLM explainer + audit chat
├── ledger_cloud/         hash-chained audit ledger + verifier
├── data/                 certificates / transactions / features / labels CSVs
├── docs/                 api-contract.md, schema_data.md
├── docker-compose.yml    chain + backend + frontend
├── .env.docker.example   optional overrides for docker compose
└── myenv/                local Python venv (not committed)
```

---

## Dashboard pages

| Route | Page | What it shows |
| --- | --- | --- |
| `/` | Landing | Hero, live registry, signal pipeline, chain-split explainer |
| `/how-it-works` | Explainer | Scroll-through of the detection pipeline |
| `/verify` | Public verification | Look up a certificate and verify it against the chain in the browser |
| `/signin` `/signup` `/forgot-password` | Auth | Firebase email auth |
| `/dashboard` | **Control Room** | Stat cards, flow topology, anomaly matrix, trend charts, surveillance feed, site anchors |
| `/certificates` | Certificate Archive | Search, filter and sort every on-chain certificate |
| `/certificates/[id]` | Investigation Dossier | Evidence pillars, signal triangle, telemetry log, regulatory brief, lifecycle timeline, on-chain proof, transfer / retire |
| `/fraud` | Investigations | Risk distribution, score histogram, high-risk list |
| `/network` | Network Intelligence | Ownership graph of plants, issuers and wallets; flagged clusters |
| `/physical` | Physical Validation | Claimed generation vs. physical capacity envelope per plant |
| `/issue` | Issuance | Three steps: generation form → live AI analysis → mint |
| `/audit` | Audit Trail | Activity log of issuance, transfers and retirements |

The console pages derive their analytics client-side (`lib/analytics.ts`) from
the same certificate list the backend serves, so they need no extra endpoints.

---

## Quick start (local)

**Prerequisites:** Python 3.9+, Node 22, npm. Two terminals.

### 1. Backend — terminal 1

Run from the **repo root**: imports are anchored there so the backend can reach
`ml/`, `graph_explain/` and `ledger_cloud/`.

```bash
cd RECON
source myenv/bin/activate          # or create one: python3 -m venv myenv && source myenv/bin/activate
pip install -r backend/requirements.txt -r ml/requirements.txt \
            -r graph_explain/requirements.txt -r ledger_cloud/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

- `http://localhost:8000/` — which sources are real vs. mock, and whether the chain is ready
- `http://localhost:8000/docs` — Swagger UI
- `http://localhost:8000/health` — liveness

### 2. Dashboard — terminal 2

```bash
cd RECON/dashboard
npm install
npm run dev                         # http://localhost:3000
```

With `NEXT_PUBLIC_USE_MOCK_DATA=true` the whole UI runs off `lib/mock/data.ts`
and needs no backend. Set it to `false` to use the live API.

### 3. (Optional) local chain instead of Sepolia

```bash
cd contracts
npm install
npx hardhat node                    # terminal 3 — leave running
npm run deploy:local                # writes the ABI + address for backend and dashboard
```

Then point `backend/.env` at `RPC_URL=http://127.0.0.1:8545` with Hardhat
account #0 as `BACKEND_PRIVATE_KEY`, and seed some certificates so the UI isn't
empty:

```bash
python -m backend.scripts.seed_onchain            # 6 demo certificates
```

---

## Configuration

Real values live in gitignored files: `backend/.env`, `contracts/.env`,
`dashboard/.env.local`. Templates: `backend/.env.example`,
`dashboard/.env.local.example`, `.env.docker.example`. **Never commit a real
`.env`, and never paste private keys into chat or logs.**

### `backend/.env`

| Variable | Purpose |
| --- | --- |
| `USE_REAL_ML` | Use `ml/handoff/final_stat_risk.json` scores instead of mock |
| `USE_REAL_GRAPH` | Louvain fraud-ring detection (`graph_explain/graph/fraud_ring.py`) |
| `USE_REAL_WEATHER` | Open-Meteo weather plausibility check (needs network) |
| `USE_REAL_EXPLAIN` | Claude explanations (needs `ANTHROPIC_API_KEY`) |
| `USE_REAL_LEDGER` | `ledger_cloud` hash-chained ledger |
| `ANTHROPIC_API_KEY` | Claude API key |
| `DATABASE_URL` | Blank = SQLite at `backend/recon.db`; set for Postgres |
| `WEATHER_TIMEOUT_SECONDS` / `EXPLAIN_TIMEOUT_SECONDS` | Slow upstream degrades to the heuristic instead of hanging |
| `RPC_URL` | Ethereum RPC (Sepolia or `http://127.0.0.1:8545`) |
| `CONTRACT_ADDRESS` | Optional — otherwise read from the ABI artifact for the connected chain |
| `BACKEND_PRIVATE_KEY` | Issuer wallet that signs mint / retire / transfer |
| `CONTRACT_ABI_PATH` | Optional override for the ABI artifact path |

### `dashboard/.env.local`

All `NEXT_PUBLIC_*` values are compiled into browser JavaScript — public only,
no secrets.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend base URL, e.g. `http://localhost:8000` |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `true` = run off mock data, `false` = live API |
| `NEXT_PUBLIC_CHAIN_ID` | Chain the UI verifies against (`11155111` Sepolia, `31337` Hardhat) |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web app config (auth) |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Read-only RPC for browser-side verification |
| `NEXT_PUBLIC_LOCAL_RPC_URL` | Local Hardhat RPC |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Optional — otherwise read from `lib/contract-artifact.json` |

### `contracts/.env`

`SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `BACKEND_PRIVATE_KEY`,
`ETHERSCAN_API_KEY` — only needed to deploy or verify on Sepolia.

---

## Docker

```bash
cd RECON
cp .env.docker.example .env        # optional — every value has a default
docker compose up --build
```

| Service | Port | What it is |
| --- | --- | --- |
| `chain` | `8545` | Hardhat node; deploys RECRegistry on boot and shares the ABI + address with the backend via a volume |
| `backend` | `8000` | FastAPI API; SQLite persisted in the `backend_data` volume |
| `frontend` | `3000` | Next.js standalone build of the dashboard |

Out of the box the stack is **self-contained**: all `USE_REAL_*` flags off, the
backend talks to the local `chain` container, and the frontend is built with
mock data. It does **not** read `backend/.env` or `dashboard/.env.local` —
override values in the root `.env` instead.

`NEXT_PUBLIC_*` values are baked in at build time, so changing one needs
`docker compose up --build`, not a restart. `NEXT_PUBLIC_API_URL` must be
reachable from your **browser** (`http://localhost:8000`), not the container
name.

```bash
docker compose ps                  # status
docker compose logs -f backend     # follow one service
docker compose down                # stop (keeps volumes)
docker compose down -v             # stop and delete volumes
```

The images need several GB of free disk for the build — see
[Troubleshooting](#troubleshooting).

---

## API reference

Full request/response shapes: [`docs/api-contract.md`](docs/api-contract.md).

### Fraud pipeline

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Service status: real/mock per source, chain readiness |
| `GET` | `/health` | Liveness |
| `GET` | `/recs` | List scored certificates |
| `GET` | `/recs/{certificate_id}` | One scored certificate |
| `POST` | `/recs` | Ingest and score a certificate (ML → graph → weather → explanation → ledger) |
| `GET` | `/verify/{certificate_id}` | Ledger tamper check |
| `GET` | `/analytics/summary` | Aggregate stats |
| `POST` | `/audit/chat` | Auditor chat grounded in the dataset (also at `/api/v1/audit/chat`) |
| `POST` | `/admin/graph-preload` | Precompute whole-dataset graph results before bulk loading |

### On-chain certificates

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/certificates` | List on-chain certificates |
| `POST` | `/certificates/analyze` | Run the fraud analysis without minting |
| `POST` | `/certificates/issue` | Analyze and mint to the registry |
| `GET` | `/certificates/{token_id}` | One certificate with on-chain state |
| `POST` | `/certificates/{token_id}/transfer` | Transfer (backend must custody it) |
| `POST` | `/certificates/{token_id}/retire` | Retire — final, blocks further transfers |

Bulk-load the synthetic dataset through the pipeline:

```bash
python backend/scripts/load_dataset.py --certs data/certificates.csv --txns data/transactions.csv --limit 200
```

---

## Smart contract

`contracts/contracts/RECRegistry.sol` — ERC-721 where one token is one
certified generation record.

| | |
| --- | --- |
| Network | Ethereum Sepolia (chainId 11155111) |
| Address | [`0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59`](https://sepolia.etherscan.io/address/0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59#code) (verified) |
| Issuer | `0xB81ce4bc1fb783217EB4E331846D917B17970e12` |

- **A record can only be certified once** — keyed by
  `keccak256(abi.encode(plantId, energyMWh, generationTimestamp))`; a duplicate
  mint reverts with `RecordAlreadyCertified`.
- **Retirement is final** — a retired token can't be retired again or transferred.
- **The fraud score at issuance is stored on-chain**, so auditors see what the
  pipeline believed at mint time.

Deploying writes two generated files — don't hand-edit them:
`backend/app/contracts/RECRegistry.json` and `dashboard/lib/contract-artifact.json`.
Details: [`contracts/README.md`](contracts/README.md).

---

## Tests

```bash
# Backend (from repo root)
pip install -r backend/requirements-dev.txt
pytest backend/tests -q
# For the revert-classification tests, run a node first: cd contracts && npx hardhat node

# Contracts
cd contracts && npx hardhat test

# Dashboard
cd dashboard && npm run lint && npm run build
```

---

## What changed in this merge

This folder combines two copies of the project:

| Part | Taken from |
| --- | --- |
| `dashboard/` (all source, `package.json`, lockfile, Dockerfile) | **RECON-merge** — the new UI |
| `dashboard/.env.local` | RECON-REC-Observation-Network — existing real config |
| `backend/`, `contracts/`, `ml/`, `graph_explain/`, `ledger_cloud/`, `data/`, `docs/`, `docker-compose.yml`, `.env` files, `.git` | **RECON-REC-Observation-Network** — the working backend |

The new UI uses the same backend client (`lib/api.ts`), types (`lib/types.ts`)
and contract artifact as before (byte-identical), so no backend code changed.

**Fixes made after merging:**

- **Backend Docker build was broken.** `backend/requirements.txt` required
  `eth-tester>=0.12.0`, which only exists as pre-releases, so `pip install`
  failed inside the image. Test-only packages (`pytest`, `eth-tester`,
  `py-solc-x`) moved to `backend/requirements-dev.txt`; the app only uses
  eth-tester when tests set `RPC_URL=eth-tester`.
- **`web3` pinned to 7.x** (`>=7.0.0,<8.0.0`), matching the tested local
  environment (7.16) — Docker was otherwise resolving the untested 8.0 major.
- `.github/workflows/onchain.yml` installs `requirements-dev.txt` so CI still
  has the test packages.
- `myenv/` was rebuilt in place with the identical package set (a copied venv
  keeps pointing at its old path).

---

## Troubleshooting

**`input/output error` or `no space left on device` during `docker compose build`**
The Mac disk is full. Docker Desktop's disk image grows with every build. Free
space, restart Docker Desktop, then clear old build cache:
`docker builder prune -f`.

**Port 3000 / 8000 / 8545 already in use**
Find the process with `lsof -nP -iTCP:3000 -sTCP:LISTEN` and stop it — often a
`next dev` from another checkout.

**`/certificates` routes return 502**
Open `http://localhost:8000/` and check `chain.ready`. It needs an RPC
connection, a contract address for that chain, and `BACKEND_PRIVATE_KEY`.

**Dashboard is empty on a local chain**
A fresh Hardhat node has no certificates — run
`python -m backend.scripts.seed_onchain`.

**`ModuleNotFoundError: No module named 'backend'`**
Run uvicorn/pytest from the repo root, not from `backend/`.

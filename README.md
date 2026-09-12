# RECON: REC Observation Network
**Project:** REC Fraud Detection System — HackOut'26 (Team Synapse'27)

A multi-layered fraud detection and tamper-evident audit platform for Renewable
Energy Certificates (RECs).

Most REC tooling only catches duplicate serials. RECON scores every certificate
on **three independent signals at once** — statistical, network, and physical —
fuses them into one risk score, explains the result in plain English, and
records every judgement in a hash-chained ledger.

| Signal | Catches | How |
|---|---|---|
| **Statistical** | Outlier claims | Isolation Forest over engineered features (capacity utilisation, timing, issuance velocity, buyer concentration) |
| **Network** | Coordinated fraud rings | Cycle detection + Louvain communities over the issuer/buyer trading graph |
| **Physical** | Impossible generation | Open-Meteo irradiance/wind cross-check — e.g. solar claimed at 2 AM |

Signals combine with **noisy-OR**, so a single conclusive signal drives risk to
1.0 on its own rather than being averaged away.

---

## Quick start

### Docker (whole stack)

```bash
docker compose up --build
```

- Dashboard → http://localhost:3000
- API + interactive docs → http://localhost:8000/docs

Runs with **no configuration at all**: every external source defaults to a
working mock, so no API key, wallet, or chain is required. Copy
`.env.docker.example` to `.env` to override anything.

### Local development

```bash
make install     # venv + backend deps + npm install
make test        # backend test suite
make run         # API on :8000
make run-dashboard   # dashboard on :3000
```

`make help` lists everything.

---

## Architecture

```
RECON-REC-Observation-Network/
├── docs/                  # Shared contracts
│   ├── api-contract.md      # every endpoint, both pipelines
│   └── schema_data.md       # field-level data definitions
├── ml/                    # Role 1: synthetic data + Isolation Forest
│   ├── generate_data.py      feature_engineering.py  model.py
│   └── handoff/             # precomputed statistical_risk per certificate
├── graph_explain/         # Role 2: fraud rings, weather, explainability
│   ├── graph/fraud_ring.py       # cycles + Louvain communities
│   ├── weather/weather_client.py # Open-Meteo physical cross-check
│   └── llm/                      # Claude explanations + auditor chat
├── ledger_cloud/          # Role 3: durable hash-chained audit ledger
│   ├── ledger.py                 # append-only chain, SQLAlchemy-backed
│   └── verify.py                 # chain verification + inclusion proofs
├── backend/               # Role 4: FastAPI aggregation + on-chain registry
│   ├── app/clients/              # one adapter per dependency (mock + real)
│   ├── app/service.py            # the pipeline: ML → graph → weather → explain → ledger
│   ├── app/onchain_service.py    # ERC-721 mint/retire via RECRegistry.sol
│   └── tests/                    # 179 tests, 98% coverage
├── dashboard/             # Next.js 16 + Tailwind v4 + shadcn/ui
└── docker-compose.yml     # Postgres + backend + dashboard
```

### The mock-or-real switchboard

Every external dependency sits behind an adapter in `backend/app/clients/`
with a **working mock** (the default) and a **real branch** behind an env flag.
The response shape never changes — only the source behind it does. Nothing is
blocked waiting on anything else, and a broken dependency degrades instead of
failing the request.

| Flag | Wires in | Needs |
|---|---|---|
| `USE_REAL_ML` | Role 1's tuned Isolation Forest scores | — |
| `USE_REAL_GRAPH` | Role 2's cycle/Louvain detection | — |
| `USE_REAL_WEATHER` | Open-Meteo cross-check | network access |
| `USE_REAL_EXPLAIN` | Claude explanations | `ANTHROPIC_API_KEY` |
| `USE_REAL_LEDGER` | Durable Postgres-backed chain | `DATABASE_URL` |

Weather and explain calls run under a hard deadline and fall back to the
heuristic — a slow upstream degrades the answer, never the latency.

### Two pipelines, one risk assessment

- **`/recs`** — off-chain. Scores a certificate and writes it to the hash
  chain. No chain configuration needed. Use it for bulk dataset analysis.
- **`/certificates`** — on-chain. Same scoring, then mints an ERC-721 on
  `RECRegistry.sol`. The contract rejects a repeat
  `(plantId, energyMWh, generationTimestamp)`, which is the double-counting
  guarantee.

See [`docs/api-contract.md`](docs/api-contract.md) for every endpoint.

---

## Testing

```bash
make test        # everything
make test-fast   # skip the in-process EVM tests
make test-cov    # with coverage
```

179 tests / 98% coverage. The on-chain tests compile `RECRegistry.sol` with
solc and run it on an in-process EVM, so **no Hardhat node or testnet is
needed** — `pytest` alone exercises mint, duplicate rejection, retire and
authorization.

---

## Configuration

| File | Purpose |
|---|---|
| `backend/.env.example` | Backend config — copy to `backend/.env` |
| `dashboard/.env.local.example` | Dashboard config — copy to `dashboard/.env.local` |
| `.env.docker.example` | docker-compose overrides — copy to `.env` |

Everything runs unconfigured. Secrets (`ANTHROPIC_API_KEY`,
`BACKEND_PRIVATE_KEY`) are read only by the backend and never reach a browser;
`NEXT_PUBLIC_*` values are compiled into the client bundle, so nothing secret
belongs in them.

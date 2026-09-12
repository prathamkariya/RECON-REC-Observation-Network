# Role 4: Backend Aggregation API

FastAPI service that ties the other four roles' pieces into one coherent
`Certificate` response per REC. This service aggregates; it doesn't produce
fraud signals itself.

**Core design principle:** the response shape never changes — only the
source behind it does. Every dependency (ML, fraud-ring graph, weather,
Claude explanation, ledger) sits behind a client adapter in `app/clients/`.
Each adapter has a working mock (default) and a real branch that imports a
teammate's module, toggled by an env flag. Nobody is blocked waiting on
anyone else.

## Layout

```
backend/
├── app/
│   ├── schemas.py       # THE CONTRACT (Pydantic models)
│   ├── config.py        # env flags: USE_REAL_* (all default off), API keys
│   ├── clients/          # one adapter per dependency, mock + real branch
│   │   ├── ml_client.py
│   │   ├── graph_client.py
│   │   ├── weather_client.py
│   │   ├── explain_client.py
│   │   └── ledger_client.py
│   ├── service.py        # compose_and_store(): runs the pipeline in order
│   ├── routers/
│   │   ├── recs.py        # GET /recs, GET /recs/{id}, POST /recs
│   │   ├── verify.py      # GET /verify/{id} — ledger tamper check
│   │   └── analytics.py   # GET /analytics/summary
│   └── main.py
├── mock_server.py        # standalone demo server, 5 hardcoded fixtures
└── requirements.txt
```

## Run it (fully mocked, zero external dependencies)

From the **repo root** (imports are anchored there so real client branches
can later reach sibling packages like `ml/`, `graph_explain/`, `ledger_cloud/`):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

Or run the pre-loaded demo server (5 fixtures: clean, over-capacity, trading
ring, night-time solar, tampered ledger):

```bash
python -m backend.mock_server
```

Visit `/` for a status report of which sources are mock vs. real, and
`/docs` for interactive Swagger UI.

## Flipping a source from mock to real

Set the matching env flag to `true` (see `.env.example`) once a teammate's
module is ready — no code changes needed on this side:

| Flag | Wires in | Needs |
|---|---|---|
| `USE_REAL_ML` | `ml/model.py` | — |
| `USE_REAL_GRAPH` | `graph_explain/graph/fraud_ring.py` | `networkx` |
| `USE_REAL_WEATHER` | `graph_explain/weather/weather_client.py` (Open-Meteo) | network access |
| `USE_REAL_EXPLAIN` | `graph_explain/llm/explainer.py` (Claude) | `ANTHROPIC_API_KEY` |
| `USE_REAL_LEDGER` | `ledger_cloud/ledger.py` + `ledger_cloud/verify.py` (Postgres) | `DATABASE_URL` |

The weather and explain clients wrap their real calls in a timeout and
degrade to the mock heuristic on failure or timeout — a slow API never hangs
or crashes a request. If a real client errors for any other reason (import
error, bad return shape), every adapter falls back to its mock so a broken
teammate module never blocks the pipeline.

## Endpoints

See `docs/api-contract.md` for the full contract.

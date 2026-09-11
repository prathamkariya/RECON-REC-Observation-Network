# RECON: REC Observation Network
**Project:** REC Fraud Detection System — HackOut'26 (Team Synapse'27)

A multi-layered fraud detection and immutable audit platform for Renewable Energy Certificates (RECs).

## Architecture & Responsibilities

```
RECON-REC-Observation-Network/
├── docs/                     # Shared contracts and schemas
│   ├── data-schema.md
│   └── api-contract.md
├── ml/                       # Role 1: Synthetic Data & Isolation Forest
│   ├── generate_data.py
│   ├── model.py
│   └── requirements.txt
├── graph_explain/            # Role 2: Graph Ring Detection, Weather Checks & Explainability
│   ├── graph/fraud_ring.py
│   ├── weather/weather_client.py
│   ├── llm/explainer.py
│   ├── llm/audit_chat.py
│   └── requirements.txt
├── ledger_cloud/             # Role 3: Hash-Chained Audit Ledger & Cloud Deployment
│   ├── ledger.py
│   ├── verify.py
│   └── requirements.txt
├── backend/                  # Role 4: FastAPI Aggregation & Audit API
│   ├── main.py
│   ├── routers/
│   │   ├── certificates.py
│   │   └── audit.py
│   └── requirements.txt
└── dashboard/                # Frontend UI
    ├── package.json
    └── README.md
```

## Quick Start (Skeleton Mode)
Each subfolder has its own isolated dependencies and `requirements.txt`.
See `docs/data-schema.md` and `docs/api-contract.md` for shared data formats.

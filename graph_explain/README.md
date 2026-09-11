# Role 2: Graph, Physical Check & Explainability

Part of the **REC Fraud Detection System** (HackOut'26 — Team Synapse'27).

## Scope

- **Graph Fraud-Ring Detection (`graph/fraud_ring.py`)**: Cycle detection (`simple_cycles`) and Louvain community detection on trading network.
- **Physical Plausibility Check (`weather/weather_client.py`)**: Cross-checks claimed generation timestamps/lat-lon with historical weather / solar irradiance data via Open-Meteo or NASA POWER.
- **Explainability Layer (`llm/explainer.py`, `llm/audit_chat.py`)**: Plain-English explanations generated via Claude API leading with the strongest signal.

## Deliverables & Output Contract

Per certificate handoff:
```json
{
  "certificate_id": "...",
  "graph_flag": false,
  "graph_risk": 0.0,
  "weather_mismatch": false,
  "weather_mismatch_score": 0.0,
  "explanation": null
}
```

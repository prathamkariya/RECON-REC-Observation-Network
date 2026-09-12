"""
pytest configuration for graph_explain/ test suite.
Sets up sys.path so that `graph.fraud_ring`, `weather.weather_client`,
`llm.explainer`, and `llm.audit_chat` are all importable when running:
    cd graph_explain && pytest tests/ -v
"""

import sys
import os

# Add graph_explain/ itself to path so `from graph.fraud_ring import ...` works
_GRAPH_EXPLAIN_DIR = os.path.abspath(os.path.dirname(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_GRAPH_EXPLAIN_DIR, ".."))

for _p in [_GRAPH_EXPLAIN_DIR, _REPO_ROOT]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

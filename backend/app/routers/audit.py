"""
Auditor Interactive Chat router for POST /api/v1/audit/chat.
Delegates to Role 2's graph_explain.llm.audit_chat.chat_session.
"""
import os
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any

from .. import service
from graph_explain.llm.audit_chat import chat_session

router = APIRouter()

# Cache dataframes across chat calls for performance
_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data"))
_CERTS_PATH = os.path.join(_DATA_DIR, "certificates.csv")
_TXS_PATH = os.path.join(_DATA_DIR, "transactions.csv")

_cached_certs_df = None
_cached_txs_df = None

def _get_datasets():
    global _cached_certs_df, _cached_txs_df
    if _cached_certs_df is None and os.path.exists(_CERTS_PATH):
        _cached_certs_df = pd.read_csv(_CERTS_PATH)
    if _cached_txs_df is None and os.path.exists(_TXS_PATH):
        _cached_txs_df = pd.read_csv(_TXS_PATH)
    return _cached_certs_df, _cached_txs_df


class ChatRequest(BaseModel):
    certificate_id: str
    query: str


class ChatResponse(BaseModel):
    certificate_id: str
    reply: str


@router.post("/chat", response_model=ChatResponse)
def audit_chat(request: ChatRequest) -> Dict[str, str]:
    cert_id = request.certificate_id
    query = request.query

    # 1. Check in-memory stored certificate first
    stored_cert = service.get_certificate(cert_id)
    if stored_cert:
        c_dict = {
            "certificate_id": stored_cert.certificate_id,
            "generator_id": stored_cert.issuer_id,
            "plant_lat": stored_cert.plant.lat,
            "plant_lon": stored_cert.plant.lon,
            "energy_source": stored_cert.plant.type,
            "claimed_mwh": stored_cert.generation.mwh_claimed,
            "plant_rated_capacity_mwh": stored_cert.plant.capacity_mw,
            "generation_timestamp": stored_cert.generation.start,
        }
        certs_df = pd.DataFrame([c_dict])
        txs_df = pd.DataFrame([])
        signals = {
            "graph_risk": stored_cert.risk_score,
            "explanation": stored_cert.explanation,
        }
        return chat_session(cert_id, query, certs_df, txs_df, {cert_id: signals})

    # 2. Check canonical dataset files
    certs_df, txs_df = _get_datasets()
    if certs_df is not None and txs_df is not None:
        return chat_session(cert_id, query, certs_df, txs_df)

    # 3. Fallback if dataset not available
    return chat_session(cert_id, query, pd.DataFrame([]), pd.DataFrame([]))

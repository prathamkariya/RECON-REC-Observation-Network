from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from ..clients import graph_client

router = APIRouter()


class GraphPreloadTransaction(BaseModel):
    from_party_id: str
    to_party_id: str
    certificate_id: str
    transfer_timestamp: str


class GraphPreloadCertificate(BaseModel):
    certificate_id: str
    generator_id: str


class GraphPreloadRequest(BaseModel):
    transactions: List[GraphPreloadTransaction]
    certificates: List[GraphPreloadCertificate]


@router.post("/graph-preload")
def graph_preload(payload: GraphPreloadRequest):
    """
    Internal bulk-load helper, not part of the Certificate contract. Runs
    Role 2's real graph analysis once over a full known dataset (see
    graph_explain/pipeline.py's own analyze_dataset() -- same one-call
    pattern) so subsequent POST /recs calls for those certificate_ids hit
    an O(1) cache instead of recomputing community detection from scratch
    on every request. See app/clients/graph_client.py's preload_batch().

    Safe to call unconditionally: a no-op (preloaded=0) if USE_REAL_GRAPH
    is off or the real module isn't available.
    """
    count = graph_client.preload_batch(
        [t.model_dump() for t in payload.transactions],
        [c.model_dump() for c in payload.certificates],
    )
    return {"preloaded": max(count, 0)}

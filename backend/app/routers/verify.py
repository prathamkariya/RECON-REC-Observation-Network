from fastapi import APIRouter, HTTPException

from .. import service
from ..clients import ledger_client

router = APIRouter()


@router.get("/{certificate_id}")
def verify_certificate(certificate_id: str):
    if service.get_certificate(certificate_id) is None:
        raise HTTPException(status_code=404, detail=f"Certificate '{certificate_id}' not found")

    result = ledger_client.verify(certificate_id)
    return {
        "certificate_id": certificate_id,
        "verified": result.get("verified", False),
        "hash": result.get("hash"),
        "prev_hash": result.get("prev_hash"),
    }

from typing import List

from fastapi import APIRouter, HTTPException

from .. import service
from ..schemas import Certificate, CertificateCreate

router = APIRouter()


@router.get("", response_model=List[Certificate])
def list_recs():
    return service.list_certificates()


@router.get("/{certificate_id}", response_model=Certificate)
def get_rec(certificate_id: str):
    cert = service.get_certificate(certificate_id)
    if cert is None:
        raise HTTPException(status_code=404, detail=f"Certificate '{certificate_id}' not found")
    return cert


@router.post("", response_model=Certificate, status_code=201)
def create_rec(payload: CertificateCreate):
    return service.compose_and_store(payload)

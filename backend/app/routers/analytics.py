from fastapi import APIRouter

from .. import service

router = APIRouter()


@router.get("/summary")
def analytics_summary():
    return service.summary()

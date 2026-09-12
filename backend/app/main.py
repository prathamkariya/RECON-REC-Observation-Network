from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import admin, analytics, audit, recs, verify

app = FastAPI(
    title="RECON REC Fraud Detection API",
    version="2.0.0",
    description=(
        "Aggregates ML risk scoring, fraud-ring/weather cross-checks, plain-English "
        "explanation, and ledger proofs into one Certificate response per REC."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recs.router, prefix="/recs", tags=["Certificates"])
app.include_router(verify.router, prefix="/verify", tags=["Ledger"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(audit.router, prefix="/audit", tags=["Audit Chat"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["Audit Chat"], include_in_schema=False)
app.include_router(admin.router, prefix="/admin", tags=["Admin"])


@app.get("/")
def root():
    return {
        "service": "RECON Backend API",
        "sources": {
            "ml": "real" if settings.USE_REAL_ML else "mock",
            "graph": "real" if settings.USE_REAL_GRAPH else "mock",
            "weather": "real" if settings.USE_REAL_WEATHER else "mock",
            "explain": "real" if settings.USE_REAL_EXPLAIN else "mock",
            "ledger": "real" if settings.USE_REAL_LEDGER else "mock",
        },
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}

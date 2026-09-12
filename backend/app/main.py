from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .clients import web3_client
from .config import settings
from .db import init_db
from .routers import admin, analytics, audit, certificates, recs, verify


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="RECON REC Fraud Detection API",
    version="2.0.0",
    description=(
        "Aggregates ML risk scoring, fraud-ring/weather cross-checks, plain-English "
        "explanation, and ledger proofs into one Certificate response per REC."
    ),
    lifespan=lifespan,
)

# "*" with allow_credentials=True is not actually a wildcard: Starlette echoes
# whichever Origin asked, so every site gets a credentialed allow. Credentials
# are only enabled for an explicitly configured origin list. This API is called
# with bearer tokens rather than cookies, so the wildcard default costs nothing
# in local dev — set CORS_ORIGINS in any deployed environment.
_allow_any_origin = "*" in settings.CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=not _allow_any_origin,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recs.router, prefix="/recs", tags=["Certificates"])
app.include_router(verify.router, prefix="/verify", tags=["Ledger"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(audit.router, prefix="/audit", tags=["Audit Chat"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["Audit Chat"], include_in_schema=False)
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(certificates.router, prefix="/certificates", tags=["On-Chain Certificates"])


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
        "chain": _chain_status(),
    }


def _chain_status() -> dict:
    """Whether the on-chain registry is actually usable, rather than just
    configured. Every /certificates route depends on all three being true, so
    surfacing it here turns "mint returns 502" into an answerable question."""
    address = None
    try:
        address = web3_client.deployed_address()
    except Exception:
        pass

    connected = False
    try:
        connected = web3_client.get_w3().is_connected()
    except Exception:
        pass

    wallet = None
    try:
        wallet = web3_client.get_backend_address()
    except Exception:
        pass

    return {
        "rpc_url": settings.RPC_URL,
        "connected": connected,
        "contract_address": address,
        "issuer_wallet": wallet,  # public address only — the private key is never exposed
        "ready": bool(connected and address and wallet),
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}

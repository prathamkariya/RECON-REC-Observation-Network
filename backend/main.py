from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import certificates, audit

app = FastAPI(
    title="RECON REC Fraud Detection API",
    version="1.0.0",
    description="Backend API serving REC verification, graph fraud ring flags, weather checks, and ledger proofs."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(certificates.router, prefix="/api/v1/certificates", tags=["Certificates"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["Audit & Ledger"])

@app.get("/health")
def health_check():
    return {"status": "ok"}

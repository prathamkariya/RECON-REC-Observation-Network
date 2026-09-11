# API Contract — REC Fraud Detection System

Backend FastAPI Service (Role 4 `backend/`)

## Endpoints

### 1. Ingest & Analyze Certificates
- **POST** `/api/v1/certificates/analyze`
- **Request Body**: Array of certificate & transaction records
- **Response**:
```json
[
  {
    "certificate_id": "REC-1001",
    "status": "FLAGGED",
    "scores": {
      "statistical_risk": 0.82,
      "graph_risk": 0.95,
      "weather_mismatch_score": 0.0
    },
    "flags": {
      "statistical_anomaly": true,
      "graph_fraud_ring": true,
      "weather_mismatch": false
    },
    "explanation": "Circular trading detected among party A, B, and C with no physical generation issues."
  }
]
```

### 2. Get Certificate Details
- **GET** `/api/v1/certificates/{certificate_id}`
- **Response**: Full metadata, graph cluster info, weather cross-check, and audit ledger proof.

### 3. Ledger Verification Proof
- **GET** `/api/v1/ledger/verify/{certificate_id}`
- **Response**: Block verification status, Merkle/chain proof, timestamp, SHA256 hash.

### 4. Auditor Interactive Chat
- **POST** `/api/v1/audit/chat`
- **Request Body**:
```json
{
  "certificate_id": "REC-1001",
  "query": "Why was this flagged as a circular trade?"
}
```
- **Response**:
```json
{
  "certificate_id": "REC-1001",
  "reply": "..."
}
```

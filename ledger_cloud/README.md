# Role 3: Hash-Chained Ledger & Cloud Deployment

Durable, append-only audit ledger. Each block's SHA-256 covers its own contents
**and** the previous block's hash, so editing any stored block breaks the chain
from that point onward and verification reports exactly where.

## Why durable

The backend carries its own in-process chain
(`backend/app/clients/ledger_client.py`) with the same guarantee. This module
is the persistent counterpart: it stores blocks via SQLAlchemy, so the audit
trail survives a restart. That matters in a container — a tamper-evident log
you can erase by redeploying is not evidence.

Storage follows `DATABASE_URL` (Postgres in deployment, a local SQLite file
otherwise), so it shares the backend's database without importing from it.

## Usage

```python
from ledger_cloud.ledger import AuditLedger
from ledger_cloud.verify import verify_chain, find_break, generate_inclusion_proof

ledger = AuditLedger()
block = ledger.append_certificate("REC-1001", {"risk_score": 0.82})

verify_chain(ledger.chain)        # False if any block was edited
find_break(ledger.chain)          # index of the first bad block, or None
generate_inclusion_proof("REC-1001", ledger.chain)
```

The backend reaches this through `USE_REAL_LEDGER=true`; with the flag off it
uses its in-process chain instead.

## Guarantees, and their limits

- **Detects** retroactive edits to block contents, removed blocks, and
  reordered blocks — including edits made directly in the database.
- `index` is unique, so two concurrent writers cannot silently fork the chain;
  the losing insert fails rather than producing two blocks at one position.
- **Does not prevent** an attacker with database write access from rewriting
  the whole chain from a given point. Detecting that needs an external anchor —
  publishing the tip hash somewhere the attacker doesn't control, which is what
  the on-chain registry (`RECRegistry.sol`) provides.

## Tests

Covered by `backend/tests/test_ledger_cloud.py` (20 tests) — chain linkage,
durability across instances, tamper detection including a direct SQL edit, and
inclusion proofs.

```bash
pytest backend/tests/test_ledger_cloud.py
```

"""
Role 3: Hash-Chained Audit Ledger
Provides immutable, verifiable proof for all analyzed REC certificates and anomaly flags.
"""
import hashlib
import json
from datetime import datetime

class Block:
    def __init__(self, index: int, timestamp: str, data: dict, previous_hash: str):
        self.index = index
        self.timestamp = timestamp
        self.data = data
        self.previous_hash = previous_hash
        self.hash = self.compute_hash()

    def compute_hash(self) -> str:
        block_string = json.dumps({
            "index": self.index,
            "timestamp": self.timestamp,
            "data": self.data,
            "previous_hash": self.previous_hash
        }, sort_keys=True)
        return hashlib.sha256(block_string.encode()).hexdigest()

class AuditLedger:
    def __init__(self):
        self.chain = []
        # Genesis block stub

    def append_certificate(self, certificate_id: str, signals: dict) -> Block:
        pass

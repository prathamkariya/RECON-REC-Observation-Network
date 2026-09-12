"""
Role 3: Ledger Verification Utility.

Verification recomputes each block's hash from its stored contents and checks
it still links to its predecessor. Both halves are necessary: recomputing alone
would miss a block that was removed or reordered, and checking links alone
would miss an edit to a block's data.
"""
from typing import List, Optional


def verify_chain(chain: List) -> bool:
    """True when every block's stored hash matches its contents and every block
    points at its predecessor. An empty chain is trivially intact."""
    previous_hash = None
    for position, block in enumerate(chain):
        if block.index != position:
            return False
        if block.previous_hash != previous_hash:
            return False
        if block.hash != block.compute_hash():
            return False
        previous_hash = block.hash
    return True


def find_break(chain: List) -> Optional[int]:
    """Index of the first block that fails verification, or None if intact —
    so an auditor is told *where* the chain was edited, not just that it was."""
    previous_hash = None
    for position, block in enumerate(chain):
        if (
            block.index != position
            or block.previous_hash != previous_hash
            or block.hash != block.compute_hash()
        ):
            return position
        previous_hash = block.hash
    return None


def generate_inclusion_proof(certificate_id: str, chain: List) -> Optional[dict]:
    """Everything an auditor needs to confirm one certificate's block sits in an
    unbroken chain: the block itself, the hashes on either side of it, and
    whether the chain as a whole still verifies.

    Returns None when the certificate has no block. A certificate may appear
    more than once (duplicate_serial clones share an id); the latest block is
    the current state, matching AuditLedger.find().
    """
    matches = [b for b in chain if b.certificate_id == certificate_id]
    if not matches:
        return None

    block = matches[-1]
    position = block.index

    return {
        "certificate_id": certificate_id,
        "block": block.to_dict(),
        "previous_hash": block.previous_hash,
        "next_hash": chain[position + 1].hash if position + 1 < len(chain) else None,
        "chain_length": len(chain),
        "chain_verified": verify_chain(chain),
        "occurrences": len(matches),
    }

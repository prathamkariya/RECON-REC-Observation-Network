"""
Deploys the test RECRegistry contract (fixtures/RECRegistry.sol) to an
in-process eth-tester chain and points app.config.settings at it, so
web3_client.py runs its real HTTP-provider-shaped code path (just backed by
an in-process chain instead of a real Sepolia/Hardhat RPC endpoint).
"""
import json
from pathlib import Path

import pytest
import solcx
from eth_account import Account
from eth_tester.backends.pyevm.main import get_default_account_keys

from backend.app.clients import web3_client
from backend.app.config import settings

_FIXTURE_SOL = Path(__file__).parent / "fixtures" / "RECRegistry.sol"
_SOLC_VERSION = "0.8.20"

_compiled = None


def _compile_contract():
    global _compiled
    if _compiled is None:
        solcx.install_solc(_SOLC_VERSION)
        result = solcx.compile_files(
            [str(_FIXTURE_SOL)], output_values=["abi", "bin"], solc_version=_SOLC_VERSION
        )
        contract_data = next(v for k, v in result.items() if k.endswith(":RECRegistry"))
        _compiled = (contract_data["abi"], contract_data["bin"])
    return _compiled


@pytest.fixture
def chain(monkeypatch, tmp_path):
    """Fresh contract deployment + patched settings for a single test."""
    web3_client._w3 = None
    web3_client._contract = None
    web3_client._account = None

    monkeypatch.setattr(settings, "RPC_URL", "eth-tester")
    w3 = web3_client.get_w3()

    issuer_key = get_default_account_keys()[0].to_hex()
    issuer_address = Account.from_key(issuer_key).address

    abi, bytecode = _compile_contract()
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx_hash = Contract.constructor().transact({"from": issuer_address})
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    abi_path = tmp_path / "RECRegistry.json"
    abi_path.write_text(json.dumps({"abi": abi}))

    monkeypatch.setattr(settings, "CONTRACT_ADDRESS", receipt.contractAddress)
    monkeypatch.setattr(settings, "BACKEND_PRIVATE_KEY", issuer_key)
    monkeypatch.setattr(settings, "CONTRACT_ABI_PATH", str(abi_path))

    yield issuer_address

    web3_client._w3 = None
    web3_client._contract = None
    web3_client._account = None

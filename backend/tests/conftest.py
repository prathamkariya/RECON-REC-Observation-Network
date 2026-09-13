"""
Deploys the REAL RECRegistry contract and points app.config.settings at it, so
web3_client.py runs its production code path against a production-shaped chain.

Two things changed from the original setup, both because the old one could pass
while the real thing was broken:

1. The contract is the real one. These tests used to deploy a hand-written
   stand-in under tests/fixtures/, so any signature drift between it and the
   deployed contract was invisible until runtime. The fixture now loads
   contracts/ — the same source that gets deployed — from Hardhat's compiled
   artifact, i.e. byte-identical to a real deployment.

2. The provider is a real HTTP node when one is running. web3's eth-tester
   provider mangles custom errors: it tries to ABI-decode the revert payload as
   a string, so `RecordAlreadyCertified("PLANT-A", 100, ...)` arrives as the
   message "execution reverted: PLANT-A" with the 4-byte selector destroyed.
   Error classification therefore CANNOT be tested on eth-tester. Start a node
   (cd contracts && npx hardhat node) and the full suite runs; without one, the
   suite falls back to eth-tester and skips the classification tests rather
   than asserting against a provider artifact.
"""
import json
import os
from pathlib import Path

import pytest
from eth_account import Account
from web3 import Web3

from backend.app.clients import web3_client
from backend.app.config import settings

_REPO_ROOT = Path(__file__).resolve().parents[2]
_CONTRACTS_DIR = _REPO_ROOT / "contracts"
_SOURCE = _CONTRACTS_DIR / "contracts" / "RECRegistry.sol"
_HARDHAT_ARTIFACT = _CONTRACTS_DIR / "artifacts" / "contracts" / "RECRegistry.sol" / "RECRegistry.json"
_NODE_MODULES = _CONTRACTS_DIR / "node_modules"
_SOLC_VERSION = "0.8.20"

# Hardhat's first default account. Publicly known, funded on a local node only.
_HARDHAT_ACCOUNT_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

TEST_RPC_URL = os.getenv("TEST_RPC_URL", "http://127.0.0.1:8545")

_compiled = None


def _compile_with_solcx():
    """Fallback when Hardhat's artifact isn't built: compile the real source
    directly, remapping the OpenZeppelin imports at contracts/node_modules."""
    import solcx

    if not _NODE_MODULES.exists():
        pytest.skip(
            "Neither contracts/artifacts nor contracts/node_modules exists — "
            "run `cd contracts && npm install && npx hardhat compile` first."
        )
    if _SOLC_VERSION not in [str(v) for v in solcx.get_installed_solc_versions()]:
        solcx.install_solc(_SOLC_VERSION)

    result = solcx.compile_files(
        [str(_SOURCE)],
        output_values=["abi", "bin"],
        solc_version=_SOLC_VERSION,
        import_remappings={"@openzeppelin/": str(_NODE_MODULES / "@openzeppelin") + "/"},
        allow_paths=[str(_CONTRACTS_DIR)],
        optimize=True,
    )
    data = next(v for k, v in result.items() if k.endswith(":RECRegistry"))
    return data["abi"], data["bin"]


def _load_contract():
    global _compiled
    if _compiled is None:
        if _HARDHAT_ARTIFACT.exists():
            artifact = json.loads(_HARDHAT_ARTIFACT.read_text())
            _compiled = (artifact["abi"], artifact["bytecode"])
        else:
            _compiled = _compile_with_solcx()
    return _compiled


def _http_node_available() -> bool:
    try:
        return Web3(Web3.HTTPProvider(TEST_RPC_URL, request_kwargs={"timeout": 2})).is_connected()
    except Exception:
        return False


@pytest.fixture(scope="session")
def live_node() -> bool:
    """True when a real JSON-RPC node is reachable, so tests can tell whether
    the revert-classification path is exercisable."""
    return _http_node_available()


@pytest.fixture
def requires_custom_errors(live_node):
    """Skips a test that asserts on revert classification when only eth-tester
    is available — see the module docstring for why that can't work there."""
    if not live_node:
        pytest.skip(
            "Revert classification needs a real JSON-RPC node; eth-tester destroys "
            "the custom-error selector. Start one: cd contracts && npx hardhat node"
        )


@pytest.fixture
def chain(monkeypatch, tmp_path, live_node):
    """Fresh contract deployment + patched settings for a single test.

    Yields the issuer wallet address, which is both the contract owner and the
    wallet web3_client signs with. A new contract is deployed per test, so tests
    never share token ids or used-record state even on a long-lived node.
    """
    web3_client.reset_cache()

    if live_node:
        monkeypatch.setattr(settings, "RPC_URL", TEST_RPC_URL)
        issuer_key = _HARDHAT_ACCOUNT_0
    else:
        from eth_tester.backends.pyevm.main import get_default_account_keys

        monkeypatch.setattr(settings, "RPC_URL", "eth-tester")
        issuer_key = get_default_account_keys()[0].to_hex()

    w3 = web3_client.get_w3()
    issuer = Account.from_key(issuer_key)
    issuer_address = issuer.address

    abi, bytecode = _load_contract()
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    # RECRegistry's constructor takes the initial owner, auto-authorized as an issuer.
    constructor = Contract.constructor(issuer_address)

    if live_node:
        tx = constructor.build_transaction(
            {
                "from": issuer_address,
                "nonce": w3.eth.get_transaction_count(issuer_address),
                "gas": 6_000_000,
            }
        )
        signed = issuer.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    else:
        tx_hash = constructor.transact({"from": issuer_address})

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    assert receipt.status == 1, "RECRegistry deployment reverted"

    abi_path = tmp_path / "RECRegistry.json"
    abi_path.write_text(json.dumps({"abi": abi, "address": receipt.contractAddress}))

    monkeypatch.setattr(settings, "CONTRACT_ADDRESS", receipt.contractAddress)
    monkeypatch.setattr(settings, "BACKEND_PRIVATE_KEY", issuer_key)
    monkeypatch.setattr(settings, "CONTRACT_ABI_PATH", str(abi_path))

    yield issuer_address

    web3_client.reset_cache()

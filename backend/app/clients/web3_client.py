"""
Adapter for the on-chain REC registry (RECRegistry.sol, ERC-721).

Connects to RPC_URL (a local Hardhat node by default, or a real Sepolia
endpoint in prod) and signs transactions with the backend issuer wallet
(BACKEND_PRIVATE_KEY — never logged, never returned to callers). The one
on-chain rule the rest of the app needs to react to is the duplicate
generation-record revert; that's translated into DuplicateRecordError so the
API layer can return 409 instead of a raw Web3 exception.
"""
import json
from pathlib import Path
from typing import Optional

from web3 import Web3
from web3.exceptions import ContractLogicError
from web3.logs import DISCARD

from ..config import settings


class ChainError(Exception):
    """Base class for on-chain call failures the API layer handles explicitly."""


class DuplicateRecordError(ChainError):
    """issueCertificate reverted because this (plantId, energyMWh, generationTimestamp)
    record was already minted into a certificate."""


class NotAuthorizedError(ChainError):
    """The backend wallet isn't allowed to perform this action (not an authorized
    issuer, or not the current token owner for a retire)."""


class AlreadyRetiredError(ChainError):
    """retireCertificate reverted because this certificate is already retired.
    A distinct condition from DuplicateRecordError — both revert strings contain
    "already", so classification order matters (see _classify_revert)."""


class CertificateNotFoundError(ChainError):
    """No certificate exists for the given tokenId."""


_w3: Optional[Web3] = None
_contract = None
_account = None


def _load_abi() -> list:
    with open(settings.CONTRACT_ABI_PATH) as f:
        data = json.load(f)
    return data["abi"] if isinstance(data, dict) and "abi" in data else data


def get_w3() -> Web3:
    global _w3
    if _w3 is None:
        if not settings.RPC_URL:
            raise ChainError("RPC_URL is not configured")
        if settings.RPC_URL == "eth-tester":
            # In-process test chain (no Node/Hardhat needed) — used by the test
            # suite; never set this in a real .env.
            from web3.providers.eth_tester import EthereumTesterProvider

            _w3 = Web3(EthereumTesterProvider())
        else:
            _w3 = Web3(Web3.HTTPProvider(settings.RPC_URL))
    return _w3


def get_contract():
    global _contract
    if _contract is None:
        if not settings.CONTRACT_ADDRESS:
            raise ChainError("CONTRACT_ADDRESS is not configured")
        _contract = get_w3().eth.contract(
            address=Web3.to_checksum_address(settings.CONTRACT_ADDRESS),
            abi=_load_abi(),
        )
    return _contract


def _get_account():
    global _account
    if _account is None:
        if not settings.BACKEND_PRIVATE_KEY:
            raise ChainError("BACKEND_PRIVATE_KEY is not configured")
        _account = get_w3().eth.account.from_key(settings.BACKEND_PRIVATE_KEY)
    return _account


def get_backend_address() -> str:
    """The backend issuer wallet's address. Certificates minted with no
    explicit recipient go here — callers never need a connected wallet."""
    return _get_account().address


def _classify_revert(message: str) -> ChainError:
    """Best-effort mapping from a require() revert string to a typed error.
    Tune these substrings once the real contract's exact messages are known —
    this only needs to be close enough to route 409 vs 403 vs 500 correctly."""
    lowered = message.lower()
    # "Already retired" must be matched before the generic "already" branch —
    # otherwise retiring a retired certificate reports as a duplicate record.
    if "retired" in lowered:
        return AlreadyRetiredError(message)
    if "already" in lowered or "duplicate" in lowered or "used" in lowered:
        return DuplicateRecordError(message)
    if "no such" in lowered or "nonexistent" in lowered:
        return CertificateNotFoundError(message)
    if "authoriz" in lowered or "issuer" in lowered or "owner" in lowered:
        return NotAuthorizedError(message)
    return ChainError(message)


def _is_revert_error(exc: Exception) -> bool:
    """web3's HTTPProvider raises ContractLogicError for a JSON-RPC revert, but
    other providers (e.g. eth-tester, used by the test suite) raise their own
    exception types for the same thing — so fall back to sniffing the message."""
    return isinstance(exc, ContractLogicError) or "revert" in str(exc).lower()


def _tx_hash_hex(tx_hash) -> str:
    hex_str = tx_hash.hex()
    return hex_str if hex_str.startswith("0x") else f"0x{hex_str}"


def _send_and_wait(func_call, account, timeout: int = 120):
    w3 = get_w3()

    # estimate_gas explicitly (in its own try/except) *before* calling
    # build_transaction — build_transaction silently calls estimate_gas
    # itself to fill in "gas" when it's missing, and a revert raised from
    # inside that internal call would otherwise bypass this error handling.
    try:
        gas_estimate = func_call.estimate_gas({"from": account.address})
    except Exception as exc:
        if _is_revert_error(exc):
            raise _classify_revert(str(exc)) from exc
        raise

    tx = func_call.build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": int(gas_estimate * 1.2),
        }
    )

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)

    if receipt.status == 0:
        try:
            w3.eth.call(tx, block_identifier=receipt.blockNumber)
        except Exception as exc:
            if _is_revert_error(exc):
                raise _classify_revert(str(exc)) from exc
        raise ChainError(f"Transaction {_tx_hash_hex(tx_hash)} reverted with no revert reason")

    return receipt


def _extract_token_id(contract, receipt, to_address: str) -> int:
    # A mint receipt carries both Transfer and CertificateIssued logs. Decoding
    # it against the Transfer ABI alone makes web3 warn about every log it
    # can't match, on every mint; DISCARD asks it to skip them silently.
    for event in contract.events.Transfer().process_receipt(receipt, errors=DISCARD):
        if event["args"]["to"].lower() == to_address.lower():
            return event["args"]["tokenId"]
    raise ChainError("Mint succeeded but no Transfer event was found to extract tokenId")


def mint_certificate(
    to_address: str, plant_id: str, energy_mwh: int, generation_timestamp: int, fraud_score: int
) -> dict:
    """Mints a certificate. fraud_score must be a 0-100 int (the contract's type).
    Returns {"token_id": int, "tx_hash": str}.
    Raises DuplicateRecordError if this generation record was already certified.
    """
    contract = get_contract()
    account = _get_account()
    to_checksum = Web3.to_checksum_address(to_address)

    func_call = contract.functions.issueCertificate(
        to_checksum, plant_id, int(energy_mwh), int(generation_timestamp), int(fraud_score)
    )
    receipt = _send_and_wait(func_call, account)
    token_id = _extract_token_id(contract, receipt, to_checksum)
    return {"token_id": token_id, "tx_hash": _tx_hash_hex(receipt.transactionHash)}


def retire_certificate(token_id: int, owner_address: str) -> dict:
    """Retires a certificate. retireCertificate is only callable by the current
    token owner on-chain, and this backend can only sign as its own wallet —
    so this succeeds only when the backend wallet is itself the certificate
    owner (a custodial mint model). If certificates are minted directly to
    end-user wallets, retirement must be signed by that user's own wallet
    client-side, not through this backend call.
    """
    contract = get_contract()
    account = _get_account()

    if account.address.lower() != Web3.to_checksum_address(owner_address).lower():
        raise NotAuthorizedError(
            f"Backend wallet {account.address} is not the owner of certificate "
            f"{token_id} ({owner_address}); retirement must be signed by the owner's wallet."
        )

    func_call = contract.functions.retireCertificate(int(token_id))
    receipt = _send_and_wait(func_call, account)
    return {"tx_hash": _tx_hash_hex(receipt.transactionHash)}


def get_certificate(token_id: int) -> dict:
    """Returns the on-chain Certificate struct merged with ownerOf(). Raises
    CertificateNotFoundError if tokenId doesn't exist."""
    contract = get_contract()
    try:
        plant_id, energy_mwh, generation_timestamp, fraud_score, retired = contract.functions.getCertificate(
            int(token_id)
        ).call()
        owner = contract.functions.ownerOf(int(token_id)).call()
    except Exception as exc:
        # Only web3's HTTPProvider raises ContractLogicError for a revert;
        # eth-tester and other providers raise their own types. Catching just
        # ContractLogicError let an unknown tokenId surface as a 502 instead
        # of a 404.
        if _is_revert_error(exc):
            raise CertificateNotFoundError(f"No certificate with tokenId {token_id}") from exc
        raise

    return {
        "token_id": int(token_id),
        "plant_id": plant_id,
        "energy_mwh": energy_mwh,
        "generation_timestamp": generation_timestamp,
        "fraud_score": fraud_score,
        "retired": retired,
        "owner": owner,
    }


def is_record_used(plant_id: str, energy_mwh: int, generation_timestamp: int) -> bool:
    contract = get_contract()
    return contract.functions.isRecordUsed(plant_id, int(energy_mwh), int(generation_timestamp)).call()

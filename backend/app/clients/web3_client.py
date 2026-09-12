"""
Adapter for the on-chain REC registry (RECRegistry.sol, ERC-721).

Connects to RPC_URL (a local Hardhat node by default, or a real Sepolia
endpoint in prod) and signs transactions with the backend issuer wallet
(BACKEND_PRIVATE_KEY — never logged, never returned to callers).

Reverts are translated into typed exceptions so the API layer can map them to
the right status code (409 duplicate, 403 not authorized, 404 unknown token,
409 already retired) instead of leaking a raw Web3 exception. The contract
uses custom errors, so classification is done by 4-byte selector — computed
from the loaded ABI, not by matching on human-readable revert strings.
"""
import json
import threading
from pathlib import Path
from typing import Optional

from eth_utils import function_abi_to_4byte_selector, to_hex
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
    issuer, or not the current token owner for a retire/transfer)."""


class CertificateNotFoundError(ChainError):
    """No certificate exists for the given tokenId."""


class AlreadyRetiredError(ChainError):
    """The certificate has already been retired — it can't be retired twice or
    transferred afterwards. Distinct from DuplicateRecordError: retiring a spent
    certificate is not the same failure as double-certifying a generation record."""


class InvalidArgumentError(ChainError):
    """The contract rejected an argument (e.g. a fraud score outside 0-100)."""


# Custom error name -> the typed exception the API layer reacts to. Covers our
# own errors plus the OpenZeppelin ERC-721/Ownable errors that can surface
# through the same calls.
_ERROR_NAME_MAP = {
    "RecordAlreadyCertified": DuplicateRecordError,
    "NotAuthorizedIssuer": NotAuthorizedError,
    "NotCertificateOwner": NotAuthorizedError,
    "OwnableUnauthorizedAccount": NotAuthorizedError,
    "ERC721InsufficientApproval": NotAuthorizedError,
    "ERC721IncorrectOwner": NotAuthorizedError,
    "CertificateDoesNotExist": CertificateNotFoundError,
    "ERC721NonexistentToken": CertificateNotFoundError,
    "CertificateAlreadyRetired": AlreadyRetiredError,
    "FraudScoreOutOfRange": InvalidArgumentError,
    "ERC721InvalidReceiver": InvalidArgumentError,
    "ERC721InvalidSender": InvalidArgumentError,
}

_w3: Optional[Web3] = None
_contract = None
_account = None
_abi: Optional[list] = None
_selector_map: Optional[dict] = None

# One wallet signs every transaction, so two concurrent requests would otherwise
# read the same nonce and one would be dropped as a replacement. Serialising the
# read-build-sign-send window is enough: the node counts the transaction as
# pending the moment it's accepted, so the next caller reads the next nonce.
# A public-network mint takes ~15s, almost all of it waiting for the receipt —
# so the lock is released before that wait, not held across it.
_nonce_lock = threading.Lock()


def _load_abi() -> list:
    global _abi
    if _abi is None:
        path = Path(settings.CONTRACT_ABI_PATH)
        if not path.exists():
            raise ChainError(
                f"Contract ABI not found at {path}. Deploy the contract first "
                f"(cd contracts && npm run deploy:local) — the deploy script writes "
                f"the compiled ABI and address here."
            )
        with open(path) as f:
            data = json.load(f)
        _abi = data["abi"] if isinstance(data, dict) and "abi" in data else data
    return _abi


def deployment_info() -> dict:
    """The recorded deployment for the connected chain — address, network,
    deploy tx — for /status and for humans debugging which chain they're on."""
    artifact = _load_artifact()
    deployments = artifact.get("deployments")
    if not isinstance(deployments, dict):
        return {}
    try:
        return deployments.get(str(get_w3().eth.chain_id), {})
    except Exception:
        return {}


def _load_artifact() -> dict:
    path = Path(settings.CONTRACT_ABI_PATH)
    if not path.exists():
        return {}
    with open(path) as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def deployed_address() -> Optional[str]:
    """Resolve which contract to talk to.

    Order: CONTRACT_ADDRESS (explicit override) > the deployment recorded for
    the chain we're actually connected to > the artifact's default. Resolving
    by *connected* chain id is what lets a local Hardhat deployment and a
    Sepolia one coexist in one artifact: pointing RPC_URL at a local node can
    never accidentally talk to the Sepolia address, and vice versa.
    """
    if settings.CONTRACT_ADDRESS:
        return settings.CONTRACT_ADDRESS

    artifact = _load_artifact()
    deployments = artifact.get("deployments")
    if not isinstance(deployments, dict):
        # Older single-address artifact shape.
        return artifact.get("address")

    chain_id = None
    try:
        chain_id = get_w3().eth.chain_id
    except Exception:
        pass

    if chain_id is not None:
        entry = deployments.get(str(chain_id))
        if entry:
            return entry.get("address")
        # Connected to a chain we have no deployment for — refusing to fall
        # back is the point: a "default" address from another network would
        # read as an empty/absent contract rather than an obvious error.
        return None

    default_id = artifact.get("defaultChainId")
    entry = deployments.get(str(default_id)) if default_id is not None else None
    return entry.get("address") if entry else None


def _get_selector_map() -> dict:
    """4-byte error selector (hex) -> custom error name, derived from the ABI."""
    global _selector_map
    if _selector_map is None:
        _selector_map = {}
        for entry in _load_abi():
            if entry.get("type") == "error":
                selector = to_hex(function_abi_to_4byte_selector(entry))
                _selector_map[selector.lower()] = entry["name"]
    return _selector_map


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
        address = deployed_address()
        if not address:
            raise ChainError(
                "CONTRACT_ADDRESS is not configured and no deployed address was "
                "recorded in the ABI artifact — deploy the contract first."
            )
        _contract = get_w3().eth.contract(
            address=Web3.to_checksum_address(address),
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


def reset_cache() -> None:
    """Drops the memoised provider/contract/account. Only for tests and for
    re-reading config after a redeploy."""
    global _w3, _contract, _account, _abi, _selector_map
    _w3 = _contract = _account = _abi = _selector_map = None


def _extract_error_data(exc: Exception) -> Optional[str]:
    """The ABI-encoded revert payload, if the provider surfaced one. web3 puts
    it on ContractCustomError.data; some providers only put it in the message."""
    data = getattr(exc, "data", None)
    if isinstance(data, str) and data.startswith("0x"):
        return data
    if isinstance(data, dict):  # some RPC errors nest it
        inner = data.get("data")
        if isinstance(inner, str) and inner.startswith("0x"):
            return inner
    # Last resort: some providers only put the payload in the message text.
    # Skip anything 42 characters long — that's an address (custom errors often
    # carry one), and its first 4 bytes are not a selector.
    message = str(exc)
    marker = message.find("0x")
    if marker != -1:
        candidate = message[marker:].split()[0].strip("'\"),")
        if len(candidate) >= 10 and len(candidate) != 42 and (len(candidate) - 2) % 2 == 0:
            return candidate
    return None


def _classify_revert(exc: Exception) -> ChainError:
    """Maps a revert to a typed error.

    Preferred path: decode the 4-byte custom-error selector against the ABI —
    exact, and immune to revert-string wording. Falls back to substring matching
    for contracts still using require() strings, where "already retired" must NOT
    be read as a duplicate record.
    """
    message = str(exc)

    data = _extract_error_data(exc)
    if data:
        selector = data[:10].lower()
        name = _get_selector_map().get(selector)
        if name:
            error_cls = _ERROR_NAME_MAP.get(name, ChainError)
            return error_cls(f"{name}: {message}")

    lowered = message.lower()
    # Order matters: check the retired case before the generic "already".
    if "retired" in lowered:
        return AlreadyRetiredError(message)
    if "no such" in lowered or "nonexistent" in lowered or "does not exist" in lowered:
        return CertificateNotFoundError(message)
    if "authoriz" in lowered or "issuer" in lowered or "owner" in lowered:
        return NotAuthorizedError(message)
    if "already" in lowered or "duplicate" in lowered or "certified" in lowered:
        return DuplicateRecordError(message)
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
    with _nonce_lock:
        # Both the gas estimate and the nonce are taken here, under the lock.
        # Estimating outside it is a real bug, not just untidy: estimates are
        # made against whatever state exists at the time, but nonces fix the
        # execution order. A transaction estimated when the issuer already held
        # tokens (a cheap mint) could be handed an earlier nonce and then
        # execute first, when the mint was still the expensive one — and run
        # out of gas. Estimating under the lock keeps the two consistent.
        try:
            gas_estimate = func_call.estimate_gas({"from": account.address})
        except Exception as exc:
            if _is_revert_error(exc):
                raise _classify_revert(exc) from exc
            raise

        tx = func_call.build_transaction(
            {
                "from": account.address,
                # "pending" counts transactions this wallet has already sent but
                # that aren't mined yet. With "latest" (the default), a second
                # mint sent during the ~15s a public-network mint takes to
                # confirm would reuse the in-flight nonce and be rejected as an
                # underpriced replacement.
                "nonce": w3.eth.get_transaction_count(account.address, "pending"),
                # Estimation still can't see other pending transactions on a
                # public network, so keep headroom above the estimate. Unused
                # gas is refunded; an underestimate costs the whole fee.
                "gas": int(gas_estimate * 1.3),
            }
        )
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

    # Deliberately outside the lock — waiting for a receipt is the slow part,
    # and holding the lock across it would serialise every mint end to end.
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)

    if receipt.status == 0:
        try:
            w3.eth.call(tx, block_identifier=receipt.blockNumber)
        except Exception as exc:
            if _is_revert_error(exc):
                raise _classify_revert(exc) from exc
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


def is_chain_available() -> bool:
    """True when the node is reachable and a contract address is configured.
    Used by /status and by callers that want to fail fast with a clear message
    instead of after a long pipeline run."""
    try:
        return get_w3().is_connected() and deployed_address() is not None
    except Exception:
        return False


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


def transfer_certificate(token_id: int, from_address: str, to_address: str) -> dict:
    """Transfers a certificate to a new owner.

    Same custodial constraint as retire_certificate: the backend can only sign
    as its own wallet, so this works for certificates it custodies. A retired
    certificate can't be transferred — the contract reverts, surfaced here as
    AlreadyRetiredError.
    """
    contract = get_contract()
    account = _get_account()
    from_checksum = Web3.to_checksum_address(from_address)
    to_checksum = Web3.to_checksum_address(to_address)

    if account.address.lower() != from_checksum.lower():
        raise NotAuthorizedError(
            f"Backend wallet {account.address} is not the owner of certificate "
            f"{token_id} ({from_address}); the transfer must be signed by the owner's wallet."
        )

    func_call = contract.functions.transferFrom(from_checksum, to_checksum, int(token_id))
    receipt = _send_and_wait(func_call, account)
    return {"tx_hash": _tx_hash_hex(receipt.transactionHash), "owner": to_checksum}


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
        if _is_revert_error(exc):
            error = _classify_revert(exc)
            # Any revert from a read of a specific tokenId means "no such token"
            # as far as the API is concerned.
            raise (
                error
                if isinstance(error, CertificateNotFoundError)
                else CertificateNotFoundError(f"No certificate with tokenId {token_id}")
            ) from exc
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
    """Cheap pre-flight duplicate check — a view call, no gas, no revert.
    Lets the API return a clean 409 before running the pipeline and attempting
    a mint that would revert anyway."""
    contract = get_contract()
    return contract.functions.isRecordUsed(plant_id, int(energy_mwh), int(generation_timestamp)).call()

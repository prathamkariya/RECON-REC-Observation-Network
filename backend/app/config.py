"""
Env-flag switchboard. Every real-source flag defaults OFF, so the service
runs fully mocked with zero external dependencies until a teammate's piece
is ready to be flipped on.
"""
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

_BACKEND_DIR = Path(__file__).resolve().parent.parent


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    # Source toggles — flip to True (or set the env var) once a teammate ships.
    USE_REAL_ML: bool = _bool_env("USE_REAL_ML", False)
    USE_REAL_GRAPH: bool = _bool_env("USE_REAL_GRAPH", False)
    USE_REAL_WEATHER: bool = _bool_env("USE_REAL_WEATHER", False)
    USE_REAL_EXPLAIN: bool = _bool_env("USE_REAL_EXPLAIN", False)
    USE_REAL_LEDGER: bool = _bool_env("USE_REAL_LEDGER", False)

    # Credentials / connection strings for the real branches.
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")

    # Off-chain store for certificate records (raw data, fraud score/explanation,
    # token_id). Defaults to a local SQLite file so the app runs with zero setup;
    # point DATABASE_URL at Postgres for a shared/prod deployment.
    DATABASE_URL: str = os.getenv("DATABASE_URL") or f"sqlite:///{_BACKEND_DIR / 'recon.db'}"

    # Real calls must degrade, never hang — see clients/weather_client.py and
    # clients/explain_client.py.
    WEATHER_TIMEOUT_SECONDS: float = float(os.getenv("WEATHER_TIMEOUT_SECONDS", "3.0"))
    EXPLAIN_TIMEOUT_SECONDS: float = float(os.getenv("EXPLAIN_TIMEOUT_SECONDS", "5.0"))

    # On-chain REC registry (RECRegistry.sol, ERC-721). RPC_URL defaults to a
    # local Hardhat node so dev/tests work without any chain config; point it
    # at your Alchemy/Infura Sepolia endpoint for the real testnet deployment.
    RPC_URL: str = os.getenv("RPC_URL", "http://127.0.0.1:8545")
    CONTRACT_ADDRESS: Optional[str] = os.getenv("CONTRACT_ADDRESS")
    # Never logged, never returned in any API response — see clients/web3_client.py.
    BACKEND_PRIVATE_KEY: Optional[str] = os.getenv("BACKEND_PRIVATE_KEY")
    CONTRACT_ABI_PATH: str = os.getenv(
        "CONTRACT_ABI_PATH", str(_BACKEND_DIR / "app" / "contracts" / "RECRegistry.json")
    )


settings = Settings()

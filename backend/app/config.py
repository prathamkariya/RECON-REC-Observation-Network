"""
Env-flag switchboard. Every real-source flag defaults OFF, so the service
runs fully mocked with zero external dependencies until a teammate's piece
is ready to be flipped on.
"""
import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


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
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")

    # Real calls must degrade, never hang — see clients/weather_client.py and
    # clients/explain_client.py.
    WEATHER_TIMEOUT_SECONDS: float = float(os.getenv("WEATHER_TIMEOUT_SECONDS", "3.0"))
    EXPLAIN_TIMEOUT_SECONDS: float = float(os.getenv("EXPLAIN_TIMEOUT_SECONDS", "5.0"))


settings = Settings()

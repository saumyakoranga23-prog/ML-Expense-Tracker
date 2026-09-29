"""Application configuration.

Every tunable is read from environment variables (or ``backend/.env``) so the
service can be deployed without editing source code. Nothing in this module
contains secrets; see ``backend/.env.example`` for the supported variables.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Runtime configuration for the API."""

    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / "backend" / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "LedgerLens API"
    app_version: str = "1.0.0"
    api_prefix: str = "/api"
    debug: bool = False
    host: str = "127.0.0.1"
    port: int = 8000

    # Comma separated or JSON array, e.g. "http://localhost:5173,https://app.example.com"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]
    )

    # --- upload safety limits -------------------------------------------------
    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MB
    max_rows: int = 200_000
    min_rows_for_analytics: int = 2
    min_rows_for_clustering: int = 8
    max_datasets_in_memory: int = 8
    allowed_extensions: tuple[str, ...] = (".csv", ".txt")

    # --- machine learning -----------------------------------------------------
    min_k: int = 2
    max_k: int = 8
    random_state: int = 42
    max_scatter_points: int = 4_000
    silhouette_sample_size: int = 5_000
    kmeans_n_init: int = 10

    # --- data -----------------------------------------------------------------
    data_dir: Path = REPO_ROOT / "data"
    sample_filename: str = "sample_transactions.csv"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                parsed = json.loads(raw)
                if not isinstance(parsed, list):  # pragma: no cover - defensive
                    raise ValueError("CORS_ORIGINS JSON must be an array")
                return [str(item).strip() for item in parsed if str(item).strip()]
            return [item.strip() for item in raw.split(",") if item.strip()]
        return value

    @field_validator("max_k")
    @classmethod
    def _validate_max_k(cls, value: int) -> int:
        if value < 2:
            raise ValueError("MAX_K must be at least 2")
        return value

    @property
    def sample_csv_path(self) -> Path:
        return self.data_dir / self.sample_filename


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached settings instance."""

    return Settings()

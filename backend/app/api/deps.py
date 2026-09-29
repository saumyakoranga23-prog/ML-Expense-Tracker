"""Shared FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Path, Query, Request

from app.config import Settings
from app.services.store import DatasetRecord, DatasetStore

DatasetId = Annotated[
    str,
    Query(
        min_length=6,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
        description="Dataset identifier returned by POST /api/upload or POST /api/demo",
    ),
]

DatasetIdPath = Annotated[
    str,
    Path(min_length=6, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"),
]


def get_settings(request: Request) -> Settings:
    """Settings attached to the running application."""

    return request.app.state.settings


def get_store(request: Request) -> DatasetStore:
    """The application's in-memory dataset store."""

    return request.app.state.store


def resolve_dataset(dataset_id: str, request: Request) -> DatasetRecord:
    """Look up a dataset or raise a 404 with a helpful message."""

    return get_store(request).get(dataset_id)


__all__ = ["DatasetId", "DatasetIdPath", "get_settings", "get_store", "resolve_dataset"]

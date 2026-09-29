"""Shared pytest fixtures and deterministic CSV builders."""

from __future__ import annotations

import csv
import io
import random
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.store import DatasetStore

SAMPLE_HEADER = ("date", "description", "category", "amount", "transaction_type")


def csv_bytes(rows: list[tuple[object, ...]], header: tuple[str, ...] = SAMPLE_HEADER) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue().encode("utf-8")


def synthetic_rows(count: int = 120, seed: int = 7) -> list[tuple[object, ...]]:
    """Deterministic rows covering income, small frequent and large rare spending."""

    rng = random.Random(seed)
    start = date(2024, 1, 1)
    rows: list[tuple[object, ...]] = []
    for month in range(6):
        month_start = start + timedelta(days=31 * month)
        rows.append(
            (
                month_start.isoformat(),
                "Salary Credit - Acme Ltd",
                "Income",
                f"{150000 + month * 1000:.2f}",
                "Credit",
            )
        )
        rows.append((month_start.isoformat(), "Rent - Riverdale Apartments", "Housing", "32000.00", "Debit"))
        for _ in range(max(count // 12, 3)):
            day = month_start + timedelta(days=rng.randint(0, 26))
            rows.append(
                (
                    day.isoformat(),
                    rng.choice(["Swiggy", "Zomato", "Cafe Coffee Day"]),
                    "Food & Dining",
                    f"{rng.uniform(120, 900):.2f}",
                    "Debit",
                )
            )
        for _ in range(2):
            day = month_start + timedelta(days=rng.randint(0, 26))
            rows.append(
                (
                    day.isoformat(),
                    rng.choice(["Croma", "Reliance Digital"]),
                    "Electronics",
                    f"{rng.uniform(12000, 60000):.2f}",
                    "Debit",
                )
            )
    return rows[:count]


@pytest.fixture(scope="session")
def settings() -> Settings:
    """Default settings pointing at the packaged sample dataset."""

    return Settings()


@pytest.fixture
def store(settings: Settings) -> DatasetStore:
    return DatasetStore(settings)


@pytest.fixture
def app(settings: Settings):
    return create_app(settings)


@pytest.fixture
def client(app) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client

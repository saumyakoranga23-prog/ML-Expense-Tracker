"""Schemas for the transaction explorer."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Flow = Literal["income", "expense"]


class Transaction(BaseModel):
    id: int
    date: date
    description: str
    category: str
    amount: float = Field(description="Absolute amount")
    signed_amount: float = Field(description="Negative for expenses, positive for income")
    flow: Flow
    cluster: int | None = None
    cluster_label: str | None = None
    month: str
    month_label: str
    weekday: str


class TransactionTotals(BaseModel):
    """Totals for the *filtered* selection, not the whole dataset."""

    transactions: int
    spending: float
    income: float
    net: float
    average: float
    largest: float


class FacetCluster(BaseModel):
    id: int
    label: str
    size: int


class Facets(BaseModel):
    categories: list[str]
    flows: list[Flow]
    clusters: list[FacetCluster]
    months: list[str]
    min_amount: float
    max_amount: float


class TransactionPage(BaseModel):
    dataset_id: str
    items: list[Transaction]
    total: int
    page: int
    page_size: int
    pages: int
    totals: TransactionTotals
    facets: Facets
    clustering_available: bool


__all__ = [
    "FacetCluster",
    "Facets",
    "Flow",
    "Transaction",
    "TransactionPage",
    "TransactionTotals",
]

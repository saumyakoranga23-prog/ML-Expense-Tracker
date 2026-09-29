"""Schemas describing the dataset-level financial summary."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import CleaningReport


class Kpis(BaseModel):
    """Headline numbers shown on the dashboard."""

    total_spending: float
    total_income: float
    net_cash_flow: float
    average_monthly_spending: float
    average_monthly_income: float
    largest_expense: float
    largest_expense_description: str | None = None
    largest_expense_date: date | None = None
    largest_expense_category: str | None = None
    transaction_count: int
    expense_count: int
    income_count: int
    average_transaction: float
    average_expense: float
    median_expense: float
    savings_rate: float = Field(description="Net cash flow as a percentage of income")
    months_covered: int
    first_date: date
    last_date: date


class MonthlyPoint(BaseModel):
    month: str = Field(description="ISO year-month, e.g. 2024-07")
    label: str = Field(description="Human label, e.g. Jul 2024")
    income: float
    expense: float
    net: float
    transactions: int
    avg_transaction: float


class VolumePoint(BaseModel):
    month: str
    label: str
    transactions: int
    expenses: int
    incomes: int


class CategoryStat(BaseModel):
    category: str
    total_spending: float
    share: float = Field(description="Percentage of total expenses")
    transactions: int
    average_transaction: float
    largest_transaction: float
    monthly: list[MonthlyPoint] = Field(default_factory=list, description="Month-by-month spend")
    trend_change: float = Field(description="Percent change, recent months vs earlier months")
    first_date: date | None = None
    last_date: date | None = None


class MerchantStat(BaseModel):
    description: str
    category: str
    total_spending: float
    transactions: int
    average_transaction: float


class DatasetSummary(BaseModel):
    dataset_id: str
    kpis: Kpis
    monthly: list[MonthlyPoint]
    categories: list[CategoryStat]
    volume: list[VolumePoint]
    top_merchants: list[MerchantStat]
    cleaning: CleaningReport
    generated_at: datetime


class DatasetInfo(BaseModel):
    """Lightweight description of a dataset held in memory."""

    dataset_id: str
    filename: str
    source: str
    row_count: int
    created_at: datetime
    clustering_available: bool
    min_rows_for_clustering: int = Field(
        default=8,
        description="Row threshold behind clustering_available, so a client can explain why clustering is off",
    )
    active_k: int | None = None


class UploadResponse(BaseModel):
    dataset_id: str
    filename: str
    source: Literal["upload", "demo"]
    row_count: int
    cleaning: CleaningReport
    summary: DatasetSummary
    clustering_available: bool
    min_rows_for_clustering: int


__all__ = [
    "CategoryStat",
    "DatasetInfo",
    "DatasetSummary",
    "Kpis",
    "MerchantStat",
    "MonthlyPoint",
    "UploadResponse",
    "VolumePoint",
]

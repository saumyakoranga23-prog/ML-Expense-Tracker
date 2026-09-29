"""Schemas for deterministic spending insights."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class InsightMetric(BaseModel):
    """A machine-readable stat so the UI can format currency itself."""

    label: str
    value: float
    kind: Literal["currency", "percent", "count", "ratio"]


class Insight(BaseModel):
    id: str
    title: str
    detail: str
    group: Literal["spending", "income", "trend", "category", "cluster", "behaviour"]
    tone: Literal["neutral", "positive", "negative", "warning"] = "neutral"
    metrics: list[InsightMetric] = Field(default_factory=list)


class InsightsResponse(BaseModel):
    dataset_id: str
    generated_at: datetime
    cluster_based: bool
    cluster_k: int | None = None
    insights: list[Insight]


__all__ = ["Insight", "InsightMetric", "InsightsResponse"]

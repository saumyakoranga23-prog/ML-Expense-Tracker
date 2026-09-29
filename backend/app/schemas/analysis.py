"""Schema for the combined ``POST /api/analyze`` response."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.clustering import ClusterResponse
from app.schemas.dataset import DatasetSummary
from app.schemas.insights import InsightsResponse
from app.schemas.model import ModelInfo


class AnalyzeResponse(BaseModel):
    """Everything the dashboard needs after a dataset is loaded."""

    dataset_id: str
    summary: DatasetSummary
    insights: InsightsResponse
    clusters: ClusterResponse | None = None
    model: ModelInfo


__all__ = ["AnalyzeResponse"]

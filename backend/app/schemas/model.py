"""Schemas for the model-information endpoint."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.clustering import ClusterMetrics, KSweepEntry


class FeatureDescription(BaseModel):
    name: str
    label: str
    description: str
    source: str
    scaled: bool = True


class MetricExplanation(BaseModel):
    name: str
    value: float | None = None
    display: Literal["number", "score", "percent"] = "number"
    meaning: str
    caution: str | None = None


class ModelInfo(BaseModel):
    dataset_id: str
    algorithm: str
    algorithm_detail: str
    preprocessing: str
    preprocessing_detail: str
    dimensionality_reduction: str
    dimensionality_reduction_detail: str
    evaluation: str
    features: list[FeatureDescription]
    selected_k: int | None
    optimal_k: int | None
    sweep: list[KSweepEntry]
    metrics: ClusterMetrics | None
    explanations: list[MetricExplanation]
    clustering_available: bool
    unavailable_reason: str | None = None
    total_transactions: int
    hyperparameters: dict[str, str] = Field(default_factory=dict)


__all__ = ["FeatureDescription", "MetricExplanation", "ModelInfo"]

"""Schemas for the K-Means / PCA clustering endpoints."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class ClusterRequest(BaseModel):
    dataset_id: str = Field(min_length=6, max_length=64)
    k: int = Field(ge=2, le=8, description="Number of clusters, 2-8")
    include_points: bool = Field(default=True, description="Return PCA scatter points")


class KSweepEntry(BaseModel):
    k: int
    inertia: float
    silhouette: float


class ClusterMetrics(BaseModel):
    k: int
    inertia: float
    silhouette: float
    iterations: int
    explained_variance: list[float] = Field(description="Explained variance ratio per PCA component")
    explained_variance_total: float
    feature_names: list[str]
    n_samples: int
    n_features: int
    scaler_mean: dict[str, float]
    scaler_scale: dict[str, float]
    silhouette_sampled: bool
    silhouette_sample_size: int


class CategoryBreakdown(BaseModel):
    category: str
    transactions: int
    total: float
    share: float


class ClusterStat(BaseModel):
    """Everything the UI needs to describe one cluster in plain language."""

    cluster: int
    label: str
    size: int
    percentage: float
    avg_transaction: float
    median_transaction: float
    total_spending: float
    total_income: float
    spend_share: float
    dominant_category: str
    dominant_category_share: float
    frequency: Literal["Low", "Medium", "High"]
    transactions_per_month: float
    active_months: int
    income_share: float
    weekend_share: float
    characteristics: list[str]
    top_categories: list[CategoryBreakdown]
    first_date: date
    last_date: date
    feature_means: dict[str, float]
    feature_z_scores: dict[str, float]


class ClusterPoint(BaseModel):
    transaction_id: int
    x: float
    y: float
    cluster: int
    cluster_label: str
    amount: float
    description: str
    category: str
    date: date
    flow: Literal["income", "expense"]


class Centroid(BaseModel):
    cluster: int
    label: str
    x: float
    y: float
    size: int


class ClusterResponse(BaseModel):
    dataset_id: str
    k: int
    generated_at: datetime
    cached: bool
    metrics: ClusterMetrics
    clusters: list[ClusterStat]
    centroids: list[Centroid]
    points: list[ClusterPoint] = Field(default_factory=list)
    total_points: int
    points_sampled: bool
    sweep: list[KSweepEntry] = Field(default_factory=list)
    optimal_k: int = Field(description="Best K by silhouette across the 2-8 sweep (diagnostic only)")


class AnalyzeRequest(BaseModel):
    dataset_id: str = Field(min_length=6, max_length=64)
    k: int | None = Field(default=None, ge=2, le=8)


__all__ = [
    "AnalyzeRequest",
    "CategoryBreakdown",
    "Centroid",
    "ClusterMetrics",
    "ClusterPoint",
    "ClusterRequest",
    "ClusterResponse",
    "ClusterStat",
    "KSweepEntry",
]

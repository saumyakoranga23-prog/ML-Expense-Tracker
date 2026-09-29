"""Spending-cluster routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import get_settings, get_store, resolve_dataset
from app.config import Settings
from app.schemas.clustering import ClusterRequest, ClusterResponse
from app.services.store import DatasetStore

router = APIRouter(tags=["clusters"])


@router.post(
    "/clusters",
    response_model=ClusterResponse,
    summary="Run K-Means over engineered spending features for a chosen K",
)
def create_clusters(payload: ClusterRequest, request: Request) -> ClusterResponse:
    settings: Settings = get_settings(request)
    store: DatasetStore = get_store(request)
    record = store.get(payload.dataset_id)
    return record.cluster(payload.k, settings, include_points=payload.include_points)


@router.get(
    "/clusters/sweep",
    summary="Silhouette and inertia for K = 2..8 (cached per dataset)",
)
def cluster_sweep(dataset_id: str, request: Request) -> dict[str, object]:
    settings: Settings = get_settings(request)
    record = resolve_dataset(dataset_id, request)
    sweep = record.sweep(settings) if record.clustering_available else []
    optimal = max(sweep, key=lambda entry: entry.silhouette).k if sweep else None
    return {
        "dataset_id": record.dataset_id,
        "entries": [entry.model_dump() for entry in sweep],
        "optimal_k": optimal,
        "clustering_available": record.clustering_available,
    }


__all__ = ["router"]

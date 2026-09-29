"""Financial summary and the combined analyze endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import DatasetId, get_settings, get_store, resolve_dataset
from app.config import Settings
from app.schemas.analysis import AnalyzeResponse
from app.schemas.clustering import AnalyzeRequest
from app.schemas.dataset import DatasetSummary
from app.services.insights import build_insights
from app.services.model_report import build_model_info

router = APIRouter(tags=["analytics"])


@router.get(
    "/summary",
    response_model=DatasetSummary,
    summary="KPIs, monthly series, category breakdown and merchant ranking",
)
def get_summary(dataset_id: DatasetId, request: Request) -> DatasetSummary:
    record = resolve_dataset(dataset_id, request)
    return record.summary()


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    summary="Run the full analysis for a dataset (summary + clustering + insights + model)",
)
def analyze(payload: AnalyzeRequest, request: Request) -> AnalyzeResponse:
    settings: Settings = get_settings(request)
    record = resolve_dataset(payload.dataset_id, request)

    clusters = None
    k: int | None = None
    if record.clustering_available:
        sweep = record.sweep(settings)
        k = payload.k if payload.k is not None else max(sweep, key=lambda entry: entry.silhouette).k
        clusters = record.cluster(k, settings)
        k = clusters.k

    cluster_stats, cluster_k = (clusters.clusters, k) if clusters is not None else (None, None)

    return AnalyzeResponse(
        dataset_id=record.dataset_id,
        summary=record.summary(),
        insights=build_insights(
            dataset_id=record.dataset_id,
            context=record.context,
            clusters=cluster_stats,
            k=cluster_k,
        ),
        clusters=clusters,
        model=build_model_info(record, settings, k=cluster_k),
    )


__all__ = ["router"]

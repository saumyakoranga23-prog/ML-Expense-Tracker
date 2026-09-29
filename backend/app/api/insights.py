"""Spending insight route."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import DatasetId, resolve_dataset
from app.schemas.insights import InsightsResponse
from app.services.insights import build_insights

router = APIRouter(tags=["insights"])


@router.get(
    "/insights",
    response_model=InsightsResponse,
    summary="Deterministic insights derived from the processed dataset",
)
def get_insights(dataset_id: DatasetId, request: Request) -> InsightsResponse:
    record = resolve_dataset(dataset_id, request)
    clusters, k = record.latest_cluster_stats()
    return build_insights(
        dataset_id=record.dataset_id,
        context=record.context,
        clusters=clusters,
        k=k,
    )


__all__ = ["router"]

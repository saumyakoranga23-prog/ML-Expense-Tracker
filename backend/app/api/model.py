"""Model information route."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.api.deps import DatasetId, get_settings, resolve_dataset
from app.schemas.model import ModelInfo
from app.services.model_report import build_model_info

router = APIRouter(tags=["model"])


@router.get(
    "/model",
    response_model=ModelInfo,
    summary="Algorithm, features, hyperparameters and fitted diagnostics",
)
def get_model_info(
    dataset_id: DatasetId,
    request: Request,
    k: Annotated[int | None, Query(ge=2, le=8, description="Evaluate a specific K")] = None,
) -> ModelInfo:
    settings = get_settings(request)
    record = resolve_dataset(dataset_id, request)
    return build_model_info(record, settings, k=k)


__all__ = ["router"]

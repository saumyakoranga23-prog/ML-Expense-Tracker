"""Dataset routes: upload, demo dataset, sample download and lifecycle."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Request, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import DatasetIdPath, get_settings, get_store
from app.config import Settings
from app.schemas.dataset import DatasetInfo, UploadResponse
from app.services.csv_loading import decode_bytes
from app.services.ingestion import ingest_text, upload_response
from app.services.store import DatasetStore
from app.utils.errors import UnsupportedFileError, ValidationFailure

logger = logging.getLogger("ledgerlens.upload")
router = APIRouter(tags=["dataset"])

CHUNK_SIZE = 1024 * 1024  # 1 MiB


async def _read_limited(file: UploadFile, limit: int) -> bytes:
    """Read an upload while enforcing the configured size limit."""

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise ValidationFailure(
                f"The file is larger than the {limit / (1024 * 1024):.0f} MB upload limit.",
                details=["Split the export into smaller periods or raise MAX_UPLOAD_BYTES on the server."],
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _validate_filename(filename: str, settings: Settings) -> str:
    name = (filename or "transactions.csv").strip() or "transactions.csv"
    suffix = Path(name).suffix.lower()
    if suffix and suffix not in settings.allowed_extensions:
        raise UnsupportedFileError(
            f"'{suffix}' files are not supported.",
            details=[f"Upload a CSV file ({', '.join(settings.allowed_extensions)})."],
            context={"filename": name},
        )
    return name


@router.get("/health", summary="Service health and configuration snapshot")
def health(request: Request) -> dict[str, object]:
    settings: Settings = get_settings(request)
    store: DatasetStore = get_store(request)
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "api_prefix": settings.api_prefix,
        "datasets_in_memory": len(store.list()),
        "limits": {
            "max_upload_mb": round(settings.max_upload_bytes / (1024 * 1024), 2),
            "max_rows": settings.max_rows,
            "min_rows_for_clustering": settings.min_rows_for_clustering,
            "k_range": [settings.min_k, settings.max_k],
        },
    }


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a transaction CSV and run the cleaning pipeline",
)
async def upload_transactions(request: Request, file: Annotated[UploadFile, File(...)]) -> UploadResponse:
    settings: Settings = get_settings(request)
    store: DatasetStore = get_store(request)

    filename = _validate_filename(file.filename or "", settings)
    content_type = (file.content_type or "").lower()
    if content_type and not any(
        token in content_type for token in ("csv", "text", "octet-stream", "excel", "plain")
    ):
        raise UnsupportedFileError(
            f"Content type '{content_type}' is not supported.",
            details=["Upload a text/CSV file exported from your bank or budgeting app."],
        )

    raw = await _read_limited(file, settings.max_upload_bytes)
    if not raw.strip():
        raise ValidationFailure(
            "The uploaded file is empty.",
            details=["Download the sample CSV from the landing page to see the expected format."],
        )
    if b"\x00" in raw[:8192]:
        raise UnsupportedFileError(
            "The uploaded file looks like binary data rather than CSV text.",
            details=["Only plain-text CSV exports are supported."],
        )

    text, encoding = decode_bytes(raw)
    record = ingest_text(text, filename=filename, source="upload", settings=settings, store=store)
    logger.info(
        "ingested upload filename=%s encoding=%s rows_read=%s rows_clean=%s",
        filename,
        encoding,
        record.cleaned.report.rows_read,
        record.cleaned.report.rows_clean,
    )
    return upload_response(record, settings)


@router.post(
    "/demo",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Load the packaged demo dataset through the same pipeline",
)
def load_demo(request: Request) -> UploadResponse:
    settings: Settings = get_settings(request)
    store: DatasetStore = get_store(request)

    path = settings.sample_csv_path
    if not path.exists():
        raise ValidationFailure(
            "The packaged demo dataset is missing.",
            details=[
                f"Expected it at {path}.",
                "Regenerate it with `python data/generate_sample.py` from the repository root.",
            ],
        )

    text = path.read_text(encoding="utf-8")
    record = ingest_text(text, filename=path.name, source="demo", settings=settings, store=store)
    return upload_response(record, settings)


@router.get("/sample-csv", summary="Download the sample transaction CSV")
def download_sample_csv(request: Request) -> FileResponse:
    settings: Settings = get_settings(request)
    path = settings.sample_csv_path
    if not path.exists():
        raise ValidationFailure(
            "The sample dataset is missing.",
            details=[f"Expected it at {path}.", "Regenerate it with `python data/generate_sample.py`."],
        )
    return FileResponse(
        path,
        media_type="text/csv",
        filename=settings.sample_filename,
        headers={"Cache-Control": "no-store"},
    )


@router.get("/datasets", response_model=list[DatasetInfo], summary="List the datasets held in memory")
def list_datasets(request: Request) -> list[DatasetInfo]:
    store: DatasetStore = get_store(request)
    settings: Settings = get_settings(request)
    return [
        DatasetInfo(
            dataset_id=record.dataset_id,
            filename=record.filename,
            source=record.source,
            row_count=record.row_count,
            created_at=record.created_at,
            clustering_available=record.clustering_available,
            min_rows_for_clustering=settings.min_rows_for_clustering,
            active_k=record.active_k,
        )
        for record in store.list()
    ]


@router.delete(
    "/datasets/{dataset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Forget a dataset and free its cached results",
)
def delete_dataset(dataset_id: DatasetIdPath, request: Request) -> Response:
    store: DatasetStore = get_store(request)
    store.drop(dataset_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]

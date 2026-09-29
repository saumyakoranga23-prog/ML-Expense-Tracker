"""Shared ingestion pipeline: raw CSV text -> validated, cleaned, stored dataset."""

from __future__ import annotations

from app.config import Settings
from app.schemas.dataset import UploadResponse
from app.services.analytics import build_summary
from app.services.cleaning import clean_dataset
from app.services.csv_loading import read_transactions_csv
from app.services.store import DatasetRecord, DatasetStore


def ingest_text(
    text: str,
    *,
    filename: str,
    source: str,
    settings: Settings,
    store: DatasetStore,
) -> DatasetRecord:
    """Parse, clean and register a CSV payload."""

    parsed = read_transactions_csv(text, max_rows=settings.max_rows)
    cleaned = clean_dataset(
        parsed,
        min_rows=settings.min_rows_for_analytics,
        min_rows_for_clustering=settings.min_rows_for_clustering,
    )
    return store.add(cleaned, filename=filename, source=source)


def upload_response(record: DatasetRecord, settings: Settings) -> UploadResponse:
    """Build the payload returned to the client right after ingestion."""

    return UploadResponse(
        dataset_id=record.dataset_id,
        filename=record.filename,
        source="demo" if record.source == "demo" else "upload",
        row_count=record.row_count,
        cleaning=record.cleaned.report,
        summary=build_summary(record.dataset_id, record.cleaned, context=record.context),
        clustering_available=record.clustering_available,
        min_rows_for_clustering=settings.min_rows_for_clustering,
    )


__all__ = ["ingest_text", "upload_response"]

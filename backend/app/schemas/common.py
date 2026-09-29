"""Schemas shared by several endpoints (column detection, cleaning report)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class DetectedColumn(BaseModel):
    """Mapping between a canonical field and the source column we matched."""

    field: str
    source_column: str | None = None
    confidence: Literal["exact", "alias", "heuristic", "missing"] = "missing"


class CleaningIssue(BaseModel):
    """A single row-level problem discovered while cleaning the upload."""

    row: int = Field(description="1-based line number in the source file, header included")
    column: str | None = None
    reason: str
    severity: Literal["error", "warning"] = "warning"
    value: str | None = None


class CleaningReport(BaseModel):
    """Auditable record of what the cleaning pipeline changed."""

    rows_read: int = 0
    rows_clean: int = 0
    rows_removed: int = 0
    invalid_date_rows: int = 0
    invalid_amount_rows: int = 0
    duplicate_rows_removed: int = 0
    missing_category_filled: int = 0
    missing_description_filled: int = 0
    income_rows: int = 0
    expense_rows: int = 0
    delimiter: str = ","
    truncated_rows: int = 0
    detected_columns: list[DetectedColumn] = Field(default_factory=list)
    issues: list[CleaningIssue] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    truncated_issues: int = 0


class ApiError(BaseModel):
    """Shape of every non-2xx JSON body returned by the API."""

    class ErrorDetail(BaseModel):
        code: str
        message: str
        details: list[str] = Field(default_factory=list)
        context: dict[str, object] | None = None

    error: ErrorDetail


__all__ = ["ApiError", "CleaningIssue", "CleaningReport", "DetectedColumn"]

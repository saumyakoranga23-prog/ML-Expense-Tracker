"""Domain errors that map onto HTTP status codes.

Every failure the user can influence (bad file, bad column, bad k, unknown
dataset) raises one of these instead of leaking a traceback, so the API can
always answer with a structured, actionable error payload.
"""

from __future__ import annotations

from typing import Any


class LedgerLensError(Exception):
    """Base class for expected, user-facing failures."""

    status_code: int = 400
    code: str = "bad_request"

    def __init__(
        self,
        message: str,
        *,
        details: list[str] | None = None,
        context: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or []
        self.context = context or {}

    def to_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }
        if self.context:
            payload["error"]["context"] = self.context
        return payload


class ValidationFailure(LedgerLensError):
    """The request was understood but the data or parameters are unusable."""

    status_code = 422
    code = "invalid_dataset"


class DatasetNotFound(LedgerLensError):
    """The referenced dataset id is unknown or has been evicted."""

    status_code = 404
    code = "dataset_not_found"


class PayloadTooLargeError(LedgerLensError):
    """The uploaded file exceeds the configured size or row limit."""

    status_code = 413
    code = "payload_too_large"


class UnsupportedFileError(LedgerLensError):
    """The uploaded file is not a CSV-like text file."""

    status_code = 415
    code = "unsupported_file_type"


class AnalysisUnavailable(LedgerLensError):
    """Clustering or analytics cannot run for the current dataset."""

    status_code = 409
    code = "analysis_unavailable"


__all__ = [
    "AnalysisUnavailable",
    "DatasetNotFound",
    "LedgerLensError",
    "PayloadTooLargeError",
    "UnsupportedFileError",
    "ValidationFailure",
]
